/**
 * Apply ONE migration file to the database in `.env.local` and record it in
 * supabase_migrations.schema_migrations (same pattern Update 1 used).
 * Idempotent: a version that is already recorded is skipped.
 *
 * Claude's session cannot write to the live DB, so Shazif runs this:
 *
 *   node scripts/apply-migration.mjs supabase/migrations/20261010090000_registration_attempts.sql
 *   node scripts/apply-migration.mjs supabase/migrations/20261010090100_designation_medical_officer.sql
 *
 * The whole file runs inside one transaction with the bookkeeping row, so a
 * failing statement leaves nothing behind.
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-migration.mjs <supabase/migrations/<version>_<name>.sql>");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}

const base = path.basename(file, ".sql");
const version = base.slice(0, 14);
const name = base.slice(15);
if (!/^\d{14}$/.test(version) || !name) {
  console.error(`file name must be <14-digit version>_<name>.sql, got ${base}`);
  process.exit(1);
}
const body = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const sql = postgres(env.DATABASE_URL, { prepare: false, ssl: "require" });
try {
  const already = await sql`
    select 1 from supabase_migrations.schema_migrations where version = ${version}
  `;
  if (already.length) {
    console.log(`skip: ${version}_${name} is already recorded`);
  } else {
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        insert into supabase_migrations.schema_migrations (version, name, statements)
        values (${version}, ${name}, ${sql.array([body])})
      `;
    });
    console.log(`applied: ${version}_${name}`);
  }
} finally {
  await sql.end();
}
