"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";

export type AdminEventActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** EM1–EM4 (compressed) — create a draft event. */
export async function createEventAction(
  _prev: AdminEventActionState,
  formData: FormData
): Promise<AdminEventActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const activityTypeId = String(formData.get("activityTypeId") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (!title || title.length < 3) {
    return { status: "error", error: "Event title is required." };
  }
  if (!activityTypeId) {
    return { status: "error", error: "Select an activity type." };
  }
  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
    return { status: "error", error: "End must be after start." };
  }
  if (capacity != null && (Number.isNaN(capacity) || capacity <= 0)) {
    return { status: "error", error: "Capacity must be a positive number." };
  }
  if (!venue) {
    return { status: "error", error: "Venue is required for in-person events." };
  }

  // Slug uniqueness: numeric suffix on collision (schema 4a convention).
  const base = slugify(title);
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from events where slug like ${base + "%"}
  `;
  const slug = n === 0 ? base : `${base}-${n + 1}`;

  const [event] = await sql<{ id: string }[]>`
    insert into events
      (title, slug, description, activity_type_id, status, venue_name,
       starts_at, ends_at, capacity, is_public, created_by)
    values
      (${title}, ${slug}, ${description || null}, ${activityTypeId}, 'draft',
       ${venue}, ${startsAt}, ${endsAt}, ${capacity}, true,
       ${identity.user.id})
    returning id
  `;

  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}`);
}

/** EM4 — submit a draft (or revised rejected) event for accreditation. */
export async function submitEventAction(
  eventId: string
): Promise<AdminEventActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  const rows = await sql<{ id: string }[]>`
    update events
    set status = 'submitted', submitted_at = now(),
        submitted_by = ${identity.user.id}, updated_by = ${identity.user.id}
    where id = ${eventId} and status in ('draft', 'rejected')
    returning id
  `;
  if (rows.length === 0) {
    return { status: "error", error: "Only draft events can be submitted." };
  }
  revalidatePath("/admin/events");
  revalidatePath("/committee/events");
  return { status: "success", error: null };
}

/** EM5 — cancel an event (status flip; terminal). */
export async function cancelEventAction(
  eventId: string
): Promise<AdminEventActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  const rows = await sql<{ id: string }[]>`
    update events
    set status = 'cancelled', updated_by = ${identity.user.id}
    where id = ${eventId} and status not in ('completed', 'cancelled')
    returning id
  `;
  if (rows.length === 0) {
    return { status: "error", error: "This event can no longer be cancelled." };
  }
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { status: "success", error: null };
}

/** EM6 — remove (cancel) a registration from the roster. */
export async function removeRegistrationAction(
  registrationId: string
): Promise<AdminEventActionState> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized." };
  }
  await sql`
    update event_registrations
    set status = 'cancelled', cancelled_at = now(),
        cancellation_reason = 'Removed by admin',
        updated_by = ${identity.user.id}
    where id = ${registrationId} and status <> 'cancelled'
  `;
  revalidatePath("/admin/events");
  return { status: "success", error: null };
}

/**
 * EM7 — verify attendance & award credits. For each selected practitioner:
 * verify their pending attendance (or record an organizer-marked one), and
 * create the event-derived pending credit entry if none exists — the
 * verification → credit-entry contract from schema 5b.
 */
export async function verifyAttendanceAction(
  eventId: string,
  practitionerIds: string[]
): Promise<AdminEventActionState & { awarded: number }> {
  const identity = await getIdentity();
  if (!identity || !hasRole(identity, "mma_admin")) {
    return { status: "error", error: "Not authorized.", awarded: 0 };
  }
  if (practitionerIds.length === 0) {
    return { status: "error", error: "Select at least one attendee.", awarded: 0 };
  }

  const [event] = await sql<
    { id: string; activity_type_id: string; cycle_id: string | null }[]
  >`
    select id, activity_type_id, cycle_id from events
    where id = ${eventId} and status in ('approved', 'completed')
    limit 1
  `;
  if (!event) {
    return {
      status: "error",
      error: "Only accredited events can award credits.",
      awarded: 0,
    };
  }

  const [alloc] = await sql<
    {
      category_id: string;
      credits: string;
      max_per_attendee: string | null;
      accreditation_id: string;
      allocation_id: string | null;
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
    return {
      status: "error",
      error: "This event has no active credit allocation.",
      awarded: 0,
    };
  }
  const raw = Number(alloc.credits);
  const cap =
    alloc.max_per_attendee != null ? Number(alloc.max_per_attendee) : null;
  const credits = cap != null ? Math.min(raw, cap) : raw;

  let awarded = 0;
  for (const pid of practitionerIds) {
    await sql.begin(async (tx) => {
      const [existing] = await tx<{ id: string; status: string }[]>`
        select id, status from event_attendances
        where event_id = ${eventId} and practitioner_id = ${pid}
        order by created_at desc limit 1
      `;
      let attendanceId: string;
      if (existing && existing.status === "verified") {
        attendanceId = existing.id;
      } else if (existing && existing.status === "pending") {
        await tx`
          update event_attendances
          set status = 'verified', verified_at = now(),
              verified_by = ${identity.user.id},
              updated_by = ${identity.user.id}
          where id = ${existing.id}
        `;
        attendanceId = existing.id;
      } else {
        const [created] = await tx<{ id: string }[]>`
          insert into event_attendances
            (event_id, practitioner_id, registration_id, role_label, status,
             method, verified_at, verified_by, created_by)
          values (${eventId}, ${pid},
            (select id from event_registrations
              where event_id = ${eventId} and practitioner_id = ${pid}
                and status = 'confirmed' limit 1),
            'attendee', 'verified', 'organizer_marked', now(),
            ${identity.user.id}, ${identity.user.id})
          returning id
        `;
        attendanceId = created.id;
      }

      const [entry] = await tx<{ id: string }[]>`
        select id from cpd_entries
        where event_id = ${eventId} and practitioner_id = ${pid}
          and source = 'event_attendance'
        limit 1
      `;
      if (!entry) {
        await tx`
          insert into cpd_entries
            (practitioner_id, source, status, cycle_id, category_id,
             activity_type_id, credits, event_id, attendance_id,
             accreditation_id, allocation_id, role_label, calc_inputs,
             created_by)
          values (
            ${pid}, 'event_attendance', 'pending',
            coalesce(${event.cycle_id},
              (select id from cpd_cycles where is_current limit 1)),
            ${alloc.category_id}, ${event.activity_type_id},
            ${credits}::numeric, ${eventId}, ${attendanceId},
            ${alloc.accreditation_id}, ${alloc.allocation_id}, 'attendee',
            ${JSON.stringify({
              method: "event_allocation",
              allocation_credits: raw,
              verified_by_organizer: true,
              ...(cap != null ? { max_per_attendee: cap } : {}),
            })}::jsonb,
            ${identity.user.id}
          )
        `;
        awarded += 1;
      }
    });
  }

  revalidatePath("/admin/events");
  revalidatePath("/committee/entries");
  return { status: "success", error: null, awarded };
}
