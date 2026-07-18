import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P3 — LA1–LA7 Log CPD activity dialog (Figma 287:12826…12844).
 * Runs as the dedicated e2e-entries user; entries are wiped up front so
 * every run starts from a clean ledger (attachments cascade with entries).
 */

const ENTRIES_EMAIL = "e2e-entries@cpd-test.local";

test.use({ storageState: "e2e/.auth/entries.json" });
// Serial: under fullyParallel each worker re-runs beforeAll, so a second
// worker's ledger wipe could race the first worker's freshly created entry.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`
      delete from cpd_entries
      where practitioner_id in
        (select id from profiles where email = ${ENTRIES_EMAIL})
    `;
  } finally {
    await sql.end();
  }
});

async function openDialog(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log CPD activity" }).click();
  await expect(
    page.getByRole("heading", { name: "Log CPD activity" })
  ).toBeVisible();
}

async function pickDate(page: Page) {
  // The field label names the trigger (FormControl wiring), not its placeholder.
  await page.getByLabel("Date", { exact: true }).click();
  // The 1st of the visible month is always in the past (days after today
  // are disabled), and rdp names gridcells "Wednesday, July 1st, 2026".
  await page
    .getByRole("gridcell", { name: /, \w+ 1st, \d{4}$/ })
    .first()
    .click();
}

test("LA1→LA7 happy path — Cat 2 entry lands pending on the dashboard", async ({
  page,
}) => {
  await openDialog(page);

  // LA1 — step 1: subtitle + the four category cards
  await expect(page.getByText("Choose what you'd like to log")).toBeVisible();
  for (const cat of ["Cat 1", "Cat 2", "Cat 3", "Cat 4"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${cat} `) })
    ).toBeVisible();
  }
  // Continue is disabled until a category is picked
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: /^Cat 2 / }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // LA2 — step 2 form (type select scoped to Cat 2)
  await page.getByLabel("Activity title").fill("External cardiology seminar");
  await page.getByLabel("Activity type").click();
  await page
    .getByRole("option", { name: /External CME \/ topic seminar/ })
    .click();
  await pickDate(page);
  await page.getByLabel("Hours / sessions").fill("2");
  await page
    .getByLabel("Description")
    .fill("Two external CME sessions on arrhythmia management.");
  await page.getByRole("button", { name: "Submit for review" }).click();

  // LA7 — success dialog
  await expect(page.getByText("Activity submitted")).toBeVisible();
  await expect(
    page.getByText("Your entry is pending review", { exact: false })
  ).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  // Dashboard reflects the pending entry (DB1 pending tile + progress line)
  await expect(page.getByText("entries awaiting")).toBeVisible();
  await expect(page.getByText("2.0 pending", { exact: false })).toBeVisible();
});

test("LA5 — submitting an empty form shows the error callout + field errors", async ({
  page,
}) => {
  await openDialog(page);
  await page.getByRole("button", { name: /^Cat 2 / }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();

  await expect(
    page.getByText("Please complete the required fields.")
  ).toBeVisible();
  await expect(
    page.getByText("Some details are missing before you can submit.")
  ).toBeVisible();
  await expect(page.getByText("Activity title is required")).toBeVisible();
  await expect(page.getByText("Date is required")).toBeVisible();
  await expect(page.getByText("Hours / sessions is required")).toBeVisible();
  // No entry was created — the dialog stays open on step 2
  await expect(
    page.getByRole("button", { name: "Submit for review" })
  ).toBeVisible();
});

test("LA6 — pre-registration sub-category shows the gate and awards 0 credits", async ({
  page,
}) => {
  await openDialog(page);
  await page.getByRole("button", { name: /^Cat 1 / }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Gate appears once a pre-reg-required type is chosen
  await page.getByLabel("Activity type").click();
  await page
    .getByRole("option", { name: /Scientific meeting \/ conference/ })
    .click();
  await expect(page.getByText("No credit will be awarded")).toBeVisible();
  await expect(
    page.getByText("requires pre-registration", { exact: false })
  ).toBeVisible();

  // Still submittable — logged for the record
  await page.getByLabel("Activity title").fill("Regional cardiology congress");
  await pickDate(page);
  await page.getByLabel("Hours / sessions").fill("8");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Activity submitted")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  // The gate froze the entry at 0.0 credits with the audit trail in place
  const sql = connectDb();
  try {
    const [row] = await sql<
      { credits: string; calc_inputs: Record<string, unknown> | string }[]
    >`
      select e.credits, e.calc_inputs
      from cpd_entries e
      join profiles p on p.id = e.practitioner_id
      where p.email = ${ENTRIES_EMAIL}
        and e.title = 'Regional cardiology congress'
      order by e.created_at desc
      limit 1
    `;
    expect(row).toBeTruthy();
    expect(Number(row.credits)).toBe(0);
    const calc =
      typeof row.calc_inputs === "string"
        ? (JSON.parse(row.calc_inputs) as Record<string, unknown>)
        : row.calc_inputs;
    expect(calc.pre_registration_gate).toBe(true);
    expect(Number(calc.ungated_credits)).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }
});

test("dialog has no serious/critical a11y violations", async ({ page }) => {
  await openDialog(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
