"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { DEFAULT_GRANT_ROLE, isGrantableRole } from "@/lib/roles";
import {
  sendBrandedEmail,
  registrationApprovedEmail,
  registrationRejectedEmail,
} from "@/lib/email/branded";

export type ApprovalActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

/**
 * RA3 — approve: verify the profile and grant the selected role
 * (practitioner unless the admin picks another in the dialog).
 */
export async function approveApplicantAction(
  applicantId: string,
  role: string = DEFAULT_GRANT_ROLE
): Promise<ApprovalActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  // Never trust the client with an enum value that reaches SQL.
  if (!isGrantableRole(role)) {
    return { status: "error", error: "Unknown role." };
  }

  const updated = await sql<{ id: string; email: string; full_name: string }[]>`
    update profiles
    set registration_state = 'verified',
        verified_at = now(),
        verified_by = ${identity.user.id},
        rejection_reason = null
    where id = ${applicantId} and registration_state <> 'verified'
    returning id, email, full_name
  `;
  if (updated.length === 0) {
    return { status: "error", error: "Applicant is already verified." };
  }
  await sendBrandedEmail(
    updated[0].email,
    "Your registration is approved — Gradus CPD",
    registrationApprovedEmail(updated[0].full_name)
  );

  await sql`
    insert into role_assignments (user_id, role, granted_by)
    select ${applicantId}, ${role}::user_role, ${identity.user.id}
    where not exists (
      select 1 from role_assignments
      where user_id = ${applicantId}
        and role = ${role}::user_role
        and revoked_at is null
    )
  `;

  revalidatePath("/admin/approvals");
  return { status: "success", error: null };
}

/** RA4 — reject with a reason surfaced to the applicant. */
export async function rejectApplicantAction(
  applicantId: string,
  reason: string,
  details: string
): Promise<ApprovalActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  const fullReason = [reason.trim(), details.trim()]
    .filter(Boolean)
    .join(" — ");
  if (!fullReason) {
    return { status: "error", error: "A rejection reason is required." };
  }

  const updated = await sql<{ id: string; email: string; full_name: string }[]>`
    update profiles
    set registration_state = 'rejected',
        rejection_reason = ${fullReason},
        verified_at = null,
        verified_by = null
    where id = ${applicantId} and registration_state = 'pending'
    returning id, email, full_name
  `;
  if (updated.length === 0) {
    return { status: "error", error: "Only pending applications can be rejected." };
  }
  await sendBrandedEmail(
    updated[0].email,
    "Update on your registration — Gradus CPD",
    registrationRejectedEmail(updated[0].full_name, fullReason)
  );

  revalidatePath("/admin/approvals");
  return { status: "success", error: null };
}
