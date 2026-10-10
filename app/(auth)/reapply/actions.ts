"use server";

import { reapplySchema } from "@/lib/schemas";
import { formatPhone, DEFAULT_DIAL_CODE } from "@/lib/phone";
import { getIdentity } from "@/lib/auth/identity";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { openNewAttempt, type AttemptSnapshot } from "@/lib/registration";

export type ReapplyState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

/**
 * /reapply — a rejected practitioner corrects their details and resubmits.
 * The SAME profile row goes back to `pending` and a new registration
 * attempt (`reapply`) is logged; no second account is ever created.
 */
export async function reapplyAction(
  _prev: ReapplyState,
  formData: FormData
): Promise<ReapplyState> {
  const identity = await getIdentity();
  if (!identity) return { status: "error", error: "Not signed in." };
  if (identity.registrationState !== "rejected") {
    return {
      status: "error",
      error: "Your application is not in a rejected state.",
    };
  }

  const parsed = reapplySchema.safeParse({
    fullName: formData.get("fullName"),
    mmdcRegistration: formData.get("mmdcRegistration"),
    mmdcRegistrationType: formData.get("mmdcRegistrationType"),
    phoneDialCode: formData.get("phoneDialCode") || DEFAULT_DIAL_CODE,
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    console.error(
      "[reapply] validation failed:",
      JSON.stringify(parsed.error.flatten().fieldErrors)
    );
    return { status: "error", error: "Please correct the highlighted fields." };
  }
  const input = parsed.data;
  const me = identity.user.id;

  const current = await sql<{ email: string; mmdc_registration: string | null }[]>`
    select email, mmdc_registration from profiles where id = ${me} limit 1
  `;
  if (current.length === 0) return { status: "error", error: "Not signed in." };

  // A changed number must not collide with another account (UNIQUE column).
  if (current[0].mmdc_registration !== input.mmdcRegistration) {
    const taken = await sql<{ id: string }[]>`
      select id from profiles
      where mmdc_registration = ${input.mmdcRegistration} and id <> ${me}
      limit 1
    `;
    if (taken.length > 0) {
      return {
        status: "error",
        error:
          "This PMR/TMR number is registered to another account. Contact the MMA secretariat.",
      };
    }
  }

  const phone = formatPhone(input.phoneDialCode, input.phone);
  const snap: AttemptSnapshot = {
    fullName: input.fullName,
    email: current[0].email,
    phone,
    mmdcRegistration: input.mmdcRegistration,
    mmdcRegistrationType: input.mmdcRegistrationType,
  };

  try {
    await sql.begin(async (tx) => {
      const moved = await tx<{ id: string }[]>`
        update profiles set
          full_name = ${input.fullName},
          phone = ${phone},
          mmdc_registration = ${input.mmdcRegistration},
          mmdc_registration_type = ${input.mmdcRegistrationType},
          registration_state = 'pending',
          rejection_reason = null,
          verified_at = null,
          verified_by = null
        where id = ${me} and registration_state = 'rejected'
        returning id
      `;
      // A double submit (second tab, repeated click) matches no row once the
      // first one has moved the profile to pending: log nothing extra.
      if (moved.length === 0) throw new Error("profile is no longer rejected");
      await openNewAttempt(tx, me, "reapply", snap);
    });
  } catch (err) {
    console.error("[reapply] resubmit failed:", err);
    return {
      status: "error",
      error: "Couldn't resubmit your application. Please try again.",
    };
  }

  revalidatePath("/admin/approvals");
  return { status: "success", error: null };
}
