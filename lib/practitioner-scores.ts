import "server-only";
import { sql } from "@/lib/db";
import { loadCycleProgress } from "@/lib/dashboard";

/**
 * Practitioner scores (Update 1 §4 — U1-PS1/PS2). The LIST uses raw
 * credit sums for speed (deviation noted in the plan); the DETAIL runs
 * the real five-limit engine via loadCycleProgress, override-aware.
 */

export type ScoreFilter = "all" | "below-floor" | "on-track" | "complete";

export interface ScoreRow {
  id: string;
  fullName: string;
  registration: string | null;
  specialty: string | null;
  earned: number;
  pending: number;
  target: number;
  status: Exclude<ScoreFilter, "all">;
}

export async function listPractitionerScores(filters: {
  q?: string;
  specialtyId?: string;
  score?: ScoreFilter;
}): Promise<{ rows: ScoreRow[]; cycleName: string | null }> {
  const cycles = await sql<
    { id: string; name: string; total_credits_required: string }[]
  >`
    select id, name, total_credits_required from cpd_cycles where is_current limit 1
  `;
  const cycle = cycles[0];
  if (!cycle) return { rows: [], cycleName: null };

  const q = filters.q?.trim() ?? "";
  const rows = await sql<
    {
      id: string;
      full_name: string;
      registration: string | null;
      specialty: string | null;
      earned: string;
      pending: string;
      cat1_earned: string;
      cat1_floor: string | null;
      target_override: string | null;
    }[]
  >`
    select p.id, p.full_name,
           case when p.mmdc_registration is not null
                then coalesce(p.mmdc_registration_type || '-', '') || p.mmdc_registration
           end as registration,
           s.name as specialty,
           coalesce((select sum(e.credits) from cpd_entries e
                     where e.practitioner_id = p.id and e.cycle_id = ${cycle.id}
                       and e.status = 'approved'), 0)::text as earned,
           coalesce((select sum(e.credits) from cpd_entries e
                     where e.practitioner_id = p.id and e.cycle_id = ${cycle.id}
                       and e.status = 'pending'), 0)::text as pending,
           coalesce((select sum(e.credits) from cpd_entries e
                     join credit_categories cc on cc.id = e.category_id
                     where e.practitioner_id = p.id and e.cycle_id = ${cycle.id}
                       and e.status = 'approved' and cc.code = 'CAT1'), 0)::text as cat1_earned,
           coalesce(
             (select o.new_value::text from practitioner_cycle_overrides o
              join credit_categories cc on cc.id = o.category_id
              where o.practitioner_id = p.id and o.cycle_id = ${cycle.id}
                and o.field = 'category_floor' and cc.code = 'CAT1'
              order by o.created_at desc limit 1),
             (select cap.min_credits::text from cpd_cycle_category_caps cap
              join credit_categories cc on cc.id = cap.category_id
              where cap.cycle_id = ${cycle.id} and cc.code = 'CAT1')
           ) as cat1_floor,
           (select o.new_value::text from practitioner_cycle_overrides o
            where o.practitioner_id = p.id and o.cycle_id = ${cycle.id}
              and o.field = 'cycle_total'
            order by o.created_at desc limit 1) as target_override
    from profiles p
    left join practitioner_specialties ps
      on ps.practitioner_id = p.id and ps.is_primary
    left join specialties s on s.id = ps.specialty_id
    where p.registration_state = 'verified'
      and exists (select 1 from role_assignments ra
                  where ra.user_id = p.id and ra.role = 'practitioner'
                    and ra.revoked_at is null)
      and (${q} = '' or p.full_name ilike ${"%" + q + "%"}
           or p.mmdc_registration ilike ${"%" + q + "%"})
      and (${filters.specialtyId ?? ""} = '' or ps.specialty_id = ${filters.specialtyId ?? null})
    order by p.full_name
  `;

  const defaultTarget = Number(cycle.total_credits_required);
  const mapped: ScoreRow[] = rows.map((r) => {
    const earned = Number(r.earned);
    const target = r.target_override ? Number(r.target_override) : defaultTarget;
    const cat1Floor = r.cat1_floor != null ? Number(r.cat1_floor) : null;
    const status: ScoreRow["status"] =
      earned >= target
        ? "complete"
        : cat1Floor != null && Number(r.cat1_earned) < cat1Floor
          ? "below-floor"
          : "on-track";
    return {
      id: r.id,
      fullName: r.full_name,
      registration: r.registration,
      specialty: r.specialty,
      earned,
      pending: Number(r.pending),
      target,
      status,
    };
  });

  const filtered =
    !filters.score || filters.score === "all"
      ? mapped
      : mapped.filter((r) => r.status === filters.score);
  return { rows: filtered, cycleName: cycle.name };
}

export interface OverrideHistoryRow {
  id: string;
  field: string;
  categoryCode: string | null;
  oldValue: string | null;
  newValue: string;
  reason: string;
  evidencePath: string;
  adjustedByName: string | null;
  createdAt: string | Date;
}

export async function getScoreDetail(practitionerId: string) {
  const [profileRows, bundle, history] = await Promise.all([
    sql<
      {
        id: string;
        full_name: string;
        email: string;
        mmdc_registration: string | null;
        mmdc_registration_type: string | null;
        specialty: string | null;
      }[]
    >`
      select p.id, p.full_name, p.email, p.mmdc_registration,
             p.mmdc_registration_type, s.name as specialty
      from profiles p
      left join practitioner_specialties ps
        on ps.practitioner_id = p.id and ps.is_primary
      left join specialties s on s.id = ps.specialty_id
      where p.id = ${practitionerId}
    `,
    loadCycleProgress(practitionerId),
    sql<
      {
        id: string;
        field: string;
        category_code: string | null;
        old_value: string | null;
        new_value: string;
        reason: string;
        evidence_path: string;
        adjusted_by_name: string | null;
        created_at: string | Date;
      }[]
    >`
      select o.id, o.field, cc.code as category_code,
             o.old_value::text, o.new_value::text, o.reason, o.evidence_path,
             p.full_name as adjusted_by_name, o.created_at
      from practitioner_cycle_overrides o
      left join credit_categories cc on cc.id = o.category_id
      left join profiles p on p.id = o.adjusted_by
      where o.practitioner_id = ${practitionerId}
        and o.cycle_id = (select id from cpd_cycles where is_current)
      order by o.created_at desc
    `,
  ]);
  if (profileRows.length === 0) return null;
  return {
    profile: profileRows[0],
    bundle,
    history: history.map(
      (h): OverrideHistoryRow => ({
        id: h.id,
        field: h.field,
        categoryCode: h.category_code,
        oldValue: h.old_value,
        newValue: h.new_value,
        reason: h.reason,
        evidencePath: h.evidence_path,
        adjustedByName: h.adjusted_by_name,
        createdAt: h.created_at,
      })
    ),
  };
}

export async function listSpecialtyOptions() {
  return sql<{ id: string; name: string }[]>`
    select id, name from specialties order by name
  `;
}

export async function listCategoryOptions() {
  return sql<{ id: string; code: string; name: string }[]>`
    select id, code, name from credit_categories order by display_order
  `;
}
