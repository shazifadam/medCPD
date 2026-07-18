"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getIdentity } from "@/lib/auth/identity";

export type EventActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
};

/** EV4/EV5 — register for an approved event (capacity-checked). */
export async function registerForEventAction(
  eventId: string
): Promise<EventActionState> {
  const identity = await getIdentity();
  if (!identity) return { status: "error", error: "Session expired." };

  const [event] = await sql<
    { id: string; capacity: number | null; registered: number }[]
  >`
    select e.id, e.capacity,
      (select count(*)::int from event_registrations r
        where r.event_id = e.id and r.status = 'confirmed') as registered
    from events e
    where e.id = ${eventId} and e.status in ('approved', 'completed')
    for update of e
  `;
  if (!event) return { status: "error", error: "This event isn't open for registration." };
  if (event.capacity != null && event.registered >= event.capacity) {
    return { status: "error", error: "This event is at capacity." };
  }

  await sql`
    insert into event_registrations (event_id, practitioner_id, role_label, status, confirmed_at, created_by)
    values (${eventId}, ${identity.user.id}, 'attendee', 'confirmed', now(), ${identity.user.id})
    on conflict (event_id, practitioner_id, role_label) where status <> 'cancelled'
    do nothing
  `;

  revalidatePath("/events");
  return { status: "success", error: null };
}

/** EV5 — cancel my registration (status flip, never a hard delete). */
export async function cancelRegistrationAction(
  eventId: string
): Promise<EventActionState> {
  const identity = await getIdentity();
  if (!identity) return { status: "error", error: "Session expired." };

  await sql`
    update event_registrations
    set status = 'cancelled', cancelled_at = now(),
        cancellation_reason = 'Cancelled by practitioner',
        updated_by = ${identity.user.id}
    where event_id = ${eventId}
      and practitioner_id = ${identity.user.id}
      and status = 'confirmed'
  `;

  revalidatePath("/events");
  return { status: "success", error: null };
}
