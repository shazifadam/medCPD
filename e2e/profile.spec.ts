import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * CPD Update 1 §5 — profile page (PF1/U1-PF1): photo upload → navbar
 * avatar, primary workplace, other-workplace chips.
 */

const PRACTITIONER = "e2e-practitioner@cpd-test.local";
const EXTRA_CLINIC = "E2E Extra Clinic";

test.describe.configure({ mode: "serial" });
test.use({ storageState: "e2e/.auth/practitioner.json" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    const [me] = await sql<{ id: string }[]>`
      select id from profiles where email = ${PRACTITIONER}
    `;
    await sql`update profiles set avatar_path = null where id = ${me.id}`;
    await sql`delete from practitioner_workplaces where practitioner_id = ${me.id}`;
    await sql`delete from institutions where name = ${EXTRA_CLINIC}`;
  } finally {
    await sql.end();
  }
});

test("profile renders; photo upload becomes the navbar avatar", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByText("Registration & credentials")).toBeVisible();

  await page.getByLabel("Upload photo").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0000000030001a5f645400000000049454e44ae426082",
      "hex"
    ),
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();

  const sql = connectDb();
  const [row] = await sql<{ avatar_path: string | null }[]>`
    select avatar_path from profiles where email = ${PRACTITIONER}
  `;
  await sql.end();
  expect(row.avatar_path).toBeTruthy();

  await page.reload();
  await expect(page.locator('header img[alt="Account"]')).toBeVisible();
});

test("add + remove an other-workplace chip (select-or-create)", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "+ Add workplace" }).click();
  await page.getByRole("combobox").last().click();
  await page.getByPlaceholder("Type a name…").fill(EXTRA_CLINIC);
  await page.getByText(new RegExp(`Create .${EXTRA_CLINIC}.`)).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  // The chip (with its Remove button) only renders once the row is saved
  await expect(
    page.getByRole("button", { name: `Remove ${EXTRA_CLINIC}` })
  ).toBeVisible();

  const sql = connectDb();
  const rows = await sql<{ name: string }[]>`
    select i.name from practitioner_workplaces w
    join institutions i on i.id = w.institution_id
    join profiles p on p.id = w.practitioner_id
    where p.email = ${PRACTITIONER} and i.name = ${EXTRA_CLINIC}
  `;
  await sql.end();
  expect(rows.length).toBe(1);

  await page.getByRole("button", { name: `Remove ${EXTRA_CLINIC}` }).click();
  await expect(
    page.getByRole("button", { name: `Remove ${EXTRA_CLINIC}` })
  ).toHaveCount(0);
});

test("profile page has no serious a11y violations", async ({ page }) => {
  await page.goto("/profile");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
