import "server-only";
import { sql } from "@/lib/db";
import type { Identity } from "@/lib/auth/identity";
import { hasRole } from "@/lib/auth/identity";

/**
 * Framework administration (CPD Update 1 §3). Both mma_admin and
 * cpd_committee operate the framework; rate-book APPROVAL is committee-only.
 *
 * Rate-book lifecycle per cycle:
 *   draft      → rates editable UNTIL committee approval OR first entry
 *   approved   → rates locked; only floors + cycle total adjustable,
 *                and only until 31 Dec 21:00 of the cycle year.
 */

export function canOperateFramework(identity: Identity): boolean {
  return hasRole(identity, "mma_admin") || hasRole(identity, "cpd_committee");
}

export interface CycleListRow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  rateBookStatus: "draft" | "approved";
  entryCount: number;
}

export async function listCycles(): Promise<CycleListRow[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      starts_on: string | Date;
      ends_on: string | Date;
      is_current: boolean;
      rate_book_status: "draft" | "approved";
      entry_count: string;
    }[]
  >`
    select c.id, c.name, c.starts_on, c.ends_on, c.is_current, c.rate_book_status,
           (select count(*) from cpd_entries e where e.cycle_id = c.id)::text as entry_count
    from cpd_cycles c
    order by c.starts_on desc
  `;
  const iso = (d: string | Date) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : d;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startsOn: iso(r.starts_on),
    endsOn: iso(r.ends_on),
    isCurrent: r.is_current,
    rateBookStatus: r.rate_book_status,
    entryCount: Number(r.entry_count),
  }));
}

export interface RateBookData {
  cycle: CycleListRow & {
    totalRequired: string;
    approvedAt: string | null;
    approvedByName: string | null;
  };
  /** Rates are editable: draft status AND zero entries in the cycle. */
  ratesEditable: boolean;
  rules: {
    id: string;
    activityName: string;
    activityCode: string;
    categoryCode: string;
    method: string;
    rate: string;
    maxPerCycle: string | null;
    capPeriod: string;
  }[];
  allCycles: { id: string; name: string }[];
}

export async function getRateBook(cycleId: string): Promise<RateBookData | null> {
  const cycles = await listCycles();
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) return null;

  const [meta] = await sql<
    { total_credits_required: string; rate_book_approved_at: string | null; approver: string | null }[]
  >`
    select c.total_credits_required, c.rate_book_approved_at, p.full_name as approver
    from cpd_cycles c
    left join profiles p on p.id = c.rate_book_approved_by
    where c.id = ${cycleId}
  `;

  const rules = await sql<
    {
      id: string;
      activity_name: string;
      activity_code: string;
      category_code: string;
      method: string;
      rate: string;
      max_per_cycle: string | null;
      cap_period: string;
    }[]
  >`
    select fr.id, at.name as activity_name, at.code as activity_code,
           cc.code as category_code, at.calculation_method::text as method,
           fr.rate::text, fr.max_per_cycle::text, fr.cap_period::text
    from framework_rules fr
    join activity_types at on at.id = fr.activity_type_id
    join credit_categories cc on cc.id = fr.category_id
    where fr.cycle_id = ${cycleId} and fr.role_label is null
    order by cc.display_order, at.name
  `;

  return {
    cycle: {
      ...cycle,
      totalRequired: meta.total_credits_required,
      approvedAt: meta.rate_book_approved_at,
      approvedByName: meta.approver,
    },
    ratesEditable: cycle.rateBookStatus === "draft" && cycle.entryCount === 0,
    rules: rules.map((r) => ({
      id: r.id,
      activityName: r.activity_name,
      activityCode: r.activity_code,
      categoryCode: r.category_code,
      method: r.method,
      rate: r.rate,
      maxPerCycle: r.max_per_cycle,
      capPeriod: r.cap_period,
    })),
    allCycles: cycles.map((c) => ({ id: c.id, name: c.name })),
  };
}

export interface ThresholdsData {
  cycle: CycleListRow & { totalRequired: string };
  /** Floors/total lock at 21:00 on 31 Dec of the cycle year (Maldives). */
  editable: boolean;
  lockAt: string;
  categories: {
    categoryId: string;
    code: string;
    name: string;
    minCredits: string | null;
    maxCredits: string | null;
  }[];
}

/** 31 Dec 21:00 Maldives time (UTC+5) for the cycle's end year. */
export function thresholdLockTime(endsOn: string): Date {
  const year = new Date(endsOn).getUTCFullYear();
  return new Date(Date.UTC(year, 11, 31, 16, 0, 0)); // 21:00 MVT = 16:00 UTC
}

export async function getThresholds(cycleId: string): Promise<ThresholdsData | null> {
  const cycles = await listCycles();
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) return null;
  const [meta] = await sql<{ total_credits_required: string }[]>`
    select total_credits_required from cpd_cycles where id = ${cycleId}
  `;
  const categories = await sql<
    {
      category_id: string;
      code: string;
      name: string;
      min_credits: string | null;
      max_credits: string | null;
    }[]
  >`
    select cc.id as category_id, cc.code, cc.name,
           cap.min_credits::text, cap.max_credits::text
    from credit_categories cc
    left join cpd_cycle_category_caps cap
      on cap.category_id = cc.id and cap.cycle_id = ${cycleId}
    order by cc.display_order
  `;
  const lockAt = thresholdLockTime(cycle.endsOn);
  return {
    cycle: { ...cycle, totalRequired: meta.total_credits_required },
    editable: Date.now() < lockAt.getTime(),
    lockAt: lockAt.toISOString(),
    categories: categories.map((c) => ({
      categoryId: c.category_id,
      code: c.code,
      name: c.name,
      minCredits: c.min_credits,
      maxCredits: c.max_credits,
    })),
  };
}
