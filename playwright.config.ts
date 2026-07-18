import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config — per the Testing Strategy doc:
 * - Playwright owns flow + boundary tests (negative paths are the centre
 *   of gravity); credit-math permutations belong in unit/DB layers.
 * - Authenticated contexts per role arrive with the Supabase chunk
 *   (global-setup + storageState, one project per role).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local cap: the dev-mode server + remote pooler saturate above ~6
  // parallel workers (40s page timeouts); CI stays serial.
  workers: process.env.CI ? 1 : 6,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1024 } },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
