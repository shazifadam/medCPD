import { test, expect, type Browser } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./db";

/**
 * P4 — RA1–RA4 registration approvals (Figma 287:12813…12822). Runs as the
 * admin with two seeded applicants reset to pending each run: A approves
 * (grants the practitioner role), B rejects (stores the reason).
 */

const APPLICANT_A = "e2e-applicant-a@cpd-test.local";
const APPLICANT_B = "e2e-applicant-b@cpd-test.local";

test.use({ storageState: "e2e/.auth/admin.json" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const envFile = fs.readFileSync(
    path.resolve(__dirname, "..", ".env.local"),
    "utf8"
  );
  const env = Object.fromEntries(
    envFile
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
  );
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  for (const [email, name, mmdc] of [
    [APPLICANT_A, "E2E Applicant Approve", "PMR-E2E-A1"],
    [APPLICANT_B, "E2E Applicant Reject", "PMR-E2E-B1"],
  ] as const) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: "E2eTest!Passw0rd",
      email_confirm: true,
      user_metadata: {
        full_name: name,
        phone: "+960 7000001",
        mmdc_registration: mmdc,
        mmdc_registration_type: "PMR",
      },
    });
    if (error && !/already/i.test(error.message)) throw error;
  }

  const sql = connectDb();
  try {
    await sql`
      delete from role_assignments
      where user_id in (select id from profiles where email in (${APPLICANT_A}, ${APPLICANT_B}))
    `;
    await sql`
      update profiles
      set registration_state = 'pending', rejection_reason = null,
          verified_at = null, verified_by = null
      where email in (${APPLICANT_A}, ${APPLICANT_B})
    `;
    // Fix 1: a previous run's reapply may have edited B; restore it.
    await sql`
      update profiles
      set full_name = 'E2E Applicant Reject', mmdc_registration = 'PMR-E2E-B1',
          mmdc_registration_type = 'PMR'
      where email = ${APPLICANT_B}
    `;
    // Reset the fixtures' attempt history to a single pending attempt 1 so
    // the reopen/reapply counts below are deterministic (fixture rows only).
    const [{ t }] = await sql<{ t: string | null }[]>`
      select to_regclass('public.registration_attempts')::text as t
    `;
    if (t) {
      await sql`
        delete from registration_attempts
        where profile_id in (select id from profiles where email in (${APPLICANT_A}, ${APPLICANT_B}))
      `;
      await sql`
        insert into registration_attempts
          (profile_id, attempt_no, submitted_via, full_name, email, phone,
           mmdc_registration, mmdc_registration_type, outcome)
        select id, 1, 'signup', full_name, email, phone,
               mmdc_registration, mmdc_registration_type, 'pending'
        from profiles where email in (${APPLICANT_A}, ${APPLICANT_B})
      `;
    }
  } finally {
    await sql.end();
  }
});

test("RA1 — the queue lists pending applicants", async ({ page }) => {
  await page.goto("/admin/approvals");
  await expect(
    page.getByRole("heading", { name: "Registration approvals" })
  ).toBeVisible();
  await expect(page.getByText("E2E Applicant Approve")).toBeVisible();
  await expect(page.getByText("E2E Applicant Reject")).toBeVisible();
  await expect(page.getByText("PMR-E2E-A1")).toBeVisible();
});

