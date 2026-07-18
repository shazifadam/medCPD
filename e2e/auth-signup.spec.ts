import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Chunk 1.5 — Sign up (AU3 form / AU4 validation error / AU5 success).
 * Real submission (creates an auth user + sends the verification email) is
 * exercised manually/staging only — e2e covers render + the AU4 negative
 * path, which is entirely client-side.
 */

test.describe("AU3 — sign up, form", () => {
  test("renders the six designed fields per the Figma frame", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Heading OUTSIDE the card
    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible();
    await expect(page.getByText("Register as a practitioner")).toBeVisible();

    // The six designed fields — and deliberately NO password field.
    // Redesign 294:13161: type = radio pair, chosen type prefixes the number.
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Field / specialty")).toBeVisible();
    await expect(page.getByRole("radio", { name: "PMR" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "TMR" })).toBeVisible();
    await expect(page.getByLabel("Registration number")).toBeVisible();
    await expect(page.getByLabel("Registration number")).toHaveAttribute(
      "placeholder",
      "Enter Number"
    );
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contact number")).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);

    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("specialty dropdown is fed from the DB seed", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Field / specialty").click();
    await expect(
      page.getByRole("option", { name: "General Practice" })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "Other" })).toBeVisible();
  });

  test("selected registration type appears as the number-field prefix", async ({
    page,
  }) => {
    await page.goto("/signup");
    const numberField = page
      .getByLabel("Registration number")
      .locator("xpath=ancestor::div[1]");

    // Default prefix per the frame
    await expect(numberField.getByText("PMR", { exact: true })).toBeVisible();

    // Switching the radio switches the prefix
    await page.getByRole("radio", { name: "TMR" }).click();
    await expect(numberField.getByText("TMR", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "PMR" }).click();
    await expect(numberField.getByText("PMR", { exact: true })).toBeVisible();
  });

  test("has no serious/critical a11y violations", async ({ page }) => {
    await page.goto("/signup");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});

test.describe("AU4 — sign up, validation error (negative)", () => {
  test("empty submit surfaces the callout and inline errors", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();

    // Top callout (AU4)
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Check your details");
    await expect(alert).toContainText("Please correct the highlighted fields.");

    // Inline field errors (shared Zod schema). The specialty error text
    // equals the select placeholder — scope it to the form-message element.
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(
      page.locator('[id$="-form-item-message"]', {
        hasText: "Select your field",
      })
    ).toBeVisible();
    await expect(
      page.getByText("Enter a valid PMR/TMR number")
    ).toBeVisible();
    await expect(
      page.getByText("Select your registration type")
    ).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter a valid contact number")).toBeVisible();
  });

  test("bad email + bad phone rejected client-side", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Contact number").fill("abc");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter a valid contact number")).toBeVisible();
  });
});
