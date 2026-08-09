import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ensureCycleCertificate } from "@/lib/certificates";
import { notifyAllPractitioners } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Daily cron (Update 1 §3 — year-end sequence + keep-alive).
 *
 * Every run: touches the database (prevents the free-tier auto-pause).
 * On/after 1 Jan (MVT), when the active cycle has ended:
 *   1. issue cycle certificates for every complete practitioner against
 *      the ending cycle's FROZEN thresholds (edits locked 31 Dec 21:00),
 *   2. auto-create the new calendar-year cycle as a DRAFT rate book,
 *      cloning the ending cycle's rules + floors/caps,
 *   3. flip is_current to the new cycle and notify practitioners.
 *
 * Idempotent: re-runs are no-ops once the new cycle exists.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 1) keep-alive
  const [cycle] = await sql<
    { id: string; name: string; ends_on: string | Date }[]
  >`
    select id, name, ends_on from cpd_cycles where is_current limit 1
  `;
  if (!cycle) {
    return NextResponse.json({ keepalive: true, rollover: "no-active-cycle" });
  }

  // MVT (UTC+5) "today"
  const nowMvt = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const endsOn = new Date(
    cycle.ends_on instanceof Date
      ? cycle.ends_on.toISOString().slice(0, 10)
      : cycle.ends_on
  );
  const cycleOver =
    nowMvt.getTime() > endsOn.getTime() + 24 * 60 * 60 * 1000; // past end date

  if (!cycleOver) {
    return NextResponse.json({ keepalive: true, rollover: "not-due" });
  }

  const newYear = endsOn.getUTCFullYear() + 1;
  const newName = `${newYear} cycle`;
  const existing = await sql<{ id: string }[]>`
    select id from cpd_cycles where name = ${newName}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ keepalive: true, rollover: "already-done" });
  }

  // 2) certificates for the ending cycle (frozen values; on-demand helper)
  const practitioners = await sql<{ id: string }[]>`
    select p.id from profiles p
    where p.registration_state = 'verified'
      and exists (select 1 from role_assignments ra
                  where ra.user_id = p.id and ra.role = 'practitioner'
                    and ra.revoked_at is null)
  `;
  let certificates = 0;
  for (const p of practitioners) {
    try {
      const id = await ensureCycleCertificate(p.id);
      if (id) certificates++;
    } catch (err) {
      console.error(`[year-end] certificate failed for ${p.id}:`, err);
    }
  }

  // 3) new draft cycle cloning rules + caps, then flip is_current
  const [newCycle] = await sql<{ id: string }[]>`
    insert into cpd_cycles
      (name, starts_on, ends_on, is_current, total_credits_required, rate_book_status)
    select ${newName}, ${`${newYear}-01-01`}, ${`${newYear}-12-31`}, false,
           total_credits_required, 'draft'
    from cpd_cycles where id = ${cycle.id}
    returning id
  `;
  await sql`
    insert into framework_rules
      (cycle_id, activity_type_id, category_id, role_label, rate,
       max_per_entry, max_per_cycle, cap_period, band_lookup, notes)
    select ${newCycle.id}, activity_type_id, category_id, role_label, rate,
           max_per_entry, max_per_cycle, cap_period, band_lookup, notes
    from framework_rules where cycle_id = ${cycle.id}
  `;
  await sql`
    insert into cpd_cycle_category_caps (cycle_id, category_id, min_credits, max_credits)
    select ${newCycle.id}, category_id, min_credits, max_credits
    from cpd_cycle_category_caps where cycle_id = ${cycle.id}
  `;
  await sql`
    insert into cpd_cycle_subcategory_caps (cycle_id, subcategory_id, max_per_cycle)
    select ${newCycle.id}, subcategory_id, max_per_cycle
    from cpd_cycle_subcategory_caps where cycle_id = ${cycle.id}
  `;
  await sql`update cpd_cycles set is_current = false where id = ${cycle.id}`;
  await sql`update cpd_cycles set is_current = true where id = ${newCycle.id}`;

  await notifyAllPractitioners({
    kind: "framework_changed",
    title: `${newName} has started`,
    body: `${cycle.name} is closed — certificates were issued against its final thresholds. The ${newName} rate book is in draft pending committee approval.`,
    href: "/dashboard",
  });

  return NextResponse.json({
    keepalive: true,
    rollover: "done",
    certificates,
    newCycle: newCycle.id,
  });
}
