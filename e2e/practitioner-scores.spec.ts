import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * CPD Update 1 §4 — practitioner scores (U1-PS1/PS2): list + filters,
 * eligibility override with mandatory reason + evidence, notification,
 * and override-aware targets.
 */

const PRACTITIONER = "e2e-practitioner@cpd-test.local";
const ENTRY_TITLE = "E2E scores seed entry";

test.describe.configure({ mode: "serial" });
test.use({ storageState: "e2e/.auth/admin.json" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    const [me] = await sql<{ id: string }[]>`
      select id from profiles where email = ${PRACTITIONER}
    `;
    await sql`delete from practitioner_cycle_overrides where practitioner_id = ${me.id}`;
    await sql`delete from notifications where user_id = ${me.id} and kind = 'eligibility_adjusted'`;
    await sql`delete from cpd_entries where title = ${ENTRY_TITLE}`;
    await sql`
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id,
         activity_type_id, credits, title, occurred_on, sessions,
         reviewed_at, reviewed_by)
      select ${me.id}, 'self_reported', 'approved',
             (select id from cpd_cycles where is_current),
             t.default_category_id, t.id, 4.0, ${ENTRY_TITLE}, '2026-05-10', 1,
             now(), (select id from profiles where email = 'e2e-admin@cpd-test.local')
      from activity_types t
      where t.is_active and t.default_category_id is not null
      limit 1
    `;
  } finally {
    await sql.end();
  }
});

test("PS1 — list shows the practitioner with sums; search works", async ({
  page,
}) => {
  await page.goto("/admin/practitioner-scores");
  await expect(
    page.getByRole("heading", { name: "Practitioner scores" })
  ).toBeVisible();
  await expect(page.getByText("E2E Practitioner")).toBeVisible();
  await expect(page.getByText("4.0 earned", { exact: false })).toBeVisible();

  await page.getByLabel("Search practitioners").fill("PMR-E2E-01");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("E2E Practitioner")).toBeVisible();

  await page.getByLabel("Search practitioners").fill("no-such-person");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByText("No practitioners match these filters.")
  ).toBeVisible();
});

test("PS2 — override requires reason + evidence, saves, notifies, applies", async ({
  page,
}) => {
  const sql = connectDb();
  const [me] = await sql<{ id: string }[]>`
    select id from profiles where email = ${PRACTITIONER}
  `;
  await sql.end();

  await page.goto(`/admin/practitioner-scores/${me.id}`);
  await expect(page.getByText("/ 50", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Adjust eligibility" }).click();
  await page.getByLabel("New value").fill("40.0");
  await page
    .getByLabel("Reason (required)")
    .fill("Joined the register mid-year — pro-rated target per policy 4.2.");
  await page.getByLabel("Supporting evidence (required)").setInputFiles({
    name: "registration-letter.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0000000030001a5f645400000000049454e44ae426082",
      "hex"
    ),
  });
  await page.getByRole("button", { name: "Save adjustment" }).click();

  // History entry + override-aware target
  await expect(page.getByText("Cycle total:", { exact: false })).toBeVisible();
  await expect(page.getByText("50.0 → 40.0")).toBeVisible();
  await expect(page.getByText("/ 40", { exact: false })).toBeVisible();

  const sql2 = connectDb();
  const [ov] = await sql2<{ new_value: string; evidence_path: string }[]>`
    select new_value::text, evidence_path from practitioner_cycle_overrides
    where practitioner_id = ${me.id} and field = 'cycle_total'
    order by created_at desc limit 1
  `;
  const [note] = await sql2<{ n: string }[]>`
    select count(*)::text as n from notifications
    where user_id = ${me.id} and kind = 'eligibility_adjusted'
  `;
  // leave no residue: dashboard.spec asserts the default 50-target and
  // the empty welcome state
  await sql2`delete from practitioner_cycle_overrides where practitioner_id = ${me.id}`;
  await sql2`delete from cpd_entries where title = ${ENTRY_TITLE}`;
  await sql2.end();
  expect(Number(ov.new_value)).toBe(40);
  expect(ov.evidence_path).toContain(me.id);
  expect(Number(note.n)).toBeGreaterThan(0);
});

test("scores pages have no serious a11y violations", async ({ page }) => {
  await page.goto("/admin/practitioner-scores");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
