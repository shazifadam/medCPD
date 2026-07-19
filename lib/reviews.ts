import "server-only";
import { sql } from "@/lib/db";
import type { EntryStatus } from "@/components/features/entries/status-badge";

/**
 * P5 committee data layer — IR entry reviews, ER event reviews, AI
 * accreditation history. Committee pages read through the service
 * connection; the /committee layout gates access by role.
 */

// ---------------------------------------------------------------------------
// IR — entry reviews
// ---------------------------------------------------------------------------

export interface ReviewQueueRow {
  id: string;
  title: string;
  practitionerName: string;
  practitionerMmdc: string | null;
  categoryLabel: string; // "Cat 1"
  credits: number;
  submittedAt: string;
  status: EntryStatus;
}

export async function listEntryReviews(): Promise<ReviewQueueRow[]> {
  const rows = await sql<
    {
      id: string;
      title: string | null;
      full_name: string;
      mmdc_registration: string | null;
      category_code: string;
      credits: string;
      submitted_at: Date | string;
      status: EntryStatus;
    }[]
  >`
    select e.id, e.title, p.full_name, p.mmdc_registration,
           cc.code as category_code, e.credits, e.submitted_at, e.status
    from cpd_entries e
    join profiles p on p.id = e.practitioner_id
    join credit_categories cc on cc.id = e.category_id
    order by (e.status = 'pending') desc, e.submitted_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? "(untitled entry)",
    practitionerName: r.full_name,
    practitionerMmdc: r.mmdc_registration,
    categoryLabel: `Cat ${r.category_code.replace("CAT", "")}`,
    credits: Number(r.credits),
    submittedAt: new Date(r.submitted_at).toISOString(),
    status: r.status,
  }));
}

export interface ReviewEntryDetail {
  id: string;
  title: string;
  status: EntryStatus;
  description: string | null;
  activityTypeName: string;
  categoryId: string;
  categoryName: string; // "Category 1 — Formal Education & Learning"
  credits: number;
  occurredOn: string | null;
  source: "self_reported" | "event_attendance";
  submittedAt: string;
  reviewComments: string | null;
  cycleName: string | null;
  practitioner: {
    id: string;
    fullName: string;
    mmdc: string | null;
    specialty: string | null;
    cycleApproved: number;
    cycleTarget: number | null;
    entriesThisCycle: number;
  };
  attachments: {
    id: string;
    filename: string;
    sizeBytes: number;
    storageBucket: string;
    storagePath: string;
  }[];
}

export async function getReviewEntryDetail(
  entryId: string
): Promise<ReviewEntryDetail | null> {
  const rows = await sql<
    {
      id: string;
      title: string | null;
      status: EntryStatus;
      description: string | null;
      activity_type_name: string;
      category_id: string;
      category_name: string;
      credits: string;
      occurred_on: Date | string | null;
      source: "self_reported" | "event_attendance";
      submitted_at: Date | string;
      review_comments: string | null;
      cycle_name: string | null;
      practitioner_id: string;
      full_name: string;
      mmdc_registration: string | null;
      specialty: string | null;
      cycle_approved: string;
      cycle_target: string | null;
      entries_this_cycle: number;
    }[]
  >`
    select
      e.id, e.title, e.status, e.description,
      at.name as activity_type_name,
      cc.id as category_id,
      cc.name as category_name,
      e.credits, e.occurred_on, e.source, e.submitted_at, e.review_comments,
      cy.name as cycle_name,
      p.id as practitioner_id, p.full_name, p.mmdc_registration,
      s.name as specialty,
      (select coalesce(sum(x.credits), 0) from cpd_entries x
        where x.practitioner_id = p.id and x.cycle_id = e.cycle_id
          and x.status = 'approved') as cycle_approved,
      cy.total_credits_required as cycle_target,
      (select count(*)::int from cpd_entries x
        where x.practitioner_id = p.id and x.cycle_id = e.cycle_id) as entries_this_cycle
    from cpd_entries e
    join profiles p on p.id = e.practitioner_id
    join credit_categories cc on cc.id = e.category_id
    join activity_types at on at.id = e.activity_type_id
    left join cpd_cycles cy on cy.id = e.cycle_id
    left join practitioner_specialties ps
      on ps.practitioner_id = p.id and ps.is_primary
    left join specialties s on s.id = ps.specialty_id
    where e.id = ${entryId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;

  const attachments = await sql<
    {
      id: string;
      filename: string;
      size_bytes: string;
      storage_bucket: string;
      storage_path: string;
    }[]
  >`
    select id, filename, size_bytes, storage_bucket, storage_path
    from cpd_entry_attachments
    where entry_id = ${entryId}
    order by uploaded_at
  `;

  return {
    id: r.id,
    title: r.title ?? "(untitled entry)",
    status: r.status,
    description: r.description,
    activityTypeName: r.activity_type_name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    credits: Number(r.credits),
    occurredOn: r.occurred_on
      ? new Date(r.occurred_on).toISOString().slice(0, 10)
      : null,
    source: r.source,
    submittedAt: new Date(r.submitted_at).toISOString(),
    reviewComments: r.review_comments,
    cycleName: r.cycle_name,
    practitioner: {
      id: r.practitioner_id,
      fullName: r.full_name,
      mmdc: r.mmdc_registration,
      specialty: r.specialty,
      cycleApproved: Number(r.cycle_approved),
      cycleTarget: r.cycle_target != null ? Number(r.cycle_target) : null,
      entriesThisCycle: r.entries_this_cycle,
    },
    attachments: attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: Number(a.size_bytes),
      storageBucket: a.storage_bucket,
      storagePath: a.storage_path,
    })),
  };
}

