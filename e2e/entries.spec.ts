import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P3 — EN1–EN7 My CPD entries flow (Figma 287:12871…12889).
 * Runs as e2e-entries-view with a ledger seeded straight into the DB:
 * one pending, one approved (with review), one rejected (with reason).
 */

const EMAIL = "e2e-entries-view@cpd-test.local";
const ADMIN_EMAIL = "e2e-admin@cpd-test.local";

test.use({ storageState: "e2e/.auth/entries-view.json" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`
      delete from cpd_entries
      where practitioner_id in (select id from profiles where email = ${EMAIL})
    `;
    // Seed: pending (Cat 2), approved (Cat 1 + review), rejected (Cat 1 + reason)
    await sql`
      with me as (select id from profiles where email = ${EMAIL}),
           reviewer as (select id from profiles where email = ${ADMIN_EMAIL}),
           cy as (select id from cpd_cycles where is_current limit 1),
           t2 as (select id, default_category_id from activity_types where code = 'CAT2_EXTERNAL'),
           t1 as (select id, default_category_id from activity_types where code = 'CAT1_KNOWLEDGE')
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id, activity_type_id,
         credits, title, occurred_on, hours, sessions,
         reviewed_at, reviewed_by, review_comments)
      values
        ((select id from me), 'self_reported', 'pending',
         (select id from cy), (select default_category_id from t2), (select id from t2),
         2.0, 'Ethics workshop series', '2026-06-02', null, 2,
         null, null, null),
        ((select id from me), 'self_reported', 'approved',
         (select id from cy), (select default_category_id from t1), (select id from t1),
         6.0, 'Annual Cardiology Conference 2026', '2026-06-12', 8, null,
         '2026-06-20', (select id from reviewer), 'Verified against submitted certificate.'),
        ((select id from me), 'self_reported', 'rejected',
         (select id from cy), (select default_category_id from t1), (select id from t1),
         0.0, 'Workshop (no evidence attached)', '2026-05-20', 4, null,
         '2026-06-20', (select id from reviewer), 'Evidence does not show completion date.')
    `;
  } finally {
    await sql.end();
  }
});

test("EN1 — My CPD renders progress, four category cards and the ledger", async ({
  page,
}) => {
  await page.goto("/my-cpd");

  await expect(page.getByRole("heading", { name: "My CPD" })).toBeVisible();
  await expect(page.getByText("Cycle progress to target")).toBeVisible();
  // Counted totals: only the approved 6.0 counts (Cat 1)
  await expect(
    page.getByText("6.0 approved · 2.0 pending · target 50.0")
  ).toBeVisible();
  for (const cat of ["Category 1", "Category 2", "Category 3", "Category 4"]) {
    await expect(page.getByRole("heading", { name: cat })).toBeVisible();
  }
  // Cat 1 floor note: 6.0 counted / 5.0 floor (seed) → floor met
  await expect(page.getByText("Floor met")).toBeVisible();

  // Ledger: 3 rows + tab chips
  await expect(page.getByRole("tab", { name: /All entries 3/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Pending 1/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Approved 1/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Rejected 1/ })).toBeVisible();
  await expect(
    page.getByText("Annual Cardiology Conference 2026")
  ).toBeVisible();
});

test("EN2 — status tab filters the table and shows a clearable chip", async ({
  page,
}) => {
  await page.goto("/my-cpd");
  await page.getByRole("tab", { name: /Pending/ }).click();

  await expect(page.getByText("Status: Pending")).toBeVisible();
  await expect(page.getByText("Ethics workshop series")).toBeVisible();
  await expect(
    page.getByText("Annual Cardiology Conference 2026")
  ).toHaveCount(0);

  // Clear the chip → all rows return
  await page.getByRole("button", { name: /Status: Pending/ }).click();
  await expect(
    page.getByText("Annual Cardiology Conference 2026")
  ).toBeVisible();

  // Search narrows by title
  await page.getByLabel("Search entries").fill("cardiology");
  await expect(page.getByText("Ethics workshop series")).toHaveCount(0);
  await expect(
    page.getByText("Annual Cardiology Conference 2026")
  ).toBeVisible();
});

test("EN4 — approved entry detail shows review metadata (and no withdraw)", async ({
  page,
}) => {
  await page.goto("/my-cpd");
  await page.getByText("Annual Cardiology Conference 2026").click();

  await expect(
    page.getByRole("heading", { name: "Annual Cardiology Conference 2026" })
  ).toBeVisible();
  await expect(page.getByText("Activity details")).toBeVisible();
  await expect(page.getByText("Reviewed by CPD Committee · 20 Jun 2026")).toBeVisible();
  await expect(
    page.getByText("Verified against submitted certificate.")
  ).toBeVisible();
  // Approved entries are immutable — no withdraw
  await expect(
    page.getByRole("button", { name: "Withdraw entry" })
  ).toHaveCount(0);
});

test("EN6 — rejected entry detail shows the reason and revise CTA", async ({
  page,
}) => {
  await page.goto("/my-cpd");
  await page.getByText("Workshop (no evidence attached)").click();

  await expect(page.getByText(/Rejected — 20 Jun 2026/)).toBeVisible();
  await expect(
    page.getByText("Evidence does not show completion date.")
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Revise & resubmit" })
  ).toBeVisible();
});

test("EN5+EN7 — pending entry withdraws through the confirm dialog", async ({
  page,
}) => {
  await page.goto("/my-cpd");
  await page.getByText("Ethics workshop series").click();

  await expect(page.getByText("Awaiting review")).toBeVisible();
  await page.getByRole("button", { name: "Withdraw entry" }).click();
  await expect(page.getByText("Withdraw this entry?")).toBeVisible();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();

  // Back on My CPD with the pending entry gone
  await page.waitForURL(/\/my-cpd$/);
  await expect(page.getByRole("tab", { name: /Pending 0/ })).toBeVisible();
  await expect(page.getByText("Ethics workshop series")).toHaveCount(0);
});

test("EN3 — a practitioner with no entries sees the empty ledger", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: "e2e/.auth/practitioner.json",
  });
  const page = await ctx.newPage();
  await page.goto("/my-cpd");
  await expect(page.getByText("No CPD entries yet")).toBeVisible();
  await expect(
    page.getByText("Log your first activity to start earning credits")
  ).toBeVisible();
  await ctx.close();
});

test("My CPD has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/my-cpd");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
