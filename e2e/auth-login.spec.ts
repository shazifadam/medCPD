import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Chunk 1.2 — Login UI (AU1 default / AU2 error).
 * Real-credential success path lands with Chunk 1.4 (local Supabase).
 */

test.describe("AU1 — login, default", () => {
  test("renders per the Figma frame", async ({ page }) => {
    await page.goto("/login");

    // Lockup above the card
    await expect(page.getByAltText("Gradus CPD System")).toBeVisible();

    // Fields and affordances
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute(
      "placeholder",
      "you@example.mv"
    );
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute(
      "type",
      "password"
    );
    await expect(
      page.getByRole("link", { name: "Forgot password?" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Register with your MMDC number" })
    ).toBeVisible();

    // Footer (AU2 placement — below the card)
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Terms & Conditions" })
    ).toBeVisible();
    await expect(
      page.getByText("2026 © Maldivian Medical Association")
    ).toBeVisible();

    // No error alert in the default state (main scope — Next.js route
    // announcer in <body> also carries role="alert")
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("client validation blocks bad input (shared Zod schema)", async ({
    page,
  }) => {
    await page.goto("/login");

    // Empty submit
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();

    // Malformed email still blocked
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("longenough123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });
});

test.describe("AU2 — login, error", () => {
  test("failed sign-in shows the design's error alert", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("dr.nadha@example.mv");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Sign in failed");
    await expect(alert).toContainText("Incorrect email or password.");

    // Generic message only — never leaks which part failed
    await expect(alert).not.toContainText(/email not found|user|config/i);
  });
});

test("login page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
