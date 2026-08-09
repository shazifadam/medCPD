"use server";

import { signUpSchema } from "@/lib/schemas";
import { formatPhone, DEFAULT_DIAL_CODE } from "@/lib/phone";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { resolveOrganization } from "@/lib/orgs";

export type SignUpState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

export async function signUpAction(
  _prev: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    specialtyId: formData.get("specialtyId"),
    mmdcRegistration: formData.get("mmdcRegistration"),
    mmdcRegistrationType: formData.get("mmdcRegistrationType"),
    email: formData.get("email"),
    // Missing code (older client bundle / no JS) = Maldives, never a failure.
    phoneDialCode: formData.get("phoneDialCode") || DEFAULT_DIAL_CODE,
    phone: formData.get("phone"),
    primaryWorkplace: formData.get("primaryWorkplace"),
  });
  if (!parsed.success) {
    // Client validation (shared schema) should catch this first — if we land
    // here the two sides disagree, so name the fields in the server log.
    console.error(
      "[signup] validation failed:",
      JSON.stringify(parsed.error.flatten().fieldErrors)
    );
    return { status: "error", error: "Please correct the highlighted fields." };
  }
  const input = parsed.data;

  // Duplicate MMDC number? Check before creating the auth user — the unique
  // constraint would otherwise abort the profile trigger with an opaque error.
  const dup = await sql<{ id: string }[]>`
    select id from profiles
    where mmdc_registration = ${input.mmdcRegistration}
    limit 1
  `;
  if (dup.length > 0) {
    return {
      status: "error",
      error:
        "This PMR/TMR number is already registered. Sign in instead, or contact the MMA secretariat.",
    };
  }

  // Passwordless create (decision 2026-07-04): user + profile row now,
  // verification email out, password set on AU8 after the link is clicked.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await auth.signUpWithEmailLink(
    input.email,
    {
      full_name: input.fullName,
      // Country code + national digits joined for storage: "+960 7771234"
      phone: formatPhone(input.phoneDialCode, input.phone),
      mmdc_registration: input.mmdcRegistration,
      mmdc_registration_type: input.mmdcRegistrationType,
    },
    `${appUrl}/auth/callback?next=/set-password`
  );
  if (error) {
    return {
      status: "error",
      error: "Couldn't create your account. Please try again.",
    };
  }

  // The auth user (and profile, via trigger) now exist. Link the specialty —
  // the one signup field the trigger can't write (join-table row).
  try {
    await sql`
      insert into practitioner_specialties (practitioner_id, specialty_id, is_primary)
      select p.id, ${input.specialtyId}::uuid, true
      from profiles p
      where p.email = ${input.email}
      on conflict (practitioner_id, specialty_id) do nothing
    `;
  } catch {
    // Non-fatal: profile exists, specialty can be added on PF2 later.
  }

  // Primary workplace (Update 1 §5): resolve/create the institution and
  // link it — select-or-create, same contract as the event organizer field.
  try {
    const [profile] = await sql<{ id: string }[]>`
      select id from profiles where email = ${input.email}
    `;
    if (profile) {
      const orgId = await resolveOrganization(input.primaryWorkplace, profile.id);
      if (orgId) {
        await sql`
          update profiles set primary_institution_id = ${orgId}
          where id = ${profile.id}
        `;
        await sql`
          insert into practitioner_workplaces (practitioner_id, institution_id)
          values (${profile.id}, ${orgId})
          on conflict do nothing
        `;
      }
    }
  } catch {
    // Non-fatal: workplace can be completed on the profile page later.
  }

  return { status: "success", error: null };
}