// ---------------------------------------------------------------------------
// ER — event reviews (accreditation requests)
// ---------------------------------------------------------------------------

export type EventReviewState =
  | "pending" // submitted | under_review
  | "revisions" // rejected via requested_revisions
  | "rejected"
  | "approved";

export interface EventReviewRow {
  id: string;
  title: string;
  organizerName: string;
  categoryLabel: string | null;
  suggestedCredits: number | null; // rate-book default for its activity type
  submittedAt: string | null;
  state: EventReviewState;
}

function eventState(
  status: string,
  lastAction: string | null
): EventReviewState {
  if (status === "submitted" || status === "under_review") return "pending";
  if (status === "rejected")
    return lastAction === "requested_revisions" ? "revisions" : "rejected";
  return "approved";
}

export async function listEventReviews(): Promise<EventReviewRow[]> {
  const rows = await sql<
    {
      id: string;
      title: string;
      status: string;
      submitted_at: Date | string | null;
      organizer_name: string | null;
      category_code: string | null;
      suggested_credits: string | null;
      last_action: string | null;
    }[]
  >`
    select
      e.id, e.title, e.status, e.submitted_at,
      coalesce(host.name, p.full_name) as organizer_name,
      cc.code as category_code,
      fr.rate as suggested_credits,
      (select r.action::text from event_reviews r
        where r.event_id = e.id
        order by r.created_at desc limit 1) as last_action
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_categories cc on cc.id = at.default_category_id
    left join profiles p on p.id = e.created_by
    left join lateral (
      select i.name from institution_memberships im
      join institutions i on i.id = im.institution_id
      where im.practitioner_id = e.created_by and im.is_active
      limit 1
    ) host on true
    left join framework_rules fr
      on fr.activity_type_id = at.id
      and fr.role_label is null
      and fr.cycle_id = (select id from cpd_cycles where is_current limit 1)
    where e.status in ('submitted', 'under_review', 'rejected', 'approved', 'completed')
    order by (e.status in ('submitted', 'under_review')) desc,
             e.submitted_at desc nulls last
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    organizerName: r.organizer_name ?? "Unknown organizer",
    categoryLabel: r.category_code
      ? `Cat ${r.category_code.replace("CAT", "")}`
      : null,
    suggestedCredits:
      r.suggested_credits != null ? Number(r.suggested_credits) : null,
    submittedAt: r.submitted_at
      ? new Date(r.submitted_at).toISOString()
      : null,
    state: eventState(r.status, r.last_action),
  }));
}

export interface EventReviewDetail {
  id: string;
  title: string;
  description: string | null;
  state: EventReviewState;
  organizerName: string;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  isVirtual: boolean;
  categoryId: string | null;
  categoryName: string | null;
  suggestedCredits: number | null;
  cycleName: string | null;
  submittedAt: string | null;
  sessions: { id: string; title: string; room: string | null; startsAt: string }[];
  lastReviewComments: string | null;
}

export async function getEventReviewDetail(
  eventId: string
): Promise<EventReviewDetail | null> {
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
      submitted_at: Date | string | null;
      organizer_name: string | null;
      category_id: string | null;
      category_name: string | null;
      suggested_credits: string | null;
      cycle_name: string | null;
      last_action: string | null;
      last_comments: string | null;
    }[]
  >`
    select
      e.id, e.title, e.description, e.status, e.venue_name,
      e.starts_at, e.ends_at, e.capacity, e.is_virtual, e.submitted_at,
      coalesce(host.name, p.full_name) as organizer_name,
      cc.id as category_id,
      cc.name as category_name,
      fr.rate as suggested_credits,
      cy.name as cycle_name,
      lastr.action as last_action,
      lastr.comments as last_comments
    from events e
    join activity_types at on at.id = e.activity_type_id
    left join credit_categories cc on cc.id = at.default_category_id
    left join profiles p on p.id = e.created_by
    left join cpd_cycles cy on cy.is_current
    left join lateral (
      select i.name from institution_memberships im
      join institutions i on i.id = im.institution_id
      where im.practitioner_id = e.created_by and im.is_active
      limit 1
    ) host on true
    left join framework_rules fr
      on fr.activity_type_id = at.id
      and fr.role_label is null
      and fr.cycle_id = (select id from cpd_cycles where is_current limit 1)
    left join lateral (
      select r.action::text, r.comments from event_reviews r
      where r.event_id = e.id
      order by r.created_at desc limit 1
    ) lastr on true
    where e.id = ${eventId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;

  const sessions = await sql<
    { id: string; title: string; room: string | null; starts_at: Date | string }[]
  >`
    select id, title, room, starts_at from event_sessions
    where event_id = ${eventId} order by sequence
  `;

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    state: eventState(r.status, r.last_action),
    organizerName: r.organizer_name ?? "Unknown organizer",
    venueName: r.venue_name,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    capacity: r.capacity,
    isVirtual: r.is_virtual,
    categoryId: r.category_id,
    categoryName: r.category_name,
    suggestedCredits:
      r.suggested_credits != null ? Number(r.suggested_credits) : null,
    cycleName: r.cycle_name,
    submittedAt: r.submitted_at
      ? new Date(r.submitted_at).toISOString()
      : null,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      room: s.room,
      startsAt: new Date(s.starts_at).toISOString(),
    })),
    lastReviewComments: r.last_comments,
  };
}

