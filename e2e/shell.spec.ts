import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Chunk 2.1 — App shell (Figma DB1/OD1): navbar + role-grouped sidebar +
 * landing pages, and the role guards between them.
 * Authenticated via storageState from global-setup.
 */

test.describe("Admin shell (OD1)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("lands on Operations overview with role-grouped nav", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Operations overview" })
    ).toBeVisible();
    await expect(
      page.getByText("System health and items needing your attention")
    ).toBeVisible();

    // Stat tiles (practitioner counts live, events/certs 0 until P4/P7)
    await expect(page.getByText("Pending approvals")).toBeVisible();
    await expect(page.getByText("Active practitioners")).toBeVisible();

    // Role-grouped sidebar: both group headings + key items
    const nav = page.getByRole("navigation");
    await expect(nav.getByText("Practitioner", { exact: true })).toBeVisible();
    await expect(
      nav.getByText("Administration", { exact: true })
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Audit log" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();

    // Active item marks the current page
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    // Navbar: lockup + avatar initials (E2E Admin → EA)
    await expect(page.getByAltText("Gradus CPD System")).toBeVisible();
    await expect(page.getByText("EA", { exact: true })).toBeVisible();
  });

  test("has no serious/critical a11y violations", async ({ page }) => {
    await page.goto("/admin");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});

test.describe("Practitioner shell (DB1 header)", () => {
  test.use({ storageState: "e2e/.auth/practitioner.json" });

  test("dashboard shows identity line and simple nav (no admin group)", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "My CPD dashboard" })
    ).toBeVisible();
    // name · registration · specialty line
    await expect(page.getByText(/E2E Practitioner · PMR-E2E-01/)).toBeVisible();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "My CPD" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profile" })).toBeVisible();
    // No admin group for plain practitioners
    await expect(nav.getByText("Administration")).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
  });

  test("practitioner cannot reach /admin (negative)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("/ routes into the portal", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
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

test.describe("Sign out", () => {
  // Fresh inline login — signing out revokes the session server-side, so
  // reusing a shared storageState here would poison parallel specs.
  test("sidebar sign-out returns to login and re-gates the portal", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("e2e-practitioner@cpd-test.local");
    await page.getByLabel("Password").fill("E2eTest!Passw0rd");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    // Portal is gated again
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
