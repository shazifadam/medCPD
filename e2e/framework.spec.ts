import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * CPD Update 1 §3 — framework lifecycle (FM2/FM5/FM6/FM7).
 * Draft rate book: editable → committee approval locks it (+ fan-out).
 * Active cycle: thresholds editable behind the FM7 confirm (+ fan-out).
 */

const DRAFT_CYCLE = "2027 cycle";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`delete from notifications where kind = 'framework_changed'`;
    await sql`delete from cpd_cycles where name = ${DRAFT_CYCLE}`;
    // Draft 2027 cycle cloning the current cycle's rules (auto-create shape)
    const [c] = await sql<{ id: string }[]>`
      insert into cpd_cycles
        (name, starts_on, ends_on, is_current, total_credits_required, rate_book_status)
      values (${DRAFT_CYCLE}, '2027-01-01', '2027-12-31', false, 50.0, 'draft')
      returning id
    `;
    await sql`
      insert into framework_rules
        (cycle_id, activity_type_id, category_id, role_label, rate,
         max_per_entry, max_per_cycle, cap_period, band_lookup)
      select ${c.id}, activity_type_id, category_id, role_label, rate,
             max_per_entry, max_per_cycle, cap_period, band_lookup
      from framework_rules
      where cycle_id = (select id from cpd_cycles where is_current)
    `;
  } finally {
    await sql.end();
  }
});

test.describe("access", () => {
  test.use({ storageState: "e2e/.auth/practitioner.json" });
  test("plain practitioner cannot reach /framework (negative)", async ({
    page,
  }) => {
    await page.goto("/framework");
    await page.waitForURL(/dashboard/);
  });
});

test.describe("admin — draft rate book + thresholds", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("FM2 lists cycles; draft cycle rate book is editable and saves", async ({
    page,
  }) => {
    await page.goto("/framework");
    await expect(page.getByText(DRAFT_CYCLE)).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();

    const sql = connectDb();
    const [cycle] = await sql<{ id: string }[]>`
      select id from cpd_cycles where name = ${DRAFT_CYCLE}
    `;
    await sql.end();

    await page.goto(`/framework/${cycle.id}`);
    await expect(
      page.getByText("draft, awaiting committee approval", { exact: false })
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit rate book" }).click();
    const firstRate = page.getByLabel(/^Rate for/).first();
    await firstRate.fill("9.5");
    await page.getByRole("button", { name: "Save rate book" }).click();
    await expect(page.getByText("9.5 ·", { exact: false })).toBeVisible();

    const sql2 = connectDb();
    const rows = await sql2<{ rate: string }[]>`
      select rate::text from framework_rules
      where cycle_id = ${cycle.id} and rate = 9.5
    `;
    await sql2.end();
    expect(rows.length).toBeGreaterThan(0);
  });

  test("active cycle: rates locked, thresholds editable via FM7 confirm + fan-out", async ({
    page,
  }) => {
    const sql = connectDb();
    const [cycle] = await sql<{ id: string }[]>`
      select id from cpd_cycles where is_current
    `;
    await sql.end();

    await page.goto(`/framework/${cycle.id}`);
    await expect(page.getByText("rates are locked", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit rate book" })
    ).toHaveCount(0);

    await page.goto(`/framework/${cycle.id}/thresholds`);
    await page.getByLabel("Total credits required per cycle").fill("50.0");
    await page.getByLabel("Floor for category CAT1").fill("6.0");
    await page.getByRole("button", { name: "Save thresholds" }).click();
    // FM7 active-cycle warning
    await expect(
      page.getByText("Change thresholds on the active cycle?")
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm & save" }).click();
    await expect(
      page.getByText("Thresholds saved — all practitioners have been notified.")
    ).toBeVisible();

    const sql2 = connectDb();
    const [cap] = await sql2<{ min_credits: string }[]>`
      select min_credits::text from cpd_cycle_category_caps cap
      join credit_categories cc on cc.id = cap.category_id
      where cap.cycle_id = ${cycle.id} and cc.code = 'CAT1'
    `;
    const notes = await sql2<{ n: string }[]>`
      select count(*)::text as n from notifications
      where kind = 'framework_changed'
        and user_id = (select id from profiles where email = 'e2e-practitioner@cpd-test.local')
    `;
    // restore the seeded floor for other specs
    await sql2`
      update cpd_cycle_category_caps set min_credits = 5.0
      where cycle_id = ${cycle.id}
        and category_id = (select id from credit_categories where code = 'CAT1')
    `;
    await sql2.end();
    expect(Number(cap.min_credits)).toBe(6.0);
    expect(Number(notes[0].n)).toBeGreaterThan(0);
  });
});

test.describe("committee — approval locks the draft", () => {
  test.use({ storageState: "e2e/.auth/committee.json" });

  test("committee approves the draft rate book; rates lock", async ({
    page,
  }) => {
    const sql = connectDb();
    const [cycle] = await sql<{ id: string }[]>`
      select id from cpd_cycles where name = ${DRAFT_CYCLE}
    `;
    await sql.end();

    await page.goto(`/framework/${cycle.id}`);
    await page.getByRole("button", { name: "Approve rate book" }).click();
    await expect(page.getByText("rates are locked", { exact: false })).toBeVisible();

    const sql2 = connectDb();
    const [row] = await sql2<{ rate_book_status: string }[]>`
      select rate_book_status from cpd_cycles where id = ${cycle.id}
    `;
    await sql2.end();
    expect(row.rate_book_status).toBe("approved");
  });

  test("framework pages have no serious a11y violations", async ({ page }) => {
    await page.goto("/framework");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});
