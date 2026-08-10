import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * D-ST1 — settings via the navbar cog. Validation paths only: the happy
 * path would change a shared live fixture's password (deliberate skip).
 */

test.use({ storageState: "e2e/.auth/practitioner.json" });

test("cog opens settings; mismatched passwords surface an error", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByLabel("Settings").click();
  await page.waitForURL(/settings/);
  await expect(
    page.getByRole("heading", { name: "Settings" })
  ).toBeVisible();
  await expect(
    page.getByText("e2e-practitioner@cpd-test.local")
  ).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill("newpassword123");
  await page.getByLabel("Confirm new password").fill("different123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
});

test("settings page has no serious a11y violations", async ({ page }) => {
  await page.goto("/settings");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
