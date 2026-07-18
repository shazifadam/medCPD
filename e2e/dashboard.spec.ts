import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Chunk 2.2 — DB1–DB4 dashboard body. With no entries (P3), a fresh
 * practitioner must see exactly the DB4 empty state (Figma 287:12790),
 * with every number fed from the seeded framework — not hardcoded.
 * DB2/DB3 branches get their tests in P3 when entries can exist.
 */

test.describe("DB4 — dashboard, empty (new practitioner)", () => {
  test.use({ storageState: "e2e/.auth/practitioner.json" });

  test("renders the welcome state fed by the framework seed", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Header: cycle picker + actions
    await expect(page.getByText("2026–2027 cycle")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log CPD activity" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse events" })
    ).toBeVisible();

    // DB4 welcome callout
    await expect(
      page.getByText("Welcome to Gradus — start logging your CPD")
    ).toBeVisible();

    // Stat tiles: zeros over seeded denominators (target 50, CAT1 floor 5)
    await expect(page.getByText("CREDITS THIS CYCLE")).toBeVisible();
    await expect(page.getByText("/ 50")).toBeVisible();
    await expect(page.getByText("CATEGORY 1 FLOOR")).toBeVisible();
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();
    await expect(page.getByText("Not started").first()).toBeVisible();
    await expect(page.getByText("entries awaiting")).toBeVisible();

    // Progress: 0%, floor tick legend, target from seed
    await expect(page.getByText("Credit progress")).toBeVisible();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await expect(page.getByText("Cat 1 floor (5)")).toBeVisible();
    // exact: the subtitle also contains "target 50.0" (case-insensitive)
    await expect(page.getByText("Target 50.0", { exact: true })).toBeVisible();

    // Empty panels
    await expect(page.getByText("No CPD entries yet")).toBeVisible();
    await expect(page.getByText("No registered events yet")).toBeVisible();

    // No warning/success callouts in the empty state
    await expect(page.getByText("Category 1 below floor")).toHaveCount(0);
    await expect(page.getByText("Cycle complete")).toHaveCount(0);
  });

  test("has no serious/critical a11y violations", async ({ page }) => {
    await page.goto("/dashboard");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});
