import "server-only";
import { sql } from "@/lib/db";

/**
 * Notifications (CPD Update 1 §3). Rows are written server-side only
 * (postgres-js owner role); clients read/update their own via RLS.
 * Kinds in this update: framework_changed, eligibility_adjusted.
 */

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string | Date;
}

export async function getNotifications(
  userId: string,
  limit = 20
): Promise<{ items: NotificationRow[]; unread: number }> {
  const [items, counts] = await Promise.all([
    sql<
      {
        id: string;
        kind: string;
        title: string;
        body: string | null;
        href: string | null;
        read_at: string | null;
        created_at: string | Date;
      }[]
    >`
      select id, kind, title, body, href, read_at, created_at
      from notifications
      where user_id = ${userId}
      order by created_at desc
      limit ${limit}
    `,
    sql<{ n: string }[]>`
      select count(*)::text as n
      from notifications
      where user_id = ${userId} and read_at is null
    `,
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      readAt: r.read_at,
      createdAt: r.created_at,
    })),
    unread: Number(counts[0]?.n ?? 0),
  };
}

export async function markAllRead(userId: string): Promise<void> {
  await sql`
    update notifications set read_at = now()
    where user_id = ${userId} and read_at is null
  `;
}

/** Insert a notification for one user. */
export async function notifyUser(input: {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  await sql`
    insert into notifications (user_id, kind, title, body, href)
    values (${input.userId}, ${input.kind}, ${input.title},
            ${input.body ?? null}, ${input.href ?? null})
  `;
}

/**
 * Fan a notification out to every verified practitioner (framework changes).
 * Single INSERT..SELECT — no N round-trips.
 */
export async function notifyAllPractitioners(input: {
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    insert into notifications (user_id, kind, title, body, href)
    select p.id, ${input.kind}, ${input.title}, ${input.body ?? null}, ${input.href ?? null}
    from profiles p
    where p.registration_state = 'verified'
      and exists (
        select 1 from role_assignments ra
        where ra.user_id = p.id and ra.role = 'practitioner' and ra.revoked_at is null
      )
    returning id
  `;
  return rows.length;
}
