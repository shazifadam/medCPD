"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";

/**
 * AT2 → AT3/AT4/AT5 — self check-in outcomes (decision 2026-07-18):
 * - registered + attested → attendance VERIFIED (self-attested) + a PENDING
 *   cpd_entry priced via event_credit_for_role → "awarded" (AT3). Matches
 *   EV3 copy: "Auto-logged on check-in; verified by MMA within 7 days" —
 *   MMA review happens on the ENTRY, not the attendance.
 * - not registered, event's sub-category requires pre-registration →
 *   attendance recorded pending, NO entry → "no_credit" (AT5).
 * - not registered otherwise → attendance pending, organizer verifies later
 *   → "pending" (AT4).
 */
export type CheckInResult = {
  outcome: "awarded" | "pending" | "no_credit" | "error";
  credits: number | null;
  error: string | null;
};

export async function checkInAction(eventId: string): Promise<CheckInResult> {
  const identity = await getIdentity();
  if (!identity) return { outcome: "error", credits: null, error: "Session expired." };
  const uid = identity.user.id;

  const [event] = await sql<
    {
      id: string;
      activity_type_id: string;
      cycle_id: string | null;
      prereg_required: boolean;
      registration_id: string | null;
      already_verified: boolean;
    }[]
  >`
    select
      e.id, e.activity_type_id, e.cycle_id,
      coalesce(sc.pre_registration = 'required', false) as prereg_required,
      (select r.id from event_registrations r
        where r.event_id = e.id and r.practitioner_id = ${uid}
          and r.status = 'confirmed' limit 1) as registration_id,
      exists (
        select 1 from event_attendances a
        where a.event_id = e.id and a.practitioner_id = ${uid}
          and a.status = 'verified'
      ) as already_verified
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_subcategories sc on sc.id = at.subcategory_id
    where e.id = ${eventId} and e.status in ('approved', 'completed')
    limit 1
  `;
  if (!event) {
    return { outcome: "error", credits: null, error: "This event isn't open for check-in." };
  }
  if (event.already_verified) {
    return { outcome: "error", credits: null, error: "You've already checked in to this event." };
  }

  // Unregistered walk-ins: record the attendance fact, no credit path yet.
  if (!event.registration_id) {
    await sql`
      insert into event_attendances
        (event_id, practitioner_id, role_label, status, method, created_by)
      values (${eventId}, ${uid}, 'attendee', 'pending', 'self_check_in', ${uid})
    `;
    revalidatePath("/events");
    return {
      outcome: event.prereg_required ? "no_credit" : "pending",
      credits: null,
      error: null,
    };
  }

  // Registered: resolve credit from the active accreditation.
  const [alloc] = await sql<
    {
      category_id: string;
      credits: string;
      max_per_attendee: string | null;
      accreditation_id: string;
      allocation_id: string;
    }[]
  >`
    select f.category_id, f.credits, f.max_per_attendee, f.accreditation_id,
      (select a.id from event_credit_allocations a
        where a.accreditation_id = f.accreditation_id
          and a.category_id = f.category_id
          and a.role_label is not distinct from 'attendee'::participant_role
        limit 1) as allocation_id
    from event_credit_for_role(${eventId}, 'attendee') f
  `;
  if (!alloc) {
    // Approved event without an active accreditation — record, verify later.
    await sql`
      insert into event_attendances
        (event_id, practitioner_id, registration_id, role_label, status, method, created_by)
      values (${eventId}, ${uid}, ${event.registration_id}, 'attendee', 'pending', 'self_check_in', ${uid})
    `;
    revalidatePath("/events");
    return { outcome: "pending", credits: null, error: null };
  }

  const raw = Number(alloc.credits);
  const cap = alloc.max_per_attendee != null ? Number(alloc.max_per_attendee) : null;
  const credits = cap != null ? Math.min(raw, cap) : raw;

  // Verification → credit-entry contract (schema 5b): both writes, one tx.
  await sql.begin(async (tx) => {
    const [att] = await tx<{ id: string }[]>`
      insert into event_attendances
        (event_id, practitioner_id, registration_id, role_label, status, method,
         verified_at, verified_by, created_by)
      values (${eventId}, ${uid}, ${event.registration_id}, 'attendee', 'verified',
              'self_check_in', now(), ${uid}, ${uid})
      returning id
    `;
    await tx`
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id, activity_type_id,
         credits, event_id, attendance_id, accreditation_id, allocation_id,
         role_label, framework_rule_id, calc_inputs, created_by)
      values (
        ${uid}, 'event_attendance', 'pending',
        coalesce(${event.cycle_id}, (select id from cpd_cycles where is_current limit 1)),
        ${alloc.category_id}, ${event.activity_type_id}, ${credits},
        ${eventId}, ${att.id}, ${alloc.accreditation_id}, ${alloc.allocation_id},
        'attendee', null,
        ${JSON.stringify({
          method: "event_allocation",
          allocation_credits: raw,
          ...(cap != null ? { max_per_attendee: cap } : {}),
        })}::jsonb,
        ${uid}
      )
    `;
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/my-cpd");
  return { outcome: "awarded", credits, error: null };
}
