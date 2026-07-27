import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "@/lib/db";
import { loadCycleProgress } from "@/lib/dashboard";

/**
 * Certificates (Part 7a). Issuance is service-role/server-side only — RLS has
 * no client INSERT path. v1 issues on demand ("generate-if-missing") instead
 * of a background job: ensure* runs when the practitioner opens their
 * certificates surface or hits a Download button.
 * Numbers follow the CT/CA designs: GRD-EV-<yyyy>-<seq> / GRD-CY-<yyyy>-<seq>
 * (the schema doc leaves the format to the application).
 */

export const CERTIFICATES_BUCKET = "cpd-certificates";

/** Frozen payload snapshot (schema Part 7a design notes). */
export interface CertPayload {
  practitioner?: {
    id?: string;
    display_name?: string;
    mmdc_number?: string | null;
  };
  event?: {
    id?: string;
    title?: string;
    starts_on?: string;
    ends_on?: string;
    venue?: string | null;
    accreditation_number?: string;
  };
  cycle?: { id?: string; name?: string; starts_on?: string; ends_on?: string };
  credits?: {
    category_code?: string;
    category_name?: string;
    credits?: number;
    role_label?: string;
  }[];
  totals?: {
    required?: number;
    earned?: number;
    by_category?: unknown[];
  };
  [key: string]: unknown;
}

interface DbCertRow {
  id: string;
  certificate_number: string;
  kind: "event_attendance" | "cycle_completion";
  status: "active" | "revoked";
  issued_at: Date;
  payload: unknown;
  storage_path: string | null;
  holder_name?: string;
}

export interface CertificateRow {
  id: string;
  certificateNumber: string;
  kind: "event_attendance" | "cycle_completion";
  status: "active" | "revoked";
  issuedAt: Date;
  title: string;
  /** "Attended 21 Jun 2026" / "Issued 31 Dec 2025" context line pieces. */
  occurredOn: string | null;
  credits: number | null;
  categoryLabel: string | null;
  holderName?: string;
  hasPdf: boolean;
}

function rowFromDb(c: DbCertRow): CertificateRow {
  const p: CertPayload =
    typeof c.payload === "string"
      ? JSON.parse(c.payload)
      : ((c.payload ?? {}) as CertPayload);
  const isEvent = c.kind === "event_attendance";
  const credit = isEvent ? p?.credits?.[0] : null;
  return {
    id: c.id,
    certificateNumber: c.certificate_number,
    kind: c.kind,
    status: c.status,
    issuedAt: c.issued_at,
    title: isEvent ? (p?.event?.title ?? "Event") : (p?.cycle?.name ?? "Cycle"),
    occurredOn: isEvent ? (p?.event?.starts_on ?? null) : (p?.cycle?.ends_on ?? null),
    credits: isEvent
      ? credit
        ? Number(credit.credits)
        : null
      : p?.totals?.earned != null
        ? Number(p.totals.earned)
        : null,
    categoryLabel: credit
      ? `${credit.category_name ?? credit.category_code}`
      : null,
    holderName: c.holder_name,
    hasPdf: c.storage_path != null,
  };
}

export async function listMyCertificates(
  practitionerId: string
): Promise<CertificateRow[]> {
  const rows = await sql<DbCertRow[]>`
    select id, certificate_number, kind, status, issued_at, payload, storage_path
    from certificates
    where practitioner_id = ${practitionerId}
    order by issued_at desc
  `;
  return rows.map(rowFromDb);
}

export interface CertificateDetail extends CertificateRow {
  practitionerId: string;
  payload: CertPayload;
  revokedAt: Date | null;
  revocationReason: string | null;
  storageBucket: string | null;
  storagePath: string | null;
}

export async function getCertificate(
  id: string
): Promise<CertificateDetail | null> {
  const rows = await sql<
    (DbCertRow & {
      practitioner_id: string;
      revoked_at: Date | null;
      revocation_reason: string | null;
      storage_bucket: string | null;
    })[]
  >`
    select c.*, p.full_name as holder_name
    from certificates c
    join profiles p on p.id = c.practitioner_id
    where c.id = ${id}
    limit 1
  `;
  const c = rows[0];
  if (!c) return null;
  const base = rowFromDb(c);
  return {
    ...base,
    practitionerId: c.practitioner_id,
    payload:
      typeof c.payload === "string"
        ? JSON.parse(c.payload)
        : ((c.payload ?? {}) as CertPayload),
    revokedAt: c.revoked_at,
    revocationReason: c.revocation_reason,
    storageBucket: c.storage_bucket,
    storagePath: c.storage_path,
  };
}

