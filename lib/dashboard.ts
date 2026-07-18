import "server-only";
import { sql } from "@/lib/db";
import {
  aggregateCycle,
  type ApprovedEntry,
  type CycleFramework,
} from "@/lib/credits";

/**
 * Dashboard data (DB1–DB4). Cycle + floors come from the framework tables;
 * approved credits run through the five-limit engine (aggregateCycle) so the
 * headline figure is the COUNTED total (Option A), never a raw sum. Pending
 * is a raw sum by design — caps only apply to approved credit.
 */

export interface DashboardData {
  cycle: { name: string; target: number } | null;
  cat1Floor: number | null;
  approved: number;
  pending: number;
  cat1Approved: number;
  pendingCount: number;
  state: "empty" | "on-track" | "below-floor" | "complete";
  /** Counted totals per category code (post caps) — feeds EN1 cards. */
  perCategory: Record<string, { counted: number }>;
}

export async function getDashboardData(
  practitionerId: string
): Promise<DashboardData> {
  const cycles = await sql<
    { id: string; name: string; total_credits_required: string }[]
  >`
    select id, name, total_credits_required
    from cpd_cycles
    where is_current
    limit 1
  `;
  const cycle = cycles[0];
  if (!cycle) {
    return {
      cycle: null,
      cat1Floor: null,
      approved: 0,
      pending: 0,
      cat1Approved: 0,
      pendingCount: 0,
      state: "empty",
      perCategory: {},
    };
  }

  const [categoryCaps, subcatCaps, ruleCaps, entries, pendingRows] =
    await Promise.all([
      sql<{ code: string; min_credits: string | null; max_credits: string | null }[]>`
        select cc.code, cap.min_credits, cap.max_credits
        from cpd_cycle_category_caps cap
        join credit_categories cc on cc.id = cap.category_id
        where cap.cycle_id = ${cycle.id}
      `,
      sql<{ code: string; max_per_cycle: string }[]>`
        select sc.code, cap.max_per_cycle
        from cpd_cycle_subcategory_caps cap
        join credit_subcategories sc on sc.id = cap.subcategory_id
        where cap.cycle_id = ${cycle.id}
      `,
      sql<{ id: string; max_per_cycle: string; cap_period: "per_cycle" | "per_year" }[]>`
        select id, max_per_cycle, cap_period
        from framework_rules
        where cycle_id = ${cycle.id} and max_per_cycle is not null
      `,
      sql<
        {
          credits: string;
          category_code: string;
          subcategory_code: string | null;
          framework_rule_id: string | null;
          year: number;
        }[]
      >`
        select
          e.credits,
          cc.code as category_code,
          sc.code as subcategory_code,
          e.framework_rule_id,
          extract(year from e.occurred_on)::int as year
        from cpd_entries e
        join credit_categories cc on cc.id = e.category_id
        join activity_types at on at.id = e.activity_type_id
        left join credit_subcategories sc on sc.id = at.subcategory_id
        where e.practitioner_id = ${practitionerId}
          and e.cycle_id = ${cycle.id}
          and e.status = 'approved'
      `,
      sql<{ sum: string | null; count: string }[]>`
        select coalesce(sum(credits), 0) as sum, count(*) as count
        from cpd_entries
        where practitioner_id = ${practitionerId}
          and cycle_id = ${cycle.id}
          and status = 'pending'
      `,
    ]);

  const fw: CycleFramework = {
    target: Number(cycle.total_credits_required),
    ruleCaps: ruleCaps.map((r) => ({
      frameworkRuleId: r.id,
      maxPerCycle: Number(r.max_per_cycle),
      capPeriod: r.cap_period,
    })),
    subcategoryCaps: Object.fromEntries(
      subcatCaps.map((s) => [s.code, Number(s.max_per_cycle)])
    ),
    categoryCaps: Object.fromEntries(
      categoryCaps.map((c) => [
        c.code,
        {
          min: c.min_credits != null ? Number(c.min_credits) : null,
          max: c.max_credits != null ? Number(c.max_credits) : null,
        },
      ])
    ),
  };

  const approvedEntries: ApprovedEntry[] = entries.map((e) => ({
    credits: Number(e.credits),
    categoryCode: e.category_code,
    subcategoryCode: e.subcategory_code,
    frameworkRuleId: e.framework_rule_id,
    year: e.year,
  }));

  const progress = aggregateCycle(approvedEntries, fw);
  const approved = progress.countedTotal;
  const pending = Number(pendingRows[0]?.sum ?? 0);
  const pendingCount = Number(pendingRows[0]?.count ?? 0);
  const cat1 = progress.perCategory["CAT1"];
  const cat1Approved = cat1?.counted ?? 0;
  const cat1Floor = fw.categoryCaps["CAT1"]?.min ?? null;

  let state: DashboardData["state"] = "empty";
  if (approved + pending > 0 || pendingCount > 0) {
    state = progress.complete
      ? "complete"
      : progress.targetMet
        ? "below-floor"
        : "on-track";
  }

  return {
    cycle: { name: cycle.name, target: fw.target },
    cat1Floor,
    approved,
    pending,
    cat1Approved,
    pendingCount,
    state,
    perCategory: Object.fromEntries(
      Object.entries(progress.perCategory).map(([code, p]) => [
        code,
        { counted: p.counted },
      ])
    ),
  };
}
