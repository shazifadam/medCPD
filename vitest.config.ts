import { defineConfig } from "vitest/config";

// Unit tests only (credit math etc.) — e2e/ belongs to Playwright.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
