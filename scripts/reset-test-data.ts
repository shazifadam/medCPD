/**
 * Reset test data — wipe users + events, keep the framework.
 *
 * Run:  npx tsx scripts/reset-test-data.ts
 * Env:  reads .env.local (DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
 *       SUPABASE_SERVICE_ROLE_KEY)
 *
 * Keeps:  credit_categories, credit_subcategories, activity_types,
 *         framework_rules, cpd_cycles (+cap tables), specialties,
 *         institutions (created_by set-null'd) — and the KEEP_EMAILS
 *         auth users (+ their profiles/roles).
 * Wipes:  all other auth users (profiles cascade), all events + event_*
 *         tables, cpd_entries (+attachments), certificates, event_reviews,
 *         audit_log, and every object in the two storage buckets.
 *
 * Re-runnable any time between tester rounds. E2e users are wiped too —
 * `pnpm test:e2e` recreates them (global-setup is idempotent).
 */
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const KEEP_EMAILS = ["hussain.shaxif002@gmail.com"];
const BUCKETS = ["cpd-evidence", "cpd-certificates"];

// .env.local loader (script runs outside Next)
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const authHeaders = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

async function main() {
  // 1) Storage objects are keyed by paths that may be nested under practitioner
  // ids — the DB rows in storage.objects are the reliable enumeration.
  for (const bucket of BUCKETS) {
    const objects = await sql<{ name: string }[]>`
      select name from storage.objects where bucket_id = ${bucket}
    `;
    if (objects.length > 0) {
      const del = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ prefixes: objects.map((o) => o.name) }),
      });
      if (!del.ok) throw new Error(`bucket ${bucket}: ${del.status} ${await del.text()}`);
    }
    console.log(`storage ${bucket}: removed ${objects.length} object(s)`);
  }

  // 2) Domain data (before user deletion so no FK restrict can block it).
  await sql`
    truncate table
      cpd_entry_attachments,
      cpd_entries,
      certificates,
      event_reviews,
      event_credit_allocations,
      event_attendances,
      event_registrations,
      event_sessions,
      event_organizers,
      event_accreditations,
      events
    cascade
  `;
  console.log("domain tables truncated (entries, certificates, events + satellites)");

  // 3) Auth users except KEEP_EMAILS (profiles + role/specialty/membership
  //    rows cascade; verified_by/created_by references are set-null).
  const users: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
      { headers: authHeaders }
    );
    const data = (await res.json()) as { users?: { id: string; email: string }[] };
    if (!data.users || data.users.length === 0) break;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 100) break;
  }
  let deleted = 0;
  for (const u of users) {
    if (KEEP_EMAILS.includes(u.email.toLowerCase())) continue;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!res.ok) {
      console.error(`  FAILED to delete ${u.email}: ${res.status} ${await res.text()}`);
      continue;
    }
    deleted++;
    console.log(`  deleted user ${u.email}`);
  }
  console.log(`auth users: deleted ${deleted}, kept ${users.length - deleted}`);

  // 4) Audit log last — user deletions above just wrote rows into it.
  await sql`truncate table audit_log`;
  console.log("audit_log truncated");

  // 5) Verify
  const counts = await sql<{ t: string; n: string }[]>`
    select 'profiles' as t, count(*)::text as n from profiles
    union all select 'cpd_entries', count(*)::text from cpd_entries
    union all select 'events', count(*)::text from events
    union all select 'certificates', count(*)::text from certificates
    union all select 'audit_log', count(*)::text from audit_log
    union all select 'credit_categories', count(*)::text from credit_categories
    union all select 'credit_subcategories', count(*)::text from credit_subcategories
    union all select 'cpd_cycles', count(*)::text from cpd_cycles
    union all select 'activity_types', count(*)::text from activity_types
    union all select 'specialties', count(*)::text from specialties
  `;
  console.log("\nfinal state:");
  for (const c of counts) console.log(`  ${c.t}: ${c.n}`);
  const kept = await sql<{ email: string; state: string }[]>`
    select email, registration_state as state from profiles
  `;
  for (const k of kept) console.log(`  remaining profile: ${k.email} (${k.state})`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
