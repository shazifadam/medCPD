import "server-only";
import { sql } from "@/lib/db";
import { listAttempts, type RegistrationAttempt } from "@/lib/registration";

/**
 * RA — registration approvals data. Applicants are profiles by
 * registration_state; approval grants the practitioner role (RA3),
 * rejection stores the reason shown to the applicant (RA4).
 */

export type ApplicantState = "pending" | "verified" | "rejected";

export interface ApplicantRow {
  id: string;
  fullName: string;
  email: string;
  registrationType: string | null; // 'PMR' | 'TMR'
  registrationNumber: string | null;
  state: ApplicantState;
  /** Latest registration attempt's submitted_at (falls back to created_at). */
  submittedAt: string;
  attemptCount: number;
}

export interface ApplicantDetail extends ApplicantRow {
  phone: string | null;
  specialty: string | null;
  primaryWorkplace: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  /** Newest first. */
  attempts: RegistrationAttempt[];
}

function iso(v: string | Date): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

export async function listApplicants(): Promise<ApplicantRow[]> {
  const rows = await sql<
    {
      id: string;
      full_name: string;
      email: string;
      mmdc_registration_type: string | null;
      mmdc_registration: string | null;
      registration_state: ApplicantState;
      submitted_at: Date | string;
      attempt_count: number;
    }[]
  >`
    select p.id, p.full_name, p.email, p.mmdc_registration_type,
           p.mmdc_registration, p.registration_state,
           coalesce(a.latest_submitted_at, p.created_at) as submitted_at,
           coalesce(a.attempt_count, 0) as attempt_count
    from profiles p
    left join lateral (
      select max(ra.submitted_at) as latest_submitted_at,
             count(*)::int as attempt_count
      from registration_attempts ra
      where ra.profile_id = p.id
    ) a on true
    order by (p.registration_state = 'pending') desc,
             coalesce(a.latest_submitted_at, p.created_at) desc
  `;
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    registrationType: r.mmdc_registration_type,
    registrationNumber: r.mmdc_registration,
    state: r.registration_state,
    submittedAt: iso(r.submitted_at),
    attemptCount: r.attempt_count,
  }));
}

export async function getApplicant(
  id: string
): Promise<ApplicantDetail | null> {
  const rows = await sql<
    {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      mmdc_registration_type: string | null;
      mmdc_registration: string | null;
      registration_state: ApplicantState;
      rejection_reason: string | null;
      verified_at: Date | string | null;
      submitted_at: Date | string;
      specialty: string | null;
      primary_workplace: string | null;
    }[]
  >`
    select p.id, p.full_name, p.email, p.phone,
           p.mmdc_registration_type, p.mmdc_registration,
           p.registration_state, p.rejection_reason, p.verified_at,
           coalesce(
             (select max(ra.submitted_at) from registration_attempts ra
              where ra.profile_id = p.id),
             p.created_at
           ) as submitted_at,
           s.name as specialty,
           i.name as primary_workplace
    from profiles p
    left join practitioner_specialties ps
      on ps.practitioner_id = p.id and ps.is_primary
    left join specialties s on s.id = ps.specialty_id
    left join institutions i on i.id = p.primary_institution_id
    where p.id = ${id}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  const attempts = await listAttempts(r.id);
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    registrationType: r.mmdc_registration_type,
    registrationNumber: r.mmdc_registration,
    specialty: r.specialty,
    primaryWorkplace: r.primary_workplace,
    state: r.registration_state,
    rejectionReason: r.rejection_reason,
    verifiedAt: r.verified_at ? iso(r.verified_at) : null,
    submittedAt: iso(r.submitted_at),
    attemptCount: attempts.length,
    attempts,
  };
}
