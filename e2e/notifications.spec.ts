import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * CPD Update 1 §3 — notifications bell (U1-NT). Unread dot, panel items,
 * mark-all-read. Seeds rows directly (inserts are server-side only).
 */

test.describe("Notifications bell", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "e2e/.auth/practitioner.json" });

  test.beforeAll(async () => {
    const sql = connectDb();
    const [u] = await sql<{ id: string }[]>`
      select id from profiles where email = 'e2e-practitioner@cpd-test.local'
    `;
    await sql`delete from notifications where user_id = ${u.id}`;
    await sql`
      insert into notifications (user_id, kind, title, body, href)
      values
        (${u.id}, 'framework_changed', 'Cycle requirements updated',
         'Category 1 floor changed 25 → 20.', '/dashboard'),
        (${u.id}, 'eligibility_adjusted', 'Your eligibility was adjusted',
         'Cycle target adjusted to 40.0 credits.', null)
    `;
    await sql.end();
  });

  test("unread dot shows, panel lists items, mark all read clears", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const bell = page.getByRole("button", { name: /Notifications \(2 unread\)/ });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByText("Cycle requirements updated")).toBeVisible();
    await expect(page.getByText("Your eligibility was adjusted")).toBeVisible();

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(
      page.getByRole("button", { name: "Notifications", exact: true })
    ).toBeVisible();
  });

  test("item with href navigates", async ({ page }) => {
    const sql = connectDb();
    const [u] = await sql<{ id: string }[]>`
      select id from profiles where email = 'e2e-practitioner@cpd-test.local'
    `;
    await sql`
      insert into notifications (user_id, kind, title, href)
      values (${u.id}, 'framework_changed', 'Go to My CPD test', '/my-cpd')
    `;
    await sql.end();

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await page.getByRole("button", { name: /Go to My CPD test/ }).click();
    await page.waitForURL(/my-cpd/);
  });

  test("panel has no serious a11y violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});
