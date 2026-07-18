import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Smoke — the app boots, the auth gate holds, and design tokens resolve.
 * (Originally asserted the scaffold demo homepage; "/" is auth-gated since
 * the P1 middleware landed, so the token checks moved to /login.)
 */

test("signed-out visit to / is gated to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("login page renders with design tokens applied", async ({ page }) => {
  await page.goto("/login");

  // Primary button carries the brand fill (accent-9 #065BA1 → rgb(6, 91, 161))
  const primary = page.getByRole("button", { name: "Sign in" });
  await expect(primary).toBeVisible();
  await expect(primary).toHaveCSS("background-color", "rgb(6, 91, 161)");
});

test("login page has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
