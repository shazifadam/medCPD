"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity, hasRole, type Identity } from "@/lib/auth/identity";

export type CommitteeActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

async function requireCommittee(): Promise<Identity | null> {
  const identity = await getIdentity();
  if (
    !identity ||
    (!hasRole(identity, "cpd_committee") && !hasRole(identity, "mma_admin"))
  ) {
    return null;
  }
  return identity;
}

/**
 * IR3/IR4 — decide a pending entry. "approve" keeps the claimed credits;
 * "adjust" overwrites credits (and optionally category) with a reason;
 * "reject" needs a reason. All paths stamp the review metadata.
 */
export async function reviewEntryAction(input: {
  entryId: string;
  decision: "approve" | "adjust" | "reject";
  credits?: number;
  categoryId?: string;
  comments?: string;
}): Promise<CommitteeActionState> {
  const identity = await requireCommittee();
  if (!identity) return { status: "error", error: "Not authorized." };

  const comments = input.comments?.trim() || null;
  if (input.decision === "reject" && !comments) {
    return { status: "error", error: "A rejection reason is required." };
  }
  if (input.decision === "adjust") {
    if (input.credits == null || Number.isNaN(input.credits) || input.credits < 0) {
      return { status: "error", error: "Enter the approved credits." };
    }
    if (!comments) {
      return { status: "error", error: "An adjustment reason is required." };
    }
  }

  const rows =
    input.decision === "reject"
      ? await sql<{ id: string }[]>`
          update cpd_entries
          set status = 'rejected',
              reviewed_at = now(), reviewed_by = ${identity.user.id},
              review_comments = ${comments},
              updated_by = ${identity.user.id}
          where id = ${input.entryId} and status = 'pending'
          returning id
        `
      : input.decision === "adjust"
        ? await sql<{ id: string }[]>`
            update cpd_entries
            set status = 'approved',
                credits = ${input.credits!}::numeric,
                category_id = coalesce(${input.categoryId ?? null}::uuid, category_id),
                reviewed_at = now(), reviewed_by = ${identity.user.id},
                review_comments = ${comments},
                calc_inputs = calc_inputs
                  || jsonb_build_object('committee_adjusted_credits', ${input.credits!}::numeric),
                updated_by = ${identity.user.id}
            where id = ${input.entryId} and status = 'pending'
            returning id
          `
        : await sql<{ id: string }[]>`
            update cpd_entries
            set status = 'approved',
                reviewed_at = now(), reviewed_by = ${identity.user.id},
                review_comments = ${comments},
                updated_by = ${identity.user.id}
            where id = ${input.entryId} and status = 'pending'
            returning id
          `;
  if (rows.length === 0) {
    return { status: "error", error: "Only pending entries can be reviewed." };
  }

  revalidatePath("/committee/entries");
  return { status: "success", error: null };
}

/**
 * ER4/ER5/ER6 — decide an accreditation request. Approve creates the
 * accreditation + allocation and flips the event in ONE transaction
 * (schema 4d atomicity contract: status change + review row together).
 * "Request revisions" lands on rejected per 4d (organizer resubmits).
 */
