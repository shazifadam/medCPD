import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * OG verify flow (live-system safe: creates ONE named test org and
 * removes exactly that row at the end — no sweeps).
 */

const ORG = "E2E Verify Org";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`delete from institutions where name like ${ORG + '%'}`;
    await sql`insert into institutions (name, type) values (${ORG}, 'clinic')`;
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  const sql = connectDb();
  try {
    await sql`delete from institutions where name like ${ORG + '%'}`;
  } finally {
    await sql.end();
  }
});

test.describe("access", () => {
  test.use({ storageState: "e2e/.auth/practitioner.json" });
  test("plain practitioner cannot reach /organizations (negative)", async ({
    page,
  }) => {
    await page.goto("/organizations");
    await page.waitForURL(/dashboard/);
  });
});

test.describe("committee verifies an organization", () => {
  test.use({ storageState: "e2e/.auth/committee.json" });

  test("Verify flips the status", async ({ page }) => {
    await page.goto("/organizations");

    await page.getByRole("button", { name: `Verify ${ORG}` }).click();
    await expect(page.getByText(`Verify ${ORG}?`)).toBeVisible();
    await page.getByRole("button", { name: "Verify organization" }).click();

    await expect(page.getByText(`Verify ${ORG}?`)).toHaveCount(0);

    const sql = connectDb();
    const [org] = await sql<
      { is_verified: boolean; verified_by: string | null }[]
    >`
      select is_verified, verified_by from institutions where name = ${ORG}
    `;
    await sql.end();
    expect(org.is_verified).toBe(true);
    expect(org.verified_by).not.toBeNull();
  });

  test("archive hides from menus; restore brings it back", async ({
    page,
  }) => {
    await page.goto("/organizations");
    await page.getByRole("button", { name: `Archive ${ORG}`, exact: true }).click();
    await page.getByRole("button", { name: "Archive organization" }).click();
    await expect(
      page.getByRole("button", { name: `Archive ${ORG}`, exact: true })
    ).toHaveCount(0);

    const sql = connectDb();
    const [org] = await sql<{ is_active: boolean }[]>`
      select is_active from institutions where name = ${ORG}
    `;
    await sql.end();
    expect(org.is_active).toBe(false);

    await page.goto("/organizations?show=archived");
    await page.getByRole("button", { name: `Restore ${ORG}` }).click();
    await expect(
      page.getByRole("button", { name: `Restore ${ORG}` })
    ).toHaveCount(0);
    const sql2 = connectDb();
    const [back] = await sql2<{ is_active: boolean }[]>`
      select is_active from institutions where name = ${ORG}
    `;
    await sql2.end();
    expect(back.is_active).toBe(true);
  });

  test("edit renames the organization", async ({ page }) => {
    await page.goto("/organizations");
    await page.getByRole("button", { name: `Edit ${ORG}`, exact: true }).click();
    const nameInput = page.getByRole("textbox", { name: "Name", exact: true });
    await nameInput.fill(`${ORG} Renamed`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`${ORG} Renamed`)).toBeVisible();
    // rename back so afterAll cleanup by name still matches
    await page.getByRole("button", { name: `Edit ${ORG} Renamed` }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(ORG);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${ORG}`, exact: true })).toBeVisible();
  });

  test("organizations page has no serious a11y violations", async ({
    page,
  }) => {
    await page.goto("/organizations");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});
