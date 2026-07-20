import "server-only";
import { sql } from "@/lib/db";

/** EM — admin manage-events data layer. */

export interface AdminEventRow {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  venueName: string | null;
  registeredCount: number;
  credits: number | null;
}

export async function listAdminEvents(): Promise<AdminEventRow[]> {
  const rows = await sql<
    {
      id: string;
      title: string;
      status: string;
      starts_at: Date | string;
      venue_name: string | null;
      registered_count: number;
      credits: string | null;
    }[]
  >`
    select e.id, e.title, e.status, e.starts_at, e.venue_name,
      (select count(*)::int from event_registrations r
        where r.event_id = e.id and r.status = 'confirmed') as registered_count,
      alloc.credits
    from events e
    left join lateral (
      select a.credits from event_accreditations acc
      join event_credit_allocations a on a.accreditation_id = acc.id
      where acc.event_id = e.id and acc.status = 'active'
      order by (a.role_label is not null) limit 1
    ) alloc on true
    order by e.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    startsAt: new Date(r.starts_at).toISOString(),
    venueName: r.venue_name,
    registeredCount: r.registered_count,
    credits: r.credits != null ? Number(r.credits) : null,
  }));
}

export interface AdminEventDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  isVirtual: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  categoryName: string | null;
  activityTypeName: string;
  registeredCount: number;
  checkedInCount: number;
  sessionCount: number;
  credits: number | null;
  accreditedOn: string | null;
}

export async function getAdminEventDetail(
  eventId: string
): Promise<AdminEventDetail | null> {
  const rows = await sql<
    {
      id: string;
      title: string;
      description: string | null;
      status: string;
      venue_name: string | null;
      starts_at: Date | string;
      ends_at: Date | string;
      capacity: number | null;
      is_virtual: boolean;
      registration_opens_at: Date | string | null;
      registration_closes_at: Date | string | null;
      category_name: string | null;
      activity_type_name: string;
      registered_count: number;
      checked_in_count: number;
      session_count: number;
      credits: string | null;
      accredited_at: Date | string | null;
    }[]
  >`
    select e.id, e.title, e.description, e.status, e.venue_name,
      e.starts_at, e.ends_at, e.capacity, e.is_virtual,
      e.registration_opens_at, e.registration_closes_at,
      cc.name as category_name,
      at.name as activity_type_name,
      (select count(*)::int from event_registrations r
        where r.event_id = e.id and r.status = 'confirmed') as registered_count,
      (select count(*)::int from event_attendances a
        where a.event_id = e.id and a.status = 'verified') as checked_in_count,
      (select count(*)::int from event_sessions s
        where s.event_id = e.id) as session_count,
      alloc.credits,
      acc.accredited_at
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_categories cc on cc.id = at.default_category_id
    left join event_accreditations acc
      on acc.event_id = e.id and acc.status = 'active'
    left join lateral (
      select a.credits from event_credit_allocations a
      where a.accreditation_id = acc.id
      order by (a.role_label is not null) limit 1
    ) alloc on true
    where e.id = ${eventId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    venueName: r.venue_name,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    capacity: r.capacity,
    isVirtual: r.is_virtual,
    registrationOpensAt: r.registration_opens_at
      ? new Date(r.registration_opens_at).toISOString()
      : null,
    registrationClosesAt: r.registration_closes_at
      ? new Date(r.registration_closes_at).toISOString()
      : null,
    categoryName: r.category_name,
    activityTypeName: r.activity_type_name,
    registeredCount: r.registered_count,
    checkedInCount: r.checked_in_count,
    sessionCount: r.session_count,
    credits: r.credits != null ? Number(r.credits) : null,
    accreditedOn: r.accredited_at
      ? new Date(r.accredited_at).toISOString()
      : null,
  };
}

export interface RosterRow {
  registrationId: string;
  practitionerId: string;
  fullName: string;
  mmdc: string | null;
  registeredAt: string;
  status: "confirmed" | "waitlisted" | "cancelled";
  attendanceStatus: "pending" | "verified" | "rejected" | null;
  checkedInAt: string | null;
}

export async function getEventRoster(eventId: string): Promise<RosterRow[]> {
  const rows = await sql<
    {
      registration_id: string;
      practitioner_id: string;
      full_name: string;
      mmdc_registration: string | null;
      registered_at: Date | string;
      status: "confirmed" | "waitlisted" | "cancelled";
      attendance_status: "pending" | "verified" | "rejected" | null;
      attended_at: Date | string | null;
    }[]
  >`
    select r.id as registration_id, r.practitioner_id,
           p.full_name, p.mmdc_registration, r.registered_at, r.status,
           att.status as attendance_status, att.attended_at
    from event_registrations r
    join profiles p on p.id = r.practitioner_id
    left join lateral (
      select status, attended_at from event_attendances a
      where a.event_id = r.event_id and a.practitioner_id = r.practitioner_id
      order by a.created_at desc limit 1
    ) att on true
    where r.event_id = ${eventId}
    order by r.registered_at
  `;
  return rows.map((r) => ({
    registrationId: r.registration_id,
    practitionerId: r.practitioner_id,
    fullName: r.full_name,
    mmdc: r.mmdc_registration,
    registeredAt: new Date(r.registered_at).toISOString(),
    status: r.status,
    attendanceStatus: r.attendance_status,
    checkedInAt: r.attended_at ? new Date(r.attended_at).toISOString() : null,
  }));
}
