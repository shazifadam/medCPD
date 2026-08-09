import { test, expect } from "@playwright/test";

/** Update 1 §3 — year-end cron route: auth + keep-alive contract. */

test("cron route rejects without the secret", async ({ request }) => {
  const res = await request.get("/api/cron/year-end");
  expect(res.status()).toBe(401);
});

test("cron route runs keep-alive with the secret (no rollover mid-year)", async ({
  request,
}) => {
  const res = await request.get("/api/cron/year-end", {
    headers: { authorization: "Bearer gradus-cron-8f2e1a94c3d7b6e5" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.keepalive).toBe(true);
  expect(["not-due", "already-done", "no-active-cycle"]).toContain(
    body.rollover
  );
});
