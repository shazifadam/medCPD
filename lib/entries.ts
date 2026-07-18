import "server-only";
import { sql } from "@/lib/db";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import type { EntryStatus } from "@/components/features/entries/status-badge";

/**
 * EN1–EN3 — My CPD page data: cycle line, counted progress (reuses the
 * dashboard aggregation), per-category counted totals, and the full entries
 * list for the current cycle. Tab counts derive from the list client-side.
 */

/** LA1/EN1 card subtitles (design copy). */
const CATEGORY_SHORT_NAMES: Record<string, string> = {
  CAT1: "Formal learning",
  CAT2: "Practice-based",
  CAT3: "Academic & scholarly",
  CAT4: "Leadership",
};

/** postgres-js may hand back date columns as Date objects — normalize to ISO. */
function isoDate(v: string | Date | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

export interface EntryRow {
  id: string;
  title: string;
  categoryLabel: string; // "Cat 1 · Formal learning"
  occurredOn: string; // ISO date
  credits: number;
  status: EntryStatus;
}

export interface CategoryCard {
  code: string;
  label: string; // "Category 1"
  shortName: string;
  counted: number;
  floor: number | null;
  belowFloor: boolean;
  shortBy: number | null;
}

export interface MyCpdData {
  dashboard: DashboardData;
  cycleEndsOn: string | null;
  categories: CategoryCard[];
  entries: EntryRow[];
}

export async function getMyCpdData(practitionerId: string): Promise<MyCpdData> {
  const dashboard = await getDashboardData(practitionerId);

  const [cycleRows, categoryRows, entryRows] = await Promise.all([
    sql<{ ends_on: string }[]>`
      select ends_on from cpd_cycles where is_current limit 1
    `,
    sql<{ code: string; min_credits: string | null }[]>`
      select cc.code, cap.min_credits
      from credit_categories cc
      left join cpd_cycle_category_caps cap
        on cap.category_id = cc.id
        and cap.cycle_id = (select id from cpd_cycles where is_current limit 1)
      order by cc.display_order
    `,
    sql<
      {
        id: string;
        title: string | null;
        category_code: string;
        occurred_on: string;
        credits: string;
        status: EntryStatus;
      }[]
    >`
      select
        e.id,
        e.title,
        cc.code as category_code,
        e.occurred_on,
        e.credits,
        e.status
      from cpd_entries e
      join credit_categories cc on cc.id = e.category_id
      where e.practitioner_id = ${practitionerId}
        and e.cycle_id = (select id from cpd_cycles where is_current limit 1)
      order by e.occurred_on desc, e.created_at desc
    `,
  ]);

  const categories: CategoryCard[] = categoryRows.map((c) => {
    // Counted totals come from the five-limit engine, never a raw sum.
    const counted = dashboard.perCategory[c.code]?.counted ?? 0;
    const floor = c.min_credits != null ? Number(c.min_credits) : null;
    const belowFloor = floor != null && counted < floor;
    return {
      code: c.code,
      label: `Category ${c.code.replace("CAT", "")}`,
      shortName: CATEGORY_SHORT_NAMES[c.code] ?? c.code,
      counted,
      floor,
      belowFloor,
      shortBy: belowFloor && floor != null ? Math.round((floor - counted) * 10) / 10 : null,
    };
  });

  const entries: EntryRow[] = entryRows.map((e) => ({
    id: e.id,
    title: e.title ?? "(untitled entry)",
    categoryLabel: `Cat ${e.category_code.replace("CAT", "")} · ${
      CATEGORY_SHORT_NAMES[e.category_code] ?? e.category_code
    }`,
    occurredOn: isoDate(e.occurred_on)!,
    credits: Number(e.credits),
    status: e.status,
  }));

  return {
    dashboard,
    cycleEndsOn: isoDate(cycleRows[0]?.ends_on ?? null),
    categories,
    entries,
  };
}

/** DB1 — the dashboard's "Recent CPD entries" panel (last N activities). */
export async function getRecentEntries(
  practitionerId: string,
  limit = 4
): Promise<EntryRow[]> {
  const rows = await sql<
    {
      id: string;
      title: string | null;
      category_code: string;
      occurred_on: string;
      credits: string;
      status: EntryStatus;
    }[]
  >`
    select e.id, e.title, cc.code as category_code,
           e.occurred_on, e.credits, e.status
    from cpd_entries e
    join credit_categories cc on cc.id = e.category_id
    where e.practitioner_id = ${practitionerId}
      and e.cycle_id = (select id from cpd_cycles where is_current limit 1)
    order by e.occurred_on desc, e.created_at desc
    limit ${limit}
  `;
  return rows.map((e) => ({
    id: e.id,
    title: e.title ?? "(untitled entry)",
    categoryLabel: `Cat ${e.category_code.replace("CAT", "")} · ${
      CATEGORY_SHORT_NAMES[e.category_code] ?? e.category_code
    }`,
    occurredOn: isoDate(e.occurred_on)!,
    credits: Number(e.credits),
    status: e.status,
  }));
}

// ---------------------------------------------------------------------------
// EN4–EN6 — entry detail
// ---------------------------------------------------------------------------

export interface EntryAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

export interface EntryDetail {
  id: string;
  title: string;
  status: EntryStatus;
  categoryLabel: string; // "Cat 1 · Formal learning"
  activityTypeName: string;
  calculationMethod: string;
  occurredOn: string;
  hours: number | null;
  sessions: number | null;
  credits: number;
  description: string | null;
  reviewedAt: string | null;
  reviewComments: string | null;
  attachments: EntryAttachment[];
}

/** Detail scoped to the owner — returns null for missing/foreign entries. */
export async function getEntryDetail(
  practitionerId: string,
  entryId: string
): Promise<EntryDetail | null> {
  const rows = await sql<
    {
      id: string;
      title: string | null;
      status: EntryStatus;
      category_code: string;
      activity_type_name: string;
      calculation_method: string;
      occurred_on: string;
      hours: string | null;
      sessions: number | null;
      credits: string;
      description: string | null;
      reviewed_at: string | null;
      review_comments: string | null;
    }[]
  >`
    select
      e.id, e.title, e.status,
      cc.code as category_code,
      at.name as activity_type_name,
      at.calculation_method,
      e.occurred_on, e.hours, e.sessions, e.credits, e.description,
      e.reviewed_at, e.review_comments
    from cpd_entries e
    join credit_categories cc on cc.id = e.category_id
    join activity_types at on at.id = e.activity_type_id
    where e.id = ${entryId} and e.practitioner_id = ${practitionerId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const attachments = await sql<
    {
      id: string;
      filename: string;
      size_bytes: string;
      storage_bucket: string;
      storage_path: string;
    }[]
  >`
    select id, filename, size_bytes, storage_bucket, storage_path
    from cpd_entry_attachments
    where entry_id = ${entryId}
    order by uploaded_at
  `;

  return {
    id: row.id,
    title: row.title ?? "(untitled entry)",
    status: row.status,
    categoryLabel: `Cat ${row.category_code.replace("CAT", "")} · ${
      CATEGORY_SHORT_NAMES[row.category_code] ?? row.category_code
    }`,
    activityTypeName: row.activity_type_name,
    calculationMethod: row.calculation_method,
    occurredOn: isoDate(row.occurred_on)!,
    hours: row.hours != null ? Number(row.hours) : null,
    sessions: row.sessions,
    credits: Number(row.credits),
    description: row.description,
    reviewedAt: isoDate(row.reviewed_at),
    reviewComments: row.review_comments,
    attachments: attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: Number(a.size_bytes),
      storageBucket: a.storage_bucket,
      storagePath: a.storage_path,
    })),
  };
}