// ---------------------------------------------------------------------------
// AI — accreditation history
// ---------------------------------------------------------------------------

export interface AccreditationRow {
  id: string;
  eventId: string;
  eventTitle: string;
  accreditationNumber: string;
  accreditedOn: string;
  credits: number | null;
  categoryLabel: string | null;
  status: "active" | "revoked";
}

export async function listAccreditations(): Promise<AccreditationRow[]> {
  const rows = await sql<
    {
      id: string;
      event_id: string;
      event_title: string;
      accreditation_number: string;
      accredited_at: Date | string;
      status: "active" | "revoked";
      credits: string | null;
      category_code: string | null;
    }[]
  >`
    select a.id, a.event_id, e.title as event_title,
           a.accreditation_number, a.accredited_at, a.status,
           alloc.credits, cc.code as category_code
    from event_accreditations a
    join events e on e.id = a.event_id
    left join lateral (
      select x.credits, x.category_id
      from event_credit_allocations x
      where x.accreditation_id = a.id
      order by (x.role_label is not null)
      limit 1
    ) alloc on true
    left join credit_categories cc on cc.id = alloc.category_id
    order by a.accredited_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    accreditationNumber: r.accreditation_number,
    accreditedOn: new Date(r.accredited_at).toISOString(),
    credits: r.credits != null ? Number(r.credits) : null,
    categoryLabel: r.category_code
      ? `Cat ${r.category_code.replace("CAT", "")}`
      : null,
    status: r.status,
  }));
}