/** CA1 admin table (search across number / holder / title). */
export async function listAllCertificates(filters?: {
  search?: string;
  kind?: "event_attendance" | "cycle_completion";
  status?: "active" | "revoked";
}): Promise<CertificateRow[]> {
  const search = filters?.search?.trim() || null;
  const rows = await sql<DbCertRow[]>`
    select c.id, c.certificate_number, c.kind, c.status, c.issued_at,
           c.payload, c.storage_path, p.full_name as holder_name
    from certificates c
    join profiles p on p.id = c.practitioner_id
    where (${filters?.kind ?? null}::certificate_kind is null
           or c.kind = ${filters?.kind ?? null})
      and (${filters?.status ?? null}::certificate_status is null
           or c.status = ${filters?.status ?? null})
      and (${search}::text is null
           or c.certificate_number ilike '%' || ${search} || '%'
           or p.full_name ilike '%' || ${search} || '%'
           or c.payload #>> '{event,title}' ilike '%' || ${search} || '%'
           or c.payload #>> '{cycle,name}' ilike '%' || ${search} || '%')
    order by c.issued_at desc
    limit 100
  `;
  return rows.map(rowFromDb);
}

/** CA2 dialog options: verified practitioners + accredited events. */
export async function listIssueOptions() {
  const [practitioners, events] = await Promise.all([
    sql<{ id: string; label: string }[]>`
      select id, full_name as label from profiles
      where registration_state = 'verified'
      order by full_name
      limit 200
    `,
    sql<{ id: string; label: string }[]>`
      select ev.id, ev.title as label
      from events ev
      where ev.status in ('approved', 'completed')
        and exists (select 1 from event_accreditations acc
                    where acc.event_id = ev.id and acc.status = 'active')
      order by ev.starts_at desc
      limit 200
    `,
  ]);
  return { practitioners, events };
}

/* ------------------------------------------------------------------ */
/* Issuance                                                            */
/* ------------------------------------------------------------------ */

const isoDate = (d: string | Date | null): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

/** Year-prefixed sequence, same pattern as accreditation numbers (P5). */
async function nextNumber(
  tx: TransactionSql,
  prefix: "GRD-EV" | "GRD-CY"
): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const [{ n }] = await tx<{ n: string }[]>`
    select count(*) + 1 as n from certificates
    where certificate_number like ${like}
  `;
  return `${prefix}-${year}-${String(n).padStart(6, "0")}`;
}

interface EligibleAttendance {
  attendance_id: string;
  event_id: string;
  accreditation_id: string;
  accreditation_number: string;
  title: string;
  starts_at: Date;
  ends_at: Date;
  venue_name: string | null;
  role_label: string;
  credits: string;
  category_code: string;
  category_name: string;
}

/**
 * Issue any missing event-attendance certificates for this practitioner:
 * verified attendance at an approved/completed event that has ended, with an
 * active accreditation and a non-rejected credit entry. Idempotent — the
 * partial unique index (one active cert per practitioner+event) backstops.
 */
