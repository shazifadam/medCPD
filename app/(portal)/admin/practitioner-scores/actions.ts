"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { uploadFile } from "@/lib/storage";
import { notifyUser } from "@/lib/notifications";

const ADJUSTMENTS_BUCKET = "cpd-adjustments";
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export type OverrideActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

/**
 * U1-PS2 — apply a per-practitioner eligibility override. Reason AND
 * evidence are mandatory; the adjustment is audit-visible (override row),
 * and the practitioner is notified.
 */
export async function applyOverrideAction(
  practitionerId: string,
  _prev: OverrideActionState,
  formData: FormData
): Promise<OverrideActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }

  const field = String(formData.get("field") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const newValueRaw = String(formData.get("newValue") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const evidence = formData.get("evidence");

  if (field !== "category_floor" && field !== "cycle_total") {
    return { status: "error", error: "Choose what to adjust." };
  }
  if (field === "category_floor" && !categoryId) {
    return { status: "error", error: "Choose the category." };
  }
  const newValue = Number(newValueRaw);
  if (!newValueRaw || Number.isNaN(newValue) || newValue < 0) {
    return { status: "error", error: "Enter the new value (≥ 0)." };
  }
  if (reason.length < 10) {
    return { status: "error", error: "A meaningful reason is required." };
  }
  if (!(evidence instanceof File) || evidence.size === 0) {
    return { status: "error", error: "Attach supporting evidence (image or PDF)." };
  }
  if (evidence.size > MAX_EVIDENCE_BYTES) {
    return { status: "error", error: "Evidence file is too large (max 10 MB)." };
  }
  if (!ALLOWED_EVIDENCE.includes(evidence.type)) {
    return { status: "error", error: "Evidence must be an image or a PDF." };
  }

  const [cycle] = await sql<{ id: string; name: string; total: string }[]>`
    select id, name, total_credits_required::text as total
    from cpd_cycles where is_current limit 1
  `;
  if (!cycle) return { status: "error", error: "No active cycle." };

  // Current effective value → old_value (override-aware)
  let oldValue: string | null = null;
  if (field === "cycle_total") {
    const [o] = await sql<{ v: string }[]>`
      select coalesce(
        (select new_value::text from practitioner_cycle_overrides
         where practitioner_id = ${practitionerId} and cycle_id = ${cycle.id}
           and field = 'cycle_total' order by created_at desc limit 1),
        ${cycle.total}
      ) as v
    `;
    oldValue = o.v;
  } else {
    const [o] = await sql<{ v: string | null }[]>`
      select coalesce(
        (select new_value::text from practitioner_cycle_overrides
         where practitioner_id = ${practitionerId} and cycle_id = ${cycle.id}
           and field = 'category_floor' and category_id = ${categoryId}
         order by created_at desc limit 1),
        (select min_credits::text from cpd_cycle_category_caps
         where cycle_id = ${cycle.id} and category_id = ${categoryId})
      ) as v
    `;
    oldValue = o.v;
  }

  const key = `${practitionerId}/${crypto.randomUUID()}-${evidence.name.replace(/[^\w.-]/g, "_")}`;
  await uploadFile(
    ADJUSTMENTS_BUCKET,
    key,
    Buffer.from(await evidence.arrayBuffer()),
    evidence.type
  );

  await sql`
    insert into practitioner_cycle_overrides
      (practitioner_id, cycle_id, field, category_id, old_value, new_value,
       reason, evidence_path, adjusted_by)
    values
      (${practitionerId}, ${cycle.id}, ${field},
       ${field === "category_floor" ? categoryId : null},
       ${oldValue}::numeric, ${newValue}::numeric, ${reason}, ${key},
       ${identity.user.id})
  `;

  await notifyUser({
    userId: practitionerId,
    kind: "eligibility_adjusted",
    title: "Your eligibility was adjusted",
    body:
      field === "cycle_total"
        ? `Your ${cycle.name} target was adjusted to ${newValue.toFixed(1)} credits.`
        : `A category floor for ${cycle.name} was adjusted to ${newValue.toFixed(1)} credits.`,
    href: "/dashboard",
  });

  revalidatePath(`/admin/practitioner-scores/${practitionerId}`);
  revalidatePath("/admin/practitioner-scores");
  return { status: "success", error: null };
}
