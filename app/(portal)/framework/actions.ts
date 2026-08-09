"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { canOperateFramework, thresholdLockTime } from "@/lib/framework-admin";
import { notifyAllPractitioners } from "@/lib/notifications";

export type FrameworkActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

const err = (error: string): FrameworkActionState => ({ status: "error", error });
const ok: FrameworkActionState = { status: "success", error: null };

/** Rates are editable only while draft AND before any entry lands. */
async function ratesLockedReason(cycleId: string): Promise<string | null> {
  const [c] = await sql<
    { rate_book_status: string; entries: string }[]
  >`
    select rate_book_status,
           (select count(*) from cpd_entries e where e.cycle_id = ${cycleId})::text as entries
    from cpd_cycles where id = ${cycleId}
  `;
  if (!c) return "Cycle not found.";
  if (c.rate_book_status !== "draft")
    return "The rate book is approved and locked for this cycle.";
  if (Number(c.entries) > 0)
    return "Entries already exist in this cycle — rates are locked.";
  return null;
}

/** Save rate + per-cycle cap for a set of rules (draft cycles only). */
export async function saveRateBookAction(
  cycleId: string,
  edits: { ruleId: string; rate: number; maxPerCycle: number | null }[]
): Promise<FrameworkActionState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) return err("Not authorized.");
  const locked = await ratesLockedReason(cycleId);
  if (locked) return err(locked);
  for (const e of edits) {
    if (Number.isNaN(e.rate) || e.rate < 0) return err("Rates must be ≥ 0.");
    if (e.maxPerCycle != null && (Number.isNaN(e.maxPerCycle) || e.maxPerCycle < 0))
      return err("Caps must be ≥ 0.");
  }

  for (const e of edits) {
    await sql`
      update framework_rules
      set rate = ${e.rate}::numeric,
          max_per_cycle = ${e.maxPerCycle}::numeric,
          updated_by = ${identity.user.id}
      where id = ${e.ruleId} and cycle_id = ${cycleId}
    `;
  }
  revalidatePath(`/framework/${cycleId}`);
  return ok;
}

/** Committee-only: approve the draft rate book — locks rates permanently. */
export async function approveRateBookAction(
  cycleId: string
): Promise<FrameworkActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "cpd_committee"))
    return err("Only committee members can approve the rate book.");

  const updated = await sql<{ name: string }[]>`
    update cpd_cycles
    set rate_book_status = 'approved',
        rate_book_approved_by = ${identity.user.id},
        rate_book_approved_at = now(),
        updated_by = ${identity.user.id}
    where id = ${cycleId} and rate_book_status = 'draft'
    returning name
  `;
  if (updated.length === 0) return err("The rate book is already approved.");

  await notifyAllPractitioners({
    kind: "framework_changed",
    title: `${updated[0].name} rate book approved`,
    body: "Credit rates for the cycle are now final. Review how activities are credited.",
    href: "/dashboard",
  });
  revalidatePath(`/framework/${cycleId}`);
  revalidatePath("/framework");
  return ok;
}

/**
 * Save cycle total + per-category floors/ceilings. Allowed for admin +
 * committee on any not-yet-locked cycle (lock = 31 Dec 21:00 MVT).
 */
export async function saveThresholdsAction(
  cycleId: string,
  input: {
    totalRequired: number;
    categories: { categoryId: string; min: number | null; max: number | null }[];
  }
): Promise<FrameworkActionState> {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) return err("Not authorized.");

  const [cycle] = await sql<{ name: string; ends_on: string | Date }[]>`
    select name, ends_on from cpd_cycles where id = ${cycleId}
  `;
  if (!cycle) return err("Cycle not found.");
  const endsOn =
    cycle.ends_on instanceof Date
      ? cycle.ends_on.toISOString().slice(0, 10)
      : cycle.ends_on;
  if (Date.now() >= thresholdLockTime(endsOn).getTime())
    return err("Adjustments closed — the cycle locked at 21:00 on 31 Dec.");

  if (Number.isNaN(input.totalRequired) || input.totalRequired <= 0)
    return err("Cycle total must be a positive number.");
  for (const c of input.categories) {
    if (c.min != null && (Number.isNaN(c.min) || c.min < 0))
      return err("Floors must be ≥ 0.");
    if (c.max != null && (Number.isNaN(c.max) || c.max < 0))
      return err("Ceilings must be ≥ 0.");
    if (c.min != null && c.max != null && c.max < c.min)
      return err("A ceiling cannot be below its floor.");
  }

  await sql`
    update cpd_cycles
    set total_credits_required = ${input.totalRequired}::numeric,
        updated_by = ${identity.user.id}
    where id = ${cycleId}
  `;
  for (const c of input.categories) {
    await sql`
      insert into cpd_cycle_category_caps (cycle_id, category_id, min_credits, max_credits)
      values (${cycleId}, ${c.categoryId}, ${c.min}::numeric, ${c.max}::numeric)
      on conflict (cycle_id, category_id)
      do update set min_credits = excluded.min_credits,
                    max_credits = excluded.max_credits
    `;
  }

  await notifyAllPractitioners({
    kind: "framework_changed",
    title: `${cycle.name} requirements updated`,
    body: "Category floors or the cycle total changed. Check your progress against the new targets.",
    href: "/dashboard",
  });
  revalidatePath(`/framework/${cycleId}/thresholds`);
  revalidatePath("/dashboard");
  return ok;
}
