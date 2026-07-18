import "server-only";
import { sql } from "@/lib/db";

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
  submittedAt: string;
}

export interface ApplicantDetail extends ApplicantRow {
  phone: string | null;
  specialty: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
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
      created_at: Date | string;
    }[]
  >`
    select id, full_name, email, mmdc_registration_type, mmdc_registration,
           registration_state, created_at
    from profiles
    order by (registration_state = 'pending') desc, created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    registrationType: r.mmdc_registration_type,
    registrationNumber: r.mmdc_registration,
    state: r.registration_state,
    submittedAt: iso(r.created_at),
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
      created_at: Date | string;
      specialty: string | null;
    }[]
  >`
    select p.id, p.full_name, p.email, p.phone,
           p.mmdc_registration_type, p.mmdc_registration,
           p.registration_state, p.rejection_reason, p.verified_at,
           p.created_at,
           s.name as specialty
    from profiles p
    left join practitioner_specialties ps
      on ps.practitioner_id = p.id and ps.is_primary
    left join specialties s on s.id = ps.specialty_id
    where p.id = ${id}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    registrationType: r.mmdc_registration_type,
    registrationNumber: r.mmdc_registration,
    specialty: r.specialty,
    state: r.registration_state,
    rejectionReason: r.rejection_reason,
    verifiedAt: r.verified_at ? iso(r.verified_at) : null,
    submittedAt: iso(r.created_at),
  };
}
