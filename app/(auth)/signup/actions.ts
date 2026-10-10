"use server";

import { signUpSchema } from "@/lib/schemas";
import { formatPhone, DEFAULT_DIAL_CODE } from "@/lib/phone";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { RegistrationState } from "@/lib/auth/identity";

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
    mmdcRegistration: formData.get("mmdcRegistration"),
    mmdcRegistrationType: formData.get("mmdcRegistrationType"),
    email: formData.get("email"),
    // Missing code (older client bundle / no JS) = Maldives, never a failure.
    phoneDialCode: formData.get("phoneDialCode") || DEFAULT_DIAL_CODE,
    phone: formData.get("phone"),
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
  const phone = formatPhone(input.phoneDialCode, input.phone);

  // Never create a duplicate row (Fix 1, 2026-10-10). Email first: it is the
  // account identity. Nothing is written to an existing profile from this
  // unauthenticated form: a rejected applicant resubmits on /reapply after
  // signing in, which logs the new attempt on the same profile.
  const byEmail = await sql<
    { id: string; registration_state: RegistrationState }[]
  >`
    select id, registration_state from profiles
    where email = ${input.email}
    limit 1
  `;
  const existing = byEmail[0];
  if (existing?.registration_state === "verified") {
    return {
      status: "error",
      error: "This email is already registered. Sign in instead.",
    };
  }
  if (existing?.registration_state === "pending") {
    return {
      status: "error",
      error:
        "An application for this email is already under review. Sign in to check its status.",
    };
  }
  if (existing) {
    return {
      status: "error",
      error:
        "The application for this email was not approved. Sign in to correct your details and resubmit it.",
    };
  }

  // New email: any holder of the number blocks the signup, because the
  // unique constraint would otherwise abort the profile trigger with an
  // opaque error.
  const byNumber = await sql<
    { id: string; registration_state: RegistrationState }[]
  >`
    select id, registration_state from profiles
    where mmdc_registration = ${input.mmdcRegistration}
    limit 1
  `;
  const numberHolder = byNumber[0];
  if (numberHolder?.registration_state === "rejected") {
    return {
      status: "error",
      error:
        "This PMR/TMR number was registered under a different email. Sign in with that email to reapply, or contact the MMA secretariat.",
    };
  }
  if (numberHolder) {
    return {
      status: "error",
      error:
        "This PMR/TMR number is already registered. Sign in instead, or contact the MMA secretariat.",
    };
  }

  // Passwordless create (decision 2026-07-04): user + profile row now,
  // verification email out, password set on AU8 after the link is clicked.
  // Attempt 1 is logged by the handle_new_user() trigger.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await auth.signUpWithEmailLink(
    input.email,
    {
      full_name: input.fullName,
      // Country code + national digits joined for storage: "+960 7771234"
      phone,
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

  // The auth user (and profile, via trigger) now exist. Specialty and
  // workplace are NOT collected here any more (2026-09-08) — the
  // practitioner fills them in on /profile, where they stay editable.
  return { status: "success", error: null };
}