export async function ensureEventCertificates(practitionerId: string) {
  const [profile] = await sql<
    { id: string; full_name: string; mmdc_registration: string | null }[]
  >`select id, full_name, mmdc_registration from profiles
    where id = ${practitionerId} limit 1`;
  if (!profile) return;

  const eligible = await sql<EligibleAttendance[]>`
    select a.id as attendance_id, a.event_id, a.role_label,
           acc.id as accreditation_id, acc.accreditation_number,
           ev.title, ev.starts_at, ev.ends_at, ev.venue_name,
           e.credits, cc.code as category_code, cc.name as category_name
    from event_attendances a
    join events ev on ev.id = a.event_id
    join event_accreditations acc
      on acc.event_id = ev.id and acc.status = 'active'
    join cpd_entries e
      on e.attendance_id = a.id and e.status <> 'rejected'
    join credit_categories cc on cc.id = e.category_id
    where a.practitioner_id = ${practitionerId}
      and a.status = 'verified'
      and ev.status in ('approved', 'completed')
      and ev.ends_at < now()
      and not exists (
        select 1 from certificates c
        where c.practitioner_id = a.practitioner_id
          and c.event_id = a.event_id
          and c.kind = 'event_attendance'
          and c.status = 'active'
      )
  `;

  for (const row of eligible) {
    const payload = {
      practitioner: {
        id: profile.id,
        display_name: profile.full_name,
        mmdc_number: profile.mmdc_registration,
      },
      event: {
        id: row.event_id,
        title: row.title,
        starts_on: isoDate(row.starts_at),
        ends_on: isoDate(row.ends_at),
        venue: row.venue_name,
        accreditation_number: row.accreditation_number,
      },
      credits: [
        {
          category_code: row.category_code,
          category_name: row.category_name,
          credits: Number(row.credits),
          role_label: row.role_label,
        },
      ],
    };
    try {
      await sql.begin(async (tx) => {
        const number = await nextNumber(tx, "GRD-EV");
        await tx`
          insert into certificates
            (certificate_number, kind, practitioner_id,
             event_id, attendance_id, accreditation_id, payload)
          values (${number}, 'event_attendance', ${practitionerId},
                  ${row.event_id}, ${row.attendance_id},
                  ${row.accreditation_id},
                  ${sql.json(payload)})
        `;
      });
    } catch {
      // unique-index race with a concurrent request — already issued
    }
  }
}

/**
 * Issue the cycle-completion certificate when the five-limit engine says the
 * cycle is complete (DB3 path). Returns the certificate id, or null when the
 * cycle is not complete. Idempotent.
 */
export async function ensureCycleCertificate(
  practitionerId: string
): Promise<string | null> {
  const existing = await sql<{ id: string }[]>`
    select c.id from certificates c
    join cpd_cycles cy on cy.id = c.cycle_id
    where c.practitioner_id = ${practitionerId}
      and c.kind = 'cycle_completion' and c.status = 'active'
      and cy.is_current
    limit 1
  `;
  if (existing[0]) return existing[0].id;

  const bundle = await loadCycleProgress(practitionerId);
  if (!bundle || !bundle.progress.complete) return null;

  const [profile] = await sql<
    { id: string; full_name: string; mmdc_registration: string | null }[]
  >`select id, full_name, mmdc_registration from profiles
    where id = ${practitionerId} limit 1`;
  if (!profile) return null;

  const payload = {
    practitioner: {
      id: profile.id,
      display_name: profile.full_name,
      mmdc_number: profile.mmdc_registration,
    },
    cycle: {
      id: bundle.cycle.id,
      name: bundle.cycle.name,
      starts_on: bundle.cycle.startsOn,
      ends_on: bundle.cycle.endsOn,
    },
    totals: {
      required: bundle.cycle.target,
      earned: bundle.progress.countedTotal,
      by_category: Object.entries(bundle.progress.perCategory).map(
        ([code, p]) => ({
          code,
          earned: p.counted,
          min: bundle.fw.categoryCaps[code]?.min ?? null,
          max: bundle.fw.categoryCaps[code]?.max ?? null,
        })
      ),
    },
    completed_at: new Date().toISOString(),
  };

  try {
    let id: string | null = null;
    await sql.begin(async (tx) => {
      const number = await nextNumber(tx, "GRD-CY");
      const [row] = await tx<{ id: string }[]>`
        insert into certificates
          (certificate_number, kind, practitioner_id, cycle_id, payload)
        values (${number}, 'cycle_completion', ${practitionerId},
                ${bundle.cycle.id}, ${sql.json(payload)})
        returning id
      `;
      id = row.id;
    });
    return id;
  } catch {
    const retry = await sql<{ id: string }[]>`
      select id from certificates
      where practitioner_id = ${practitionerId}
        and cycle_id = ${bundle.cycle.id}
        and kind = 'cycle_completion' and status = 'active'
      limit 1
    `;
    return retry[0]?.id ?? null;
  }
}