export async function reviewEventAction(input: {
  eventId: string;
  decision: "approve" | "reject" | "revisions";
  credits?: number;
  categoryId?: string;
  comments?: string;
}): Promise<CommitteeActionState> {
  const identity = await requireCommittee();
  if (!identity) return { status: "error", error: "Not authorized." };

  const comments = input.comments?.trim() || null;
  if (input.decision !== "approve" && !comments) {
    return { status: "error", error: "A reason is required." };
  }
  if (
    input.decision === "approve" &&
    (input.credits == null || Number.isNaN(input.credits) || input.credits < 0 ||
      !input.categoryId)
  ) {
    return { status: "error", error: "Approved credits and category are required." };
  }

  const [event] = await sql<{ id: string; status: string; starts_at: Date }[]>`
    select id, status, starts_at from events
    where id = ${input.eventId}
      and status in ('submitted', 'under_review')
    limit 1
  `;
  if (!event) {
    return { status: "error", error: "Only submitted events can be reviewed." };
  }

  try {
    await sql.begin(async (tx) => {
      if (input.decision === "approve") {
        await tx`
          update events
          set status = 'approved',
              cycle_id = coalesce(
                cycle_id,
                (select id from cpd_cycles
                  where ${event.starts_at} between starts_on and ends_on
                  limit 1),
                (select id from cpd_cycles where is_current limit 1)
              ),
              updated_by = ${identity.user.id}
          where id = ${input.eventId}
        `;
        const [acc] = await tx<{ id: string }[]>`
          insert into event_accreditations
            (event_id, accreditation_number, accredited_by, created_by)
          values (
            ${input.eventId},
            'MMA-CPD-' || to_char(now(), 'YYYY') || '-' ||
              lpad((select count(*) + 1 from event_accreditations
                     where accreditation_number like
                       'MMA-CPD-' || to_char(now(), 'YYYY') || '-%')::text, 4, '0'),
            ${identity.user.id}, ${identity.user.id}
          )
          returning id
        `;
        await tx`
          insert into event_credit_allocations
            (accreditation_id, category_id, role_label, credits, created_by)
          values (${acc.id}, ${input.categoryId!}, null, ${input.credits!},
                  ${identity.user.id})
        `;
        await tx`
          insert into event_reviews
            (event_id, reviewer_id, action, comments, from_status, to_status)
          values (${input.eventId}, ${identity.user.id}, 'approved',
                  ${comments}, ${event.status}::event_status, 'approved')
        `;
      } else {
        const action =
          input.decision === "revisions" ? "requested_revisions" : "rejected";
        await tx`
          update events
          set status = 'rejected', updated_by = ${identity.user.id}
          where id = ${input.eventId}
        `;
        await tx`
          insert into event_reviews
            (event_id, reviewer_id, action, comments, from_status, to_status)
          values (${input.eventId}, ${identity.user.id},
                  ${action}::event_review_action,
                  ${comments}, ${event.status}::event_status, 'rejected')
        `;
      }
    });
  } catch {
    return { status: "error", error: "Couldn't record the decision. Try again." };
  }

  revalidatePath("/committee/events");
  revalidatePath("/events");
  return { status: "success", error: null };
}

/**
 * AI3 — revoke an accreditation: flips the accreditation to revoked and
 * rejects every credit entry that rode on it (design copy: "credits will
 * be withdrawn from their records"), in one transaction.
 */
export async function revokeAccreditationAction(input: {
  accreditationId: string;
  reason: string;
  details?: string;
}): Promise<CommitteeActionState> {
  const identity = await requireCommittee();
  if (!identity) return { status: "error", error: "Not authorized." };

  const fullReason = [input.reason.trim(), input.details?.trim()]
    .filter(Boolean)
    .join(" — ");
  if (!fullReason) return { status: "error", error: "A reason is required." };

  try {
    await sql.begin(async (tx) => {
      const revoked = await tx<{ id: string }[]>`
        update event_accreditations
        set status = 'revoked', revoked_at = now(),
            revoked_by = ${identity.user.id},
            revocation_reason = ${fullReason},
            updated_by = ${identity.user.id}
        where id = ${input.accreditationId} and status = 'active'
        returning id
      `;
      if (revoked.length === 0) throw new Error("not active");
      await tx`
        update cpd_entries
        set status = 'rejected', credits = 0,
            reviewed_at = now(), reviewed_by = ${identity.user.id},
            review_comments = ${"Accreditation revoked: " + fullReason},
            updated_by = ${identity.user.id}
        where accreditation_id = ${input.accreditationId}
          and status <> 'rejected'
      `;
    });
  } catch {
    return {
      status: "error",
      error: "Only active accreditations can be revoked.",
    };
  }

  revalidatePath("/committee/audit");
  return { status: "success", error: null };
}
