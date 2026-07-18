import { chromium, type FullConfig } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

/**
 * Seeds two known test users on the remote DB (idempotent) and captures a
 * signed-in storageState for each, so specs can run authenticated without
 * burning email-link round-trips:
 *   e2e/.auth/practitioner.json — verified + practitioner role
 *   e2e/.auth/admin.json        — verified + practitioner + mma_admin
 *
 * Test users use password auth directly (admin-created, email pre-confirmed)
 * — the passwordless email-link flow is covered by its own specs + staging.
 */

const PRACTITIONER_EMAIL = "e2e-practitioner@cpd-test.local";
// Dedicated users for specs that CREATE cpd_entries — one per spec file so
// fullyParallel workers can't race each other's wipes; both keep
// e2e-practitioner pristine for the DB4/EN3 empty-state assertions.
const ENTRIES_EMAIL = "e2e-entries@cpd-test.local"; // log-activity.spec
const ENTRIES_VIEW_EMAIL = "e2e-entries-view@cpd-test.local"; // entries.spec
const EVENTS_EMAIL = "e2e-events@cpd-test.local"; // events.spec
const ADMIN_EMAIL = "e2e-admin@cpd-test.local";
const PASSWORD = "E2eTest!Passw0rd";

function loadEnvLocal(dir: string): Record<string, string> {
  const env: Record<string, string> = {};
  const file = fs.readFileSync(path.join(dir, ".env.local"), "utf8");
  for (const line of file.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
  mmdc: string
): Promise<void> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: "+960 7000000",
      mmdc_registration: mmdc,
      mmdc_registration_type: "PMR",
    },
  });
  // "already been registered" on re-runs is fine.
  if (error && !/already/i.test(error.message)) {
    throw new Error(`createUser(${email}): ${error.message}`);
  }
}

export default async function globalSetup(config: FullConfig) {
  const root = path.resolve(__dirname, "..");
  const env = loadEnvLocal(root);
  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  // 1. Ensure auth users exist (trigger creates profiles).
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await ensureUser(admin, PRACTITIONER_EMAIL, "E2E Practitioner", "PMR-E2E-01");
  await ensureUser(admin, ADMIN_EMAIL, "E2E Admin", "PMR-E2E-02");
  await ensureUser(admin, ENTRIES_EMAIL, "E2E Entries", "PMR-E2E-03");
  await ensureUser(admin, ENTRIES_VIEW_EMAIL, "E2E Entries View", "PMR-E2E-04");
  await ensureUser(admin, EVENTS_EMAIL, "E2E Events", "PMR-E2E-05");

  // 2. Verify profiles + grant roles (idempotent, service connection).
  const sql = postgres(env.DATABASE_URL, { prepare: false, ssl: "require" });
  try {
    await sql`
      update profiles
      set registration_state = 'verified', verified_at = now()
      where email in (${PRACTITIONER_EMAIL}, ${ADMIN_EMAIL}, ${ENTRIES_EMAIL}, ${ENTRIES_VIEW_EMAIL}, ${EVENTS_EMAIL})
        and registration_state <> 'verified'
    `;
    for (const [email, role] of [
      [PRACTITIONER_EMAIL, "practitioner"],
      [ENTRIES_EMAIL, "practitioner"],
      [ENTRIES_VIEW_EMAIL, "practitioner"],
      [EVENTS_EMAIL, "practitioner"],
      [ADMIN_EMAIL, "practitioner"],
      [ADMIN_EMAIL, "mma_admin"],
    ] as const) {
      await sql`
        insert into role_assignments (user_id, role)
        select p.id, ${role}::user_role
        from profiles p
        where p.email = ${email}
          and not exists (
            select 1 from role_assignments ra
            where ra.user_id = p.id
              and ra.role = ${role}::user_role
              and ra.revoked_at is null
          )
      `;
    }
  } finally {
    await sql.end();
  }

  // 3. UI login per user → storageState.
  const authDir = path.join(root, "e2e", ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  const browser = await chromium.launch();
  for (const [email, file, landing] of [
    [PRACTITIONER_EMAIL, "practitioner.json", /\/dashboard/],
    [ENTRIES_EMAIL, "entries.json", /\/dashboard/],
    [ENTRIES_VIEW_EMAIL, "entries-view.json", /\/dashboard/],
    [EVENTS_EMAIL, "events.json", /\/dashboard/],
    [ADMIN_EMAIL, "admin.json", /\/admin/],
  ] as const) {
    const page = await browser.newPage({ baseURL });
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(landing, { timeout: 15_000 });
    await page.context().storageState({ path: path.join(authDir, file) });
    await page.close();
  }
  await browser.close();
}
