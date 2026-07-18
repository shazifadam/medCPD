import "server-only";
import { sql } from "@/lib/db";

/**
 * EV/AT data layer. Listings show approved/completed public events; the
 * credit line comes from the ACTIVE accreditation's default-role allocation —
 * the same source event-derived credit entries use (event_credit_for_role).
 * "Event by" resolves to the creator's institution (falls back to MMA —
 * the events table has no host-org column by design; organizers own events).
 */

export interface EventCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hostName: string;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  registeredCount: number;
  credits: number | null;
  categoryLabel: string | null; // "Cat 1"
  preRegRequired: boolean;
  isPast: boolean;
  myRegistrationId: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  capacity: number | null;
  host_name: string | null;
  category_code: string | null;
  credits: string | null;
  prereg_required: boolean;
  registered_count: number;
  my_registration_id: string | null;
}

function toCard(r: EventRow, now: Date): EventCard {
  const ends = new Date(r.ends_at);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    hostName: r.host_name ?? "Maldives Medical Association",
    venueName: r.venue_name,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: ends.toISOString(),
    capacity: r.capacity,
    registeredCount: r.registered_count,
    credits: r.credits != null ? Number(r.credits) : null,
    categoryLabel: r.category_code
      ? `Cat ${r.category_code.replace("CAT", "")}`
      : null,
    preRegRequired: r.prereg_required,
    isPast: ends < now,
    myRegistrationId: r.my_registration_id,
  };
}

/** EV1 — approved/completed public events + my registration state. */
export async function listEvents(practitionerId: string): Promise<EventCard[]> {
  const rows = await sql<EventRow[]>`
    select
      e.id, e.slug, e.title, e.description, e.venue_name,
      e.starts_at, e.ends_at, e.capacity,
      host.name as host_name,
      cc.code as category_code,
      alloc.credits,
      coalesce(sc.pre_registration = 'required', false) as prereg_required,
      (select count(*)::int from event_registrations r
        where r.event_id = e.id and r.status = 'confirmed') as registered_count,
      (select r.id from event_registrations r
        where r.event_id = e.id
          and r.practitioner_id = ${practitionerId}
          and r.status = 'confirmed'
        limit 1) as my_registration_id
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_subcategories sc on sc.id = at.subcategory_id
    left join lateral (
      select a.credits, a.category_id
      from event_accreditations acc
      join event_credit_allocations a on a.accreditation_id = acc.id
      where acc.event_id = e.id and acc.status = 'active'
      order by (a.role_label is not null)
      limit 1
    ) alloc on true
    left join credit_categories cc on cc.id = alloc.category_id
    left join lateral (
      select i.name
      from institution_memberships im
      join institutions i on i.id = im.institution_id
      where im.practitioner_id = e.created_by and im.is_active
      limit 1
    ) host on true
    where e.status in ('approved', 'completed') and e.is_public
    order by e.starts_at
  `;
  const now = new Date();
  return rows.map((r) => toCard(r, now));
}

// ---------------------------------------------------------------------------
// EV3 — event detail
// ---------------------------------------------------------------------------

export interface EventSession {
  id: string;
  title: string;
  room: string | null;
  startsAt: string;
}

export interface EventDetail extends EventCard {
  venueAddress: string | null;
  categoryName: string | null; // "Category 1 — Formal Education & Learning"
  sessions: EventSession[];
}