test("RA2→RA3 — approving grants the practitioner role", async ({ page }) => {
  await page.goto("/admin/approvals");
  await page
    .getByRole("link", { name: "Review E2E Applicant Approve" })
    .click();

  await expect(
    page.getByRole("heading", { name: "E2E Applicant Approve" })
  ).toBeVisible();
  await expect(page.getByText("Applicant details")).toBeVisible();
  // Retry the open: a click can land before hydration under full-suite load.
  await expect(async () => {
    await page.getByRole("button", { name: "Approve & grant access" }).click();
    await expect(
      page.getByRole("heading", { name: "Approve registration" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(
    page.getByText("Practitioner role · full access to the CPD portal")
  ).toBeVisible();

  // RA3: role is a real selector defaulting to Practitioner; the single
  // active cycle is shown as information, not an input.
  const roleSelect = page.getByRole("dialog").getByLabel("Assign role");
  await expect(roleSelect).toHaveText("Practitioner");
  await expect(page.getByRole("dialog")).toContainText("Starting cycle");
  await expect(page.getByRole("dialog")).toContainText("2026 cycle");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve & grant access" })
    .click();

  await expect(page.getByText("Approved", { exact: false }).first()).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { registration_state: string; has_role: boolean }[]
    >`
      select p.registration_state,
        exists (
          select 1 from role_assignments ra
          where ra.user_id = p.id and ra.role = 'practitioner' and ra.revoked_at is null
        ) as has_role
      from profiles p where p.email = ${APPLICANT_A}
    `;
    expect(row.registration_state).toBe("verified");
    expect(row.has_role).toBe(true);
  } finally {
    await sql.end();
  }
});

test("RA2→RA4 — rejecting stores the reason for the applicant", async ({
  page,
}) => {
  await page.goto("/admin/approvals");
  await page
    .getByRole("link", { name: "Review E2E Applicant Reject" })
    .click();

  await expect(async () => {
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reject application" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  // Reject is gated on a reason
  await expect(
    page.getByRole("button", { name: "Reject application" })
  ).toBeDisabled();
  await page.getByLabel("Reason for rejection").click();
  await page
    .getByRole("option", { name: "Registration could not be verified with MMDC" })
    .click();
  await page
    .getByLabel("Details for the applicant")
    .fill("Please resubmit with a valid registration certificate.");
  await page.getByRole("button", { name: "Reject application" }).click();

  await expect(page.getByText("Rejected", { exact: false }).first()).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { registration_state: string; rejection_reason: string | null }[]
    >`
      select registration_state, rejection_reason
      from profiles where email = ${APPLICANT_B}
    `;
    expect(row.registration_state).toBe("rejected");
    expect(row.rejection_reason).toContain("MMDC");
  } finally {
    await sql.end();
  }
});

/* ── Fix 1: reopen (admin) + reapply (practitioner), attempts logged ── */

const PASSWORD = "E2eTest!Passw0rd";

type AttemptRow = {
  attempt_no: number;
  submitted_via: string;
  outcome: string;
  rejection_reason: string | null;
};

async function stateOf(email: string) {
  const sql = connectDb();
  try {
    const [profile] = await sql<
      {
        id: string;
        full_name: string;
        registration_state: string;
        rejection_reason: string | null;
      }[]
    >`
      select id, full_name, registration_state, rejection_reason
      from profiles where email = ${email}
    `;
    const attempts = await sql<AttemptRow[]>`
      select attempt_no, submitted_via, outcome, rejection_reason
      from registration_attempts
      where profile_id = ${profile.id}
      order by attempt_no desc
    `;
    return { profile, attempts };
  } finally {
    await sql.end();
  }
}

/** A signed-out context (the file-level admin storageState must not leak). */
function signedOutContext(browser: Browser) {
  return browser.newContext({
    baseURL: "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
  });
}

test("RA2 — reopening a rejected application logs attempt 2", async ({
  page,
}) => {
  const before = await stateOf(APPLICANT_B);
  await page.goto(`/admin/approvals/${before.profile.id}`);

  await expect(
    page.getByRole("button", { name: "Approve & grant access" })
  ).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "Reopen application" }).click();
    await expect(
      page.getByRole("heading", { name: "Reopen application" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("attempt 2");
  await dialog.getByRole("button", { name: "Reopen application" }).click();
  await expect(dialog).toBeHidden();

  // Back in the pending state: Reject is offered again.
  await expect(
    page.getByRole("button", { name: "Reject", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Pending approval").first()).toBeVisible();

  const history = page
    .getByRole("list")
    .filter({ hasText: "Attempt 1" })
    .getByRole("listitem");
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText("Attempt 2");
  await expect(history.nth(0)).toContainText("Reopened by MMA");
  await expect(history.nth(1)).toContainText("Attempt 1");
  await expect(history.nth(1)).toContainText("Rejected by");

  const after = await stateOf(APPLICANT_B);
  expect(after.profile.registration_state).toBe("pending");
  expect(after.profile.rejection_reason).toBeNull();
  expect(after.attempts).toHaveLength(2);
  expect(after.attempts[0].submitted_via).toBe("admin_reopen");
  expect(after.attempts[0].outcome).toBe("pending");
  expect(after.attempts[1].outcome).toBe("rejected");
});

test("RA4 — rejecting the reopened application settles attempt 2", async ({
  page,
}) => {
  const before = await stateOf(APPLICANT_B);
  await page.goto(`/admin/approvals/${before.profile.id}`);

  await expect(async () => {
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reject application" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.getByLabel("Reason for rejection").click();
  await page
    .getByRole("option", { name: "Incomplete or unclear applicant details" })
    .click();
  await page
    .getByLabel("Details for the applicant")
    .fill("Second rejection for e2e");
  await page.getByRole("button", { name: "Reject application" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Reopen application" })
  ).toBeVisible();

  const after = await stateOf(APPLICANT_B);
  expect(after.profile.registration_state).toBe("rejected");
  expect(after.attempts).toHaveLength(2);
  expect(after.attempts[0].outcome).toBe("rejected");
  expect(after.attempts[0].rejection_reason).toContain("Second rejection");
});

test("RA1 — the queue marks a repeat applicant with an attempt pill", async ({
  page,
}) => {
  await page.goto("/admin/approvals");
  await page.getByRole("tab", { name: /Rejected/ }).click();
  const row = page
    .locator("div")
    .filter({ has: page.getByText(APPLICANT_B, { exact: true }) })
    .filter({
      has: page.getByRole("link", { name: "Review E2E Applicant Reject" }),
    })
    .last();
  await expect(row.getByText("Attempt 2", { exact: true })).toBeVisible();
});

test("AU3 — signup with a rejected profile's number never duplicates it", async ({
  browser,
}) => {
  const dupEmail = `dup-${Date.now()}@cpd-test.local`;
  const context = await signedOutContext(browser);
  const page = await context.newPage();
  try {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Dup Test");
    await page.getByRole("radio", { name: "PMR" }).click();
    await page.getByLabel("Registration number").fill("PMR-E2E-B1");
    await page.getByLabel("Email").fill(dupEmail);
    await page.getByLabel("Contact number").fill("7000009");
    await page.getByRole("button", { name: "Create account" }).click();

    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("registered under a different email");
  } finally {
    await context.close();
  }

  const sql = connectDb();
  try {
    const [{ profiles, users }] = await sql<
      { profiles: number; users: number }[]
    >`
      select
        (select count(*)::int from profiles where email = ${dupEmail}) as profiles,
        (select count(*)::int from auth.users where email = ${dupEmail}) as users
    `;
    expect(profiles).toBe(0);
    expect(users).toBe(0);
  } finally {
    await sql.end();
  }
});

test("AU3 — signup with a rejected profile's email writes nothing and points to sign in", async ({
  browser,
}) => {
  const before = await stateOf(APPLICANT_B);
  expect(before.profile.registration_state).toBe("rejected");

  const context = await signedOutContext(browser);
  const page = await context.newPage();
  try {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Hijack Attempt");
    await page.getByRole("radio", { name: "TMR" }).click();
    await page.getByLabel("Registration number").fill("TMR-HIJACK-1");
    await page.getByLabel("Email").fill(APPLICANT_B);
    await page.getByLabel("Contact number").fill("7000008");
    await page.getByRole("button", { name: "Create account" }).click();

    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("was not approved");

    // Verified and pending emails get their own message (admin fixture is verified).
    await page.getByLabel("Email").fill("e2e-admin@cpd-test.local");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(alert).toContainText("already registered. Sign in instead");
  } finally {
    await context.close();
  }

  const after = await stateOf(APPLICANT_B);
  expect(after.profile.registration_state).toBe("rejected");
  expect(after.profile.full_name).toBe("E2E Applicant Reject");
  expect(after.attempts).toHaveLength(before.attempts.length);
});

test("AU7 → /reapply — a rejected practitioner resubmits on the same profile", async ({
  browser,
}) => {
  const context = await signedOutContext(browser);
  const page = await context.newPage();
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(APPLICANT_B);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/pending$/);
    await expect(
      page.getByRole("heading", { name: "Registration not approved" })
    ).toBeVisible();
    await expect(page.getByText("Reason:")).toContainText("Second rejection");
    await page
      .getByRole("link", { name: "Reapply with corrected details" })
      .click();

    await expect(page).toHaveURL(/\/reapply$/);
    await expect(
      page.getByRole("heading", { name: "Update your application" })
    ).toBeVisible();
    await expect(page.getByText("Previous decision:")).toContainText(
      "Second rejection"
    );
    await expect(page.getByLabel("Full name")).toHaveValue(
      "E2E Applicant Reject"
    );
    await expect(page.getByRole("radio", { name: "PMR" })).toBeChecked();
    await expect(page.getByLabel("Registration number")).toHaveValue(
      "PMR-E2E-B1"
    );
    await expect(page.getByLabel("Email")).toBeDisabled();
    await expect(page.getByLabel("Email")).toHaveValue(APPLICANT_B);

    // A11y smoke on the new page while it is reachable (B is rejected).
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);

    await page.getByLabel("Full name").fill("E2E Applicant Reject Updated");
    await page.getByRole("button", { name: "Resubmit application" }).click();

    await expect(page).toHaveURL(/\/pending$/);
    await expect(
      page.getByRole("heading", { name: "Registration under review" })
    ).toBeVisible();
  } finally {
    await context.close();
  }

  const after = await stateOf(APPLICANT_B);
  try {
    expect(after.profile.registration_state).toBe("pending");
    expect(after.profile.full_name).toBe("E2E Applicant Reject Updated");
    expect(after.attempts).toHaveLength(3);
    expect(after.attempts[0].submitted_via).toBe("reapply");
    expect(after.attempts[0].outcome).toBe("pending");
  } finally {
    // Restore the fixture's name (by email; fixture row only).
    const sql = connectDb();
    try {
      await sql`
        update profiles set full_name = 'E2E Applicant Reject'
        where email = ${APPLICANT_B}
      `;
    } finally {
      await sql.end();
    }
  }
});

test("/reapply is gated: signed-out → login, verified → dashboard", async ({
  page,
  browser,
}) => {
  const context = await signedOutContext(browser);
  const anon = await context.newPage();
  try {
    await anon.goto("/reapply");
    await expect(anon).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }

  // The admin storageState is a verified user.
  await page.goto("/reapply");
  await expect(page).toHaveURL(/\/dashboard/);
});


test("approvals pages have no serious/critical a11y violations", async ({
  page,
}) => {
  await page.goto("/admin/approvals");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
