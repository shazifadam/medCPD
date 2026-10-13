import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Chunk 1.6 — Forgot password (AU7) + set password (AU8).
 * AU8's happy path needs a live email-link session — staging/manual.
 * Here: AU7 render/validation/sent-state (a non-existent email makes the
 * reset call a silent no-op server-side) and AU8's signed-out gate.
 */

test.describe("AU7 — forgot password", () => {
  test("renders per the Figma frame", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
      page.getByRole("heading", { name: "Reset your password" })
    ).toBeVisible();
    await expect(
      page.getByText("Enter your email and we'll send a reset link")
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send reset link" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to sign in" })
    ).toBeVisible();
  });

  test("invalid email rejected client-side (negative)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nope");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("valid email shows the sent state without leaking existence", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page
      .getByLabel("Email")
      .fill("definitely-not-registered@cpd-check.local");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByRole("heading", { name: "Check your email" })
    ).toBeVisible();
    await expect(
      page.getByText(/if an account exists/i)
    ).toBeVisible();
  });

  test("has no serious/critical a11y violations", async ({ page }) => {
    await page.goto("/forgot-password");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});

test.describe("AU8 — set password, access gate (negative)", () => {
  test("signed-out visit bounces to login", async ({ page }) => {
    await page.goto("/set-password");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Email-link bridges reach their handlers while signed out", () => {
  // Regression: middleware once gated /auth/*, stranding the ?code=
  // exchange at /login?next=%2Fauth%2Fcallback (live-loop bug 2026-07-04).
  test("/auth/callback without a code lands on link_expired, not the gate", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=link_expired/);
  });

  test("/auth/confirm without a token lands on link_expired, not the gate", async ({
    page,
  }) => {
    await page.goto("/auth/confirm");
    await expect(page).toHaveURL(/\/login\?error=link_expired/);
  });

  test("/auth/confirm with an unknown type lands on link_expired", async ({
    page,
  }) => {
    await page.goto("/auth/confirm?token_hash=abc&type=sms");
    await expect(page).toHaveURL(/\/login\?error=link_expired/);
  });
});

test.describe("AU6 interstitial — emailed links are redeemed on click, not on load", () => {
  // Regression (2026-10-13): Outlook / corporate mail scanners prefetch every
  // link in an email. Verifying on GET let the scanner burn the one-time
  // token, so the practitioner's own click bounced to /login. The page must
  // now render WITHOUT touching the token; only the button's POST redeems it.
  const RESET = "/auth/confirm?token_hash=bogus-token&type=recovery&next=/set-password";

  test("GET renders the confirm card and stays on /auth/confirm", async ({
    page,
  }) => {
    await page.goto(RESET);
    await expect(page).toHaveURL(/\/auth\/confirm\?/);
    await expect(
      page.getByRole("heading", { name: "Reset your password" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect(page.getByText(/can only be used once/i)).toBeVisible();
  });

  test("copy follows the link kind", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=bogus-token&type=signup");
    await expect(
      page.getByRole("heading", { name: "Verify your email address" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Verify email address" })
    ).toBeVisible();

    await page.goto("/auth/confirm?token_hash=bogus-token&type=magiclink");
    await expect(
      page.getByRole("heading", { name: "Sign in to Gradus" })
    ).toBeVisible();
  });

  test("clicking with a used/invalid token lands on login with the expired notice (negative)", async ({
    page,
  }) => {
    await page.goto(RESET);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\?error=link_expired/);
    await expect(page.getByText("This link has expired")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Send me a new link" })
    ).toHaveAttribute("href", "/forgot-password");
  });

  test("has no serious/critical a11y violations", async ({ page }) => {
    await page.goto(RESET);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});