export async function getEventDetail(
  practitionerId: string,
  eventId: string
): Promise<EventDetail | null> {
  const rows = await sql<
    (EventRow & { venue_address: string | null; category_name: string | null })[]
  >`
    select
      e.id, e.slug, e.title, e.description, e.venue_name, e.venue_address,
      e.starts_at, e.ends_at, e.capacity,
      host.name as host_name,
      cc.code as category_code,
      cc.name as category_name,
      alloc.credits,
      coalesce(sc.pre_registration = 'required', false) as prereg_required,
      (select count(*)::int from event_registrations r
        where r.event_id = e.id and r.status = 'confirmed') as registered_count,
      (select r.id from event_registrations r
        where r.event_id = e.id
          and r.practitioner_id = ${practitionerId}
          and r.status = 'confirmed'
        limit 1) as my_registration_id
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_subcategories sc on sc.id = at.subcategory_id
    left join lateral (
      select a.credits, a.category_id
      from event_accreditations acc
      join event_credit_allocations a on a.accreditation_id = acc.id
      where acc.event_id = e.id and acc.status = 'active'
      order by (a.role_label is not null)
      limit 1
    ) alloc on true
    left join credit_categories cc on cc.id = alloc.category_id
    left join lateral (
      select i.name
      from institution_memberships im
      join institutions i on i.id = im.institution_id
      where im.practitioner_id = e.created_by and im.is_active
      limit 1
    ) host on true
    where e.id = ${eventId}
      and e.status in ('approved', 'completed')
      and e.is_public
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const sessions = await sql<
    { id: string; title: string; room: string | null; starts_at: Date | string }[]
  >`
    select id, title, room, starts_at
    from event_sessions
    where event_id = ${eventId}
    order by sequence
  `;

  return {
    ...toCard(row, new Date()),
    venueAddress: row.venue_address,
    categoryName: row.category_name,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      room: s.room,
      startsAt: new Date(s.starts_at).toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// AT1 — my registered events (registration ∪ attendance state per event)
// ---------------------------------------------------------------------------

export type MyEventState =
  | "registered"
  | "checked_in" // verified attendance (credit entry exists)
  | "pending_verification"
  | "no_credit"; // rejected attendance / prereg gate

export interface MyEventRow {
  eventId: string;
  title: string;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  credits: number | null;
  categoryLabel: string | null;
  state: MyEventState;
  entryId: string | null; // credit entry created at check-in, if any
  isPast: boolean;
}

export async function getMyEvents(
  practitionerId: string
): Promise<MyEventRow[]> {
  const rows = await sql<
    {
      event_id: string;
      title: string;
      venue_name: string | null;
      starts_at: Date | string;
      ends_at: Date | string;
      credits: string | null;
      category_code: string | null;
      attendance_status: "pending" | "verified" | "rejected" | null;
      entry_id: string | null;
    }[]
  >`
    select
      e.id as event_id, e.title, e.venue_name, e.starts_at, e.ends_at,
      alloc.credits,
      cc.code as category_code,
      att.status as attendance_status,
      ent.id as entry_id
    from event_registrations reg
    join events e on e.id = reg.event_id
    left join lateral (
      select a.credits, a.category_id
      from event_accreditations acc
      join event_credit_allocations a on a.accreditation_id = acc.id
      where acc.event_id = e.id and acc.status = 'active'
      order by (a.role_label is not null)
      limit 1
    ) alloc on true
    left join credit_categories cc on cc.id = alloc.category_id
    left join lateral (
      select status from event_attendances
      where event_id = e.id and practitioner_id = ${practitionerId}
      order by created_at desc
      limit 1
    ) att on true
    left join lateral (
      select id from cpd_entries
      where event_id = e.id
        and practitioner_id = ${practitionerId}
        and source = 'event_attendance'
      limit 1
    ) ent on true
    where reg.practitioner_id = ${practitionerId}
      and reg.status = 'confirmed'
    order by e.starts_at
  `;
  const now = new Date();
  return rows.map((r) => ({
    eventId: r.event_id,
    title: r.title,
    venueName: r.venue_name,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    credits: r.credits != null ? Number(r.credits) : null,
    categoryLabel: r.category_code
      ? `Cat ${r.category_code.replace("CAT", "")}`
      : null,
    state:
      r.attendance_status === "verified"
        ? "checked_in"
        : r.attendance_status === "pending"
          ? "pending_verification"
          : r.attendance_status === "rejected"
            ? "no_credit"
            : "registered",
    entryId: r.entry_id,
    isPast: new Date(r.ends_at) < now,
  }));
}
