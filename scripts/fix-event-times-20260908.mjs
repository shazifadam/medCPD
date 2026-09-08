// One-off data correction (2026-09-08, user go-ahead): the two MMA-created
// events were typed as Maldives wall-clock (20:00–22:00) in the admin form
// but stored as UTC (the bug fixed in lib/time.ts). Shift exactly those two
// rows by −5h. Guarded: only rows whose stored start hour is still 20 move,
// so re-running is a no-op.
//
// Run from CPD-Dev:  set -a; source .env.local; set +a; node scripts/fix-event-times-20260908.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
const ids = [
  "aa3af39e-612a-4a02-a609-cc9fe7c1ed97", // approved — tonight's trial event
  "faf33078-82c0-4c9e-9160-de5e7e7f71fb", // rejected duplicate, same entry pattern
];

const before = await sql`
  select id, status, starts_at, ends_at from events where id = any(${ids})
`;
console.log("before", before);

const updated = await sql`
  update events
  set starts_at = starts_at - interval '5 hours',
      ends_at   = ends_at   - interval '5 hours'
  where id = any(${ids})
    and extract(hour from starts_at at time zone 'UTC') = 20
  returning id, status, starts_at, ends_at
`;
console.log("updated", updated);
await sql.end();
