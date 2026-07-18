import { test, expect } from "@playwright/test";
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
