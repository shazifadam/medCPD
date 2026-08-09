import "server-only";
import { sql } from "@/lib/db";

/** Profile data (Update 1 §5 — PF1/U1-PF1). */

export interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  mmdcRegistration: string | null;
  mmdcRegistrationType: string | null;
  specialty: string | null;
  avatarPath: string | null;
  primaryWorkplace: { id: string; name: string } | null;
  otherWorkplaces: { id: string; name: string }[];
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const [rows, workplaces] = await Promise.all([
    sql<
      {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        mmdc_registration: string | null;
        mmdc_registration_type: string | null;
        specialty: string | null;
        avatar_path: string | null;
        primary_institution_id: string | null;
        primary_institution_name: string | null;
      }[]
    >`
      select p.id, p.full_name, p.email, p.phone,
             p.mmdc_registration, p.mmdc_registration_type,
             s.name as specialty, p.avatar_path,
             p.primary_institution_id, i.name as primary_institution_name
      from profiles p
      left join practitioner_specialties ps
        on ps.practitioner_id = p.id and ps.is_primary
      left join specialties s on s.id = ps.specialty_id
      left join institutions i on i.id = p.primary_institution_id
      where p.id = ${userId}
    `,
    sql<{ id: string; name: string }[]>`
      select i.id, i.name
      from practitioner_workplaces w
      join institutions i on i.id = w.institution_id
      where w.practitioner_id = ${userId}
      order by i.name
    `,
  ]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    mmdcRegistration: r.mmdc_registration,
    mmdcRegistrationType: r.mmdc_registration_type,
    specialty: r.specialty,
    avatarPath: r.avatar_path,
    primaryWorkplace:
      r.primary_institution_id && r.primary_institution_name
        ? { id: r.primary_institution_id, name: r.primary_institution_name }
        : null,
    otherWorkplaces: workplaces.filter(
      (w) => w.id !== r.primary_institution_id
    ),
  };
}

/** Public URL for an avatar in the public cpd-avatars bucket. */
export function avatarPublicUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/cpd-avatars/${avatarPath}`;
}
