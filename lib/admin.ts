import "server-only";
import { sql } from "@/lib/db";

/** P6 — admin data layer: OD1 overview, UM users, AL audit log, OG orgs. */

// ---------------------------------------------------------------------------
// OD1 — operations overview
// ---------------------------------------------------------------------------

export interface OverviewData {
  pendingApprovals: number;
  pendingEvents: number;
  pendingEntries: number;
  activePractitioners: number;
  certificatesIssued: number;
  recentActivity: AuditRow[];
}

export async function getOverviewData(): Promise<OverviewData> {
  const [counts] = await sql<
    {
      pending_approvals: number;
      pending_events: number;
      pending_entries: number;
      active_practitioners: number;
    }[]
  >`
    select
      (select count(*)::int from profiles where registration_state = 'pending') as pending_approvals,
      (select count(*)::int from events where status in ('submitted', 'under_review')) as pending_events,
      (select count(*)::int from cpd_entries where status = 'pending') as pending_entries,
      (select count(*)::int from profiles where registration_state = 'verified') as active_practitioners
  `;
  const recentActivity = await getAuditLog(5);
  return {
    pendingApprovals: counts.pending_approvals,
    pendingEvents: counts.pending_events,
    pendingEntries: counts.pending_entries,
    activePractitioners: counts.active_practitioners,
    certificatesIssued: 0, // P7
    recentActivity,
  };
}

// ---------------------------------------------------------------------------
// AL — audit log
// ---------------------------------------------------------------------------

export interface AuditRow {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  tableName: string | null;
  target: string | null;
}

/**
 * Actor resolution: postgres-js writes carry no JWT, so actor_id is null
 * for app writes — fall back to the row snapshot's updated_by/created_by
 * (deviation noted in dev log).
 */
export async function getAuditLog(limit = 100): Promise<AuditRow[]> {
  const rows = await sql<
    {
      id: string;
      occurred_at: Date | string;
      action: string;
      table_name: string | null;
      actor_name: string | null;
      actor_role: string | null;
      target: string | null;
    }[]
  >`
    select
      a.id, a.occurred_at, a.action::text, a.table_name,
      p.full_name as actor_name,
      a.actor_role::text,
      coalesce(
        a.new_values->>'title',
        a.old_values->>'title',
        a.new_values->>'full_name',
        a.old_values->>'full_name',
        a.new_values->>'accreditation_number',
        a.new_values->>'role',
        a.table_name
      ) as target
    from audit_log a
    left join profiles p on p.id = coalesce(
      a.actor_id,
      nullif(a.new_values->>'updated_by', '')::uuid,
      nullif(a.new_values->>'reviewed_by', '')::uuid,
      nullif(a.new_values->>'created_by', '')::uuid
    )
    order by a.occurred_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    occurredAt: new Date(r.occurred_at).toISOString(),
    actorName: r.actor_name,
    actorRole: r.actor_role,
    action: r.action,
    tableName: r.table_name,
    target: r.target,
  }));
}

// ---------------------------------------------------------------------------
// UM — users & roles
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  registrationState: string;
  roles: string[];
  joinedAt: string;
}

export async function listUsers(): Promise<UserRow[]> {
  const rows = await sql<
    {
      id: string;
      full_name: string;
      email: string;
      registration_state: string;
      roles: string[] | null;
      created_at: Date | string;
    }[]
  >`
    select p.id, p.full_name, p.email, p.registration_state, p.created_at,
      (select array_agg(distinct ra.role::text)
        from role_assignments ra
        where ra.user_id = p.id and ra.revoked_at is null) as roles
    from profiles p
    order by p.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    registrationState: r.registration_state,
    roles: r.roles ?? [],
    joinedAt: new Date(r.created_at).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// OG — organizations
// ---------------------------------------------------------------------------

export interface OrganizationRow {
  id: string;
  name: string;
  type: string;
  isVerified: boolean;
  eventCount: number;
}

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      type: string;
      is_verified: boolean;
      event_count: number;
    }[]
  >`
    select i.id, i.name, i.type::text, i.is_verified,
      (select count(*)::int from institution_memberships im
        join events e on e.created_by = im.practitioner_id
        where im.institution_id = i.id) as event_count
    from institutions i
    where i.is_active
    order by i.name
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    isVerified: r.is_verified,
    eventCount: r.event_count,
  }));
}
