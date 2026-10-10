"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { DEFAULT_GRANT_ROLE, isGrantableRole } from "@/lib/roles";
import {
  sendBrandedEmail,
  registrationApprovedEmail,
  registrationRejectedEmail,
  registrationReopenedEmail,
} from "@/lib/email/branded";
import {
  openNewAttempt,
  settleLatestAttempt,
  type AttemptSnapshot,
} from "@/lib/registration";

type ProfileSnapshotRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  mmdc_registration: string | null;
  mmdc_registration_type: "PMR" | "TMR" | null;
  registration_state: "pending" | "verified" | "rejected";
};

function snapshotOf(p: ProfileSnapshotRow): AttemptSnapshot {
  return {
    fullName: p.full_name,
    email: p.email,
    phone: p.phone,
    mmdcRegistration: p.mmdc_registration,
    mmdcRegistrationType: p.mmdc_registration_type,
  };
}

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

  const adminId = identity.user.id;
  const approved = await sql.begin(async (tx) => {
    const current = await tx<ProfileSnapshotRow[]>`
      select id, email, full_name, phone, mmdc_registration,
             mmdc_registration_type, registration_state
      from profiles
      where id = ${applicantId} and registration_state <> 'verified'
      for update
    `;
    const p = current[0];
    if (!p) return null;

    await tx`
      update profiles
      set registration_state = 'verified',
          verified_at = now(),
          verified_by = ${adminId},
          rejection_reason = null
      where id = ${applicantId}
    `;
    // Approving a rejected applicant directly: the latest attempt is
    // already settled as rejected, so log the reversal as a new attempt
    // (reopened by MMA) and settle that one as verified.
    if (p.registration_state === "rejected") {
      await openNewAttempt(tx, applicantId, "admin_reopen", snapshotOf(p));
    }
    await settleLatestAttempt(tx, applicantId, "verified", adminId, null);

    await tx`
      insert into role_assignments (user_id, role, granted_by)
      select ${applicantId}, ${role}::user_role, ${adminId}
      where not exists (
        select 1 from role_assignments
        where user_id = ${applicantId}
          and role = ${role}::user_role
          and revoked_at is null
      )
    `;
    return p;
  });
  if (!approved) {
    return { status: "error", error: "Applicant is already verified." };
  }
  await sendBrandedEmail(
    approved.email,
    "Your registration is approved — Gradus CPD",
    registrationApprovedEmail(approved.full_name)
  );

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

  const adminId = identity.user.id;
  const rejected = await sql.begin(async (tx) => {
    const updated = await tx<{ id: string; email: string; full_name: string }[]>`
      update profiles
      set registration_state = 'rejected',
          rejection_reason = ${fullReason},
          verified_at = null,
          verified_by = null
      where id = ${applicantId} and registration_state = 'pending'
      returning id, email, full_name
    `;
    if (updated.length === 0) return null;
    await settleLatestAttempt(tx, applicantId, "rejected", adminId, fullReason);
    return updated[0];
  });
  if (!rejected) {
    return { status: "error", error: "Only pending applications can be rejected." };
  }
  await sendBrandedEmail(
    rejected.email,
    "Update on your registration — Gradus CPD",
    registrationRejectedEmail(rejected.full_name, fullReason)
  );

  revalidatePath("/admin/approvals");
  return { status: "success", error: null };
}

/**
 * Reopen a rejected application: back to the pending queue as a new
 * attempt (admin_reopen); the earlier decision stays in the history.
 */
export async function reopenApplicantAction(
  applicantId: string
): Promise<ApprovalActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }

  const reopened = await sql.begin(async (tx) => {
    const current = await tx<ProfileSnapshotRow[]>`
      select id, email, full_name, phone, mmdc_registration,
             mmdc_registration_type, registration_state
      from profiles
      where id = ${applicantId} and registration_state = 'rejected'
      for update
    `;
    const p = current[0];
    if (!p) return null;

    await tx`
      update profiles
      set registration_state = 'pending',
          rejection_reason = null,
          verified_at = null,
          verified_by = null
      where id = ${applicantId}
    `;
    await openNewAttempt(tx, applicantId, "admin_reopen", snapshotOf(p));
    return p;
  });
  if (!reopened) {
    return {
      status: "error",
      error: "Only rejected applications can be reopened.",
    };
  }
  await sendBrandedEmail(
    reopened.email,
    "Your registration is being reviewed again — Gradus CPD",
    registrationReopenedEmail(reopened.full_name)
  );

  revalidatePath("/admin/approvals");
  return { status: "success", error: null };
}
