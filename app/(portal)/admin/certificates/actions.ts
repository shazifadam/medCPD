"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole, type Identity } from "@/lib/auth/identity";
import { ensureCycleCertificate } from "@/lib/certificates";

export type CertificateActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

async function requireAdmin(): Promise<Identity | null> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) return null;
  return identity;
}

/**
 * CA2 — manually issue a certificate. Event kind needs an existing
 * attendance + active accreditation for the pair (the certificate CHECK
 * demands the full event chain); credits come from the admin's input.
 * Cycle kind rides the same issue path as DB3 (requires a complete cycle).
 */
export async function issueCertificateAction(input: {
  practitionerId: string;
  kind: "event_attendance" | "cycle_completion";
  eventId?: string;
  credits?: number;
  note?: string;
}): Promise<CertificateActionState> {
  const identity = await requireAdmin();
  if (!identity) return { status: "error", error: "Not authorized." };

  if (input.kind === "cycle_completion") {
    const id = await ensureCycleCertificate(input.practitionerId);
    if (!id) {
      return {
        status: "error",
        error: "That practitioner has not completed the current cycle.",
      };
    }
    revalidatePath("/admin/certificates");
    return { status: "success", error: null };
  }

  if (!input.eventId) {
    return { status: "error", error: "Pick the linked event." };
  }
  if (
    input.credits == null ||
    Number.isNaN(input.credits) ||
    input.credits < 0
  ) {
    return { status: "error", error: "Enter the credits to certify." };
  }

  const [src] = await sql<
    {
      attendance_id: string;
      role_label: string;
      accreditation_id: string;
      accreditation_number: string;
      event_id: string;
      title: string;
      starts_at: Date;
      ends_at: Date;
      venue_name: string | null;
      practitioner_id: string;
      full_name: string;
      mmdc_registration: string | null;
      category_code: string;
      category_name: string;
    }[]
  >`
    select a.id as attendance_id, a.role_label,
           acc.id as accreditation_id, acc.accreditation_number,
           ev.id as event_id, ev.title, ev.starts_at, ev.ends_at, ev.venue_name,
           p.id as practitioner_id, p.full_name, p.mmdc_registration,
           cc.code as category_code, cc.name as category_name
    from event_attendances a
    join events ev on ev.id = a.event_id
    join event_accreditations acc
      on acc.event_id = ev.id and acc.status = 'active'
    join event_credit_allocations al on al.accreditation_id = acc.id
    join credit_categories cc on cc.id = al.category_id
    join profiles p on p.id = a.practitioner_id
    where a.practitioner_id = ${input.practitionerId}
      and a.event_id = ${input.eventId}
    limit 1
  `;
  if (!src) {
    return {
      status: "error",
      error:
        "No attendance found for that practitioner and event (an active accreditation is also required).",
    };
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const payload = {
    practitioner: {
      id: src.practitioner_id,
      display_name: src.full_name,
      mmdc_number: src.mmdc_registration,
    },
    event: {
      id: src.event_id,
      title: src.title,
      starts_on: iso(src.starts_at),
      ends_on: iso(src.ends_at),
      venue: src.venue_name,
      accreditation_number: src.accreditation_number,
    },
    credits: [
      {
        category_code: src.category_code,
        category_name: src.category_name,
        credits: input.credits,
        role_label: src.role_label,
      },
    ],
    ...(input.note?.trim() ? { issue_note: input.note.trim() } : {}),
  };

  try {
    await sql.begin(async (tx) => {
      const year = new Date().getFullYear();
      const like = `GRD-EV-${year}-%`;
      const [{ n }] = await tx<{ n: string }[]>`
        select count(*) + 1 as n from certificates
        where certificate_number like ${like}
      `;
      await tx`
        insert into certificates
          (certificate_number, kind, practitioner_id, event_id,
           attendance_id, accreditation_id, issued_by, created_by, payload)
        values (
          ${"GRD-EV-" + year + "-" + String(n).padStart(6, "0")},
          'event_attendance', ${input.practitionerId}, ${src.event_id},
          ${src.attendance_id}, ${src.accreditation_id},
          ${identity.user.id}, ${identity.user.id},
          ${sql.json(payload)})
      `;
    });
  } catch {
    return {
      status: "error",
      error:
        "Couldn't issue — an active certificate may already exist for that practitioner and event.",
    };
  }

  revalidatePath("/admin/certificates");
  return { status: "success", error: null };
}

/**
 * CA3 / AI4 — revoke a certificate (active → revoked). Design copy: public
 * verification shows it as revoked and the linked credits are withdrawn —
 * for event certificates the riding entry is rejected + zeroed (same
 * pattern as accreditation revocation in P5).
 */
export async function revokeCertificateAction(input: {
  certificateId: string;
  reason: string;
  details?: string;
}): Promise<CertificateActionState> {
  const identity = await getIdentity();
  if (
    !identity ||
    (!hasRole(identity, "mma_admin") && !hasRole(identity, "cpd_committee"))
  ) {
    return { status: "error", error: "Not authorized." };
  }

  const fullReason = [input.reason.trim(), input.details?.trim()]
    .filter(Boolean)
    .join(" — ");
  if (!fullReason) return { status: "error", error: "A reason is required." };

  try {
    await sql.begin(async (tx) => {
      const revoked = await tx<
        { id: string; kind: string; attendance_id: string | null }[]
      >`
        update certificates
        set status = 'revoked', revoked_at = now(),
            revoked_by = ${identity.user.id},
            revocation_reason = ${fullReason},
            updated_by = ${identity.user.id}
        where id = ${input.certificateId} and status = 'active'
        returning id, kind, attendance_id
      `;
      if (revoked.length === 0) throw new Error("not active");
      const cert = revoked[0];
      if (cert.kind === "event_attendance" && cert.attendance_id) {
        await tx`
          update cpd_entries
          set status = 'rejected', credits = 0,
              reviewed_at = now(), reviewed_by = ${identity.user.id},
              review_comments = ${"Certificate revoked: " + fullReason},
              updated_by = ${identity.user.id}
          where attendance_id = ${cert.attendance_id}
            and status <> 'rejected'
        `;
      }
    });
  } catch {
    return {
      status: "error",
      error: "Only active certificates can be revoked.",
    };
  }

  revalidatePath("/admin/certificates");
  return { status: "success", error: null };
}
