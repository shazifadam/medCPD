import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "@/lib/db";

/**
 * Registration attempts. Every submission of a registration (web sign-up,
 * reapply by the applicant, reopen by MMA) is one row in
 * registration_attempts under the same profile. Attempt 1 comes from the
 * handle_new_user() trigger; later attempts are opened here.
 */

export type AttemptVia = "signup" | "reapply" | "admin_reopen";

export interface AttemptSnapshot {
  fullName: string;
  email: string;
  phone: string | null;
  mmdcRegistration: string | null;
  mmdcRegistrationType: "PMR" | "TMR" | null;
}

export interface RegistrationAttempt {
  id: string;
  attemptNo: number;
  submittedAt: string;
  submittedVia: AttemptVia;
  outcome: "pending" | "verified" | "rejected";
  decidedAt: string | null;
  decidedByName: string | null;
  rejectionReason: string | null;
  fullName: string;
  mmdcRegistration: string | null;
  mmdcRegistrationType: string | null;
  phone: string | null;
}

/** `sql` itself or a transaction handle from `sql.begin`. */
type Db = typeof sql | TransactionSql;

function iso(v: string | Date): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

/** Insert attempt max+1 (outcome pending). `db` = sql or a tx. */
export async function openNewAttempt(
  db: Db,
  profileId: string,
  via: AttemptVia,
  snap: AttemptSnapshot
): Promise<{ id: string; attemptNo: number }> {
  const rows = await db<{ id: string; attempt_no: number }[]>`
    insert into registration_attempts
      (profile_id, attempt_no, submitted_via, full_name, email, phone,
       mmdc_registration, mmdc_registration_type)
    select ${profileId}, coalesce(max(attempt_no), 0) + 1, ${via},
           ${snap.fullName}, ${snap.email}, ${snap.phone},
           ${snap.mmdcRegistration}, ${snap.mmdcRegistrationType}
    from registration_attempts
    where profile_id = ${profileId}
    returning id, attempt_no
  `;
  return { id: rows[0].id, attemptNo: rows[0].attempt_no };
}

/** Settle the latest attempt (highest attempt_no) if still pending. */
export async function settleLatestAttempt(
  db: Db,
  profileId: string,
  outcome: "verified" | "rejected",
  decidedBy: string,
  rejectionReason: string | null
): Promise<void> {
  await db`
    update registration_attempts
    set outcome = ${outcome},
        decided_at = now(),
        decided_by = ${decidedBy},
        rejection_reason = ${outcome === "rejected" ? rejectionReason : null}
    where id = (
      select id from registration_attempts
      where profile_id = ${profileId}
      order by attempt_no desc
      limit 1
    )
      and outcome = 'pending'
  `;
}

/** Every attempt for a profile, newest first. */
export async function listAttempts(
  profileId: string
): Promise<RegistrationAttempt[]> {
  const rows = await sql<
    {
      id: string;
      attempt_no: number;
      submitted_at: Date | string;
      submitted_via: AttemptVia;
      outcome: "pending" | "verified" | "rejected";
      decided_at: Date | string | null;
      decided_by_name: string | null;
      rejection_reason: string | null;
      full_name: string;
      mmdc_registration: string | null;
      mmdc_registration_type: string | null;
      phone: string | null;
    }[]
  >`
    select a.id, a.attempt_no, a.submitted_at, a.submitted_via, a.outcome,
           a.decided_at, d.full_name as decided_by_name, a.rejection_reason,
           a.full_name, a.mmdc_registration, a.mmdc_registration_type, a.phone
    from registration_attempts a
    left join profiles d on d.id = a.decided_by
    where a.profile_id = ${profileId}
    order by a.attempt_no desc
  `;
  return rows.map((r) => ({
    id: r.id,
    attemptNo: r.attempt_no,
    submittedAt: iso(r.submitted_at),
    submittedVia: r.submitted_via,
    outcome: r.outcome,
    decidedAt: r.decided_at ? iso(r.decided_at) : null,
    decidedByName: r.decided_by_name,
    rejectionReason: r.rejection_reason,
    fullName: r.full_name,
    mmdcRegistration: r.mmdc_registration,
    mmdcRegistrationType: r.mmdc_registration_type,
    phone: r.phone,
  }));
}

export async function countAttempts(profileId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n
    from registration_attempts
    where profile_id = ${profileId}
  `;
  return rows[0]?.n ?? 0;
}
