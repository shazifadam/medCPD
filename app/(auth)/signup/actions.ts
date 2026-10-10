"use server";

import { signUpSchema } from "@/lib/schemas";
import { formatPhone, DEFAULT_DIAL_CODE } from "@/lib/phone";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { RegistrationState } from "@/lib/auth/identity";
import { openNewAttempt, type AttemptSnapshot } from "@/lib/registration";

export type SignUpState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

type ProfileMatch = {
  id: string;
  email: string;
  registration_state: RegistrationState;
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/auth/callback?next=/set-password`;

  // Never create a duplicate profile. A profile is matched by email (the
  // account identity) or by PMR/TMR number (UNIQUE column). Pending and
  // verified matches block the signup and stay untouched; a REJECTED match
  // is reused: same profile id, details refreshed, back to pending, new
  // attempt logged (decision 2026-10-10, replaces the sign-in-to-reapply
  // routing for the signup form).
  const [byEmail, byNumber] = await Promise.all([
    sql<ProfileMatch[]>`
      select id, email, registration_state from profiles
      where email = ${input.email}
      limit 1
    `,
    sql<ProfileMatch[]>`
      select id, email, registration_state from profiles
      where mmdc_registration = ${input.mmdcRegistration}
      limit 1
    `,
  ]);
  const emailMatch = byEmail[0];
  const numberMatch = byNumber[0];

  if (emailMatch?.registration_state === "verified") {
    return {
      status: "error",
      error: "This email is already registered. Sign in instead.",
    };
  }
  if (emailMatch?.registration_state === "pending") {
    return {
      status: "error",
      error:
        "An application for this email is already under review. Sign in to check its status.",
    };
  }
  // The number's holder is a different profile than the email's (or the
  // email is new): it blocks unless that holder is itself rejected and can
  // be reused below.
  if (numberMatch && numberMatch.id !== emailMatch?.id) {
    if (numberMatch.registration_state !== "rejected") {
      return {
        status: "error",
        error:
          "This PMR/TMR number is already registered. Sign in instead, or contact the MMA secretariat.",
      };
    }
    if (emailMatch) {
      // Two different rejected profiles match (one by email, one by number).
      // Reusing either would collide on the other's unique column.
      return {
        status: "error",
        error:
          "This PMR/TMR number was registered under a different email. Contact the MMA secretariat to merge your applications.",
      };
    }
  }

  const reuse = emailMatch ?? numberMatch;
  if (reuse) {
    return reuseRejectedProfile(reuse, input, phone, redirectTo);
  }

  // Passwordless create (decision 2026-07-04): user + profile row now,
  // verification email out, password set on AU8 after the link is clicked.
  // Attempt 1 is logged by the handle_new_user() trigger.
  const { error } = await auth.signUpWithEmailLink(
    input.email,
    {
      full_name: input.fullName,
      // Country code + national digits joined for storage: "+960 7771234"
      phone,
      mmdc_registration: input.mmdcRegistration,
      mmdc_registration_type: input.mmdcRegistrationType,
    },
    redirectTo
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

/**
 * A rejected applicant signing up again (same email, or same PMR/TMR number
 * under a new email) gets their existing profile back: details refreshed,
 * state back to `pending`, a new `signup` attempt logged. When the email
 * changed, the auth user is moved to it inside the same transaction so the
 * two never diverge; then the normal verification link goes out.
 */
async function reuseRejectedProfile(
  profile: ProfileMatch,
  input: {
    fullName: string;
    email: string;
    mmdcRegistration: string;
    mmdcRegistrationType: "PMR" | "TMR";
  },
  phone: string,
  redirectTo: string
): Promise<SignUpState> {
  const snap: AttemptSnapshot = {
    fullName: input.fullName,
    email: input.email,
    phone,
    mmdcRegistration: input.mmdcRegistration,
    mmdcRegistrationType: input.mmdcRegistrationType,
  };
  const emailChanged = profile.email.toLowerCase() !== input.email.toLowerCase();

  try {
    await sql.begin(async (tx) => {
      const moved = await tx<{ id: string }[]>`
        update profiles set
          email = ${input.email},
          full_name = ${input.fullName},
          phone = ${phone},
          mmdc_registration = ${input.mmdcRegistration},
          mmdc_registration_type = ${input.mmdcRegistrationType},
          registration_state = 'pending',
          rejection_reason = null,
          verified_at = null,
          verified_by = null
        where id = ${profile.id} and registration_state = 'rejected'
        returning id
      `;
      // A concurrent submit (or an admin decision in between) means the
      // profile is no longer rejected: write nothing.
      if (moved.length === 0) throw new Error("profile is no longer rejected");
      await openNewAttempt(tx, profile.id, "signup", snap);
      if (emailChanged) {
        // Last inside the transaction: a failure here rolls the profile
        // back, so auth.users and profiles keep the same address.
        const { error } = await auth.updateUserEmail(profile.id, input.email);
        if (error) throw new Error(`auth email update failed: ${error}`);
      }
    });
  } catch (err) {
    console.error("[signup] reuse of rejected profile failed:", err);
    return {
      status: "error",
      error: "Couldn't create your account. Please try again.",
    };
  }

  const { error } = await auth.signUpWithEmailLink(
    input.email,
    {
      full_name: input.fullName,
      phone,
      mmdc_registration: input.mmdcRegistration,
      mmdc_registration_type: input.mmdcRegistrationType,
    },
    redirectTo
  );
  if (error) {
    // The application is already resubmitted; only the link failed.
    console.error("[signup] verification link after reuse failed:", error);
    return {
      status: "error",
      error:
        "Your application was resubmitted, but the verification email couldn't be sent. Use 'Forgot password' on the sign-in page to get a link.",
    };
  }
  return { status: "success", error: null };
}
