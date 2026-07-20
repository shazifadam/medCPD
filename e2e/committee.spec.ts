import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P5 — IR1–IR4 entry reviews, ER1–ER6 event reviews, AI2/AI3 revocation
 * (Figma 287:12794…12899). Runs as e2e-committee (cpd_committee role).
 * Seeds: 3 pending entries owned by the committee user (approve/adjust/
 * reject subjects) + 3 submitted events (approve/revise/reject subjects).
 */

const EMAIL = "e2e-committee@cpd-test.local";
const ADMIN_EMAIL = "e2e-admin@cpd-test.local";
const SLUGS = ["e2e-er-approve", "e2e-er-revise", "e2e-er-reject"];

test.use({ storageState: "e2e/.auth/committee.json" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`
      delete from cpd_entries
      where practitioner_id in (select id from profiles where email = ${EMAIL})
    `;
    await sql`delete from event_credit_allocations where accreditation_id in
      (select id from event_accreditations where event_id in
        (select id from events where slug = any(${SLUGS})))`;
    await sql`delete from event_accreditations where event_id in
      (select id from events where slug = any(${SLUGS}))`;
    await sql`delete from event_reviews where event_id in
      (select id from events where slug = any(${SLUGS}))`;
    await sql`delete from events where slug = any(${SLUGS})`;

    // 3 pending self-reported entries (review subjects)
    await sql`
      with me as (select id from profiles where email = ${EMAIL}),
           cy as (select id from cpd_cycles where is_current limit 1),
           t as (select id, default_category_id from activity_types
                 where code = 'CAT2_EXTERNAL')
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id,
         activity_type_id, credits, title, occurred_on, sessions)
      select (select id from me), 'self_reported', 'pending',
             (select id from cy), (select default_category_id from t),
             (select id from t), 2.0, v.title, '2026-06-15', 2
      from (values
        ('E2E IR approve entry'),
        ('E2E IR adjust entry'),
        ('E2E IR reject entry')
      ) as v(title)
    `;

    // 3 submitted events (accreditation-request subjects)
    await sql`
      with admin_p as (select id from profiles where email = ${ADMIN_EMAIL}),
           t1 as (select id from activity_types where code = 'CAT1_KNOWLEDGE')
      insert into events
        (title, slug, description, activity_type_id, status, venue_name,
         starts_at, ends_at, capacity, is_public, submitted_at,
         submitted_by, created_by)
      select v.title, v.slug, 'Submitted for e2e committee review.',
             (select id from t1), 'submitted', 'MMA HQ',
             now() + interval '30 days', now() + interval '30 days 8 hours',
             100, true, now(),
             (select id from admin_p), (select id from admin_p)
      from (values
        ('E2E Accreditation Approve', 'e2e-er-approve'),
        ('E2E Accreditation Revise',  'e2e-er-revise'),
        ('E2E Accreditation Reject',  'e2e-er-reject')
      ) as v(title, slug)
    `;
  } finally {
    await sql.end();
  }
});

test("IR1 — the entry queue lists the pending entries", async ({ page }) => {
  await page.goto("/committee/entries");
  await expect(
    page.getByRole("heading", { name: "Entry reviews" })
  ).toBeVisible();
  await expect(page.getByText("E2E IR approve entry")).toBeVisible();
  await expect(page.getByText("E2E IR adjust entry")).toBeVisible();
  await expect(page.getByText("E2E IR reject entry")).toBeVisible();
});

test("IR2 — approve as claimed stamps the review metadata", async ({
  page,
}) => {
  await page.goto("/committee/entries");
  await page
    .getByRole("link", { name: "Review E2E IR approve entry" })
    .click();
  await expect(page.getByText("Entry details")).toBeVisible();
  await expect(page.getByText("Review decision")).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "Approve as claimed" }).click();
    await expect(page.getByText("already been approved")).toBeVisible({
      timeout: 3000,
    });
  }).toPass();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { status: string; credits: string; reviewed_by: string | null }[]
    >`
      select status, credits, reviewed_by from cpd_entries
      where title = 'E2E IR approve entry'
        and practitioner_id = (select id from profiles where email = ${EMAIL})
    `;
    expect(row.status).toBe("approved");
    expect(Number(row.credits)).toBe(2);
    expect(row.reviewed_by).not.toBeNull();
  } finally {
    await sql.end();
  }
});

test("IR3 — adjust & approve overrides the credits with a reason", async ({
  page,
}) => {
  await page.goto("/committee/entries");
  await page.getByRole("link", { name: "Review E2E IR adjust entry" }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Adjust credits" }).click();
    await expect(
      page.getByRole("heading", { name: "Adjust & approve credits" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Approved credits").fill("1.0");
  await page
    .getByLabel("Adjustment reason")
    .fill("Only one session verified against the attendance sheet.");
  await page.getByRole("button", { name: "Approve entry" }).click();
  await expect(page.getByText("already been approved")).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { status: string; credits: string; review_comments: string | null }[]
    >`
      select status, credits, review_comments from cpd_entries
      where title = 'E2E IR adjust entry'
        and practitioner_id = (select id from profiles where email = ${EMAIL})
    `;
    expect(row.status).toBe("approved");
    expect(Number(row.credits)).toBe(1);
    expect(row.review_comments).toContain("attendance sheet");
  } finally {
    await sql.end();
  }
});

test("IR4 — reject stores the reason for the practitioner", async ({
  page,
}) => {
  await page.goto("/committee/entries");
  await page.getByRole("link", { name: "Review E2E IR reject entry" }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reject entry" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Reason for rejection").click();
  await page
    .getByRole("option", { name: "Evidence does not support the claimed activity" })
    .click();
  await page
    .getByLabel("Details for the practitioner")
    .fill("Please resubmit with a valid attendance record.");
  await page.getByRole("button", { name: "Reject entry" }).click();
  await expect(page.getByText("already been rejected")).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { status: string; review_comments: string | null }[]
    >`
      select status, review_comments from cpd_entries
      where title = 'E2E IR reject entry'
        and practitioner_id = (select id from profiles where email = ${EMAIL})
    `;
    expect(row.status).toBe("rejected");
    expect(row.review_comments).toContain("Evidence does not support");
  } finally {
    await sql.end();
  }
});

test("ER4 — approve & allocate creates the accreditation", async ({
  page,
}) => {
  await page.goto("/committee/events");
  await page
    .getByRole("link", { name: "Review E2E Accreditation Approve" })
    .click();
  await expect(page.getByText("Event overview")).toBeVisible();
  await expect(async () => {
    await page
      .getByRole("button", { name: "Approve & allocate credits" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Approve & allocate credits" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Approved credits").fill("6");
  await page.getByRole("button", { name: "Approve & accredit" }).click();
  await expect(page.getByText("This request is approved.")).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      {
        status: string;
        accreditation_number: string | null;
        credits: string | null;
      }[]
    >`
      select e.status, a.accreditation_number, x.credits
      from events e
      left join event_accreditations a
        on a.event_id = e.id and a.status = 'active'
      left join event_credit_allocations x on x.accreditation_id = a.id
      where e.slug = 'e2e-er-approve'
    `;
    expect(row.status).toBe("approved");
    expect(row.accreditation_number).toMatch(/^MMA-CPD-\d{4}-/);
    expect(Number(row.credits)).toBe(6);
  } finally {
    await sql.end();
  }
});

test("ER6 — request revisions lands as revisions-requested", async ({
  page,
}) => {
  await page.goto("/committee/events");
  await page
    .getByRole("link", { name: "Review E2E Accreditation Revise" })
    .click();
  await expect(async () => {
    await page.getByRole("button", { name: "Request revisions" }).click();
    await expect(
      page.getByRole("heading", { name: "Request revisions" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByText("Agenda / session breakdown").click();
  await page
    .getByLabel("Message to organizer")
    .fill("Please add a detailed session breakdown.");
  await page.getByRole("button", { name: "Send revision request" }).click();
  await expect(
    page.getByText("This request is revisions requested.")
  ).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<{ status: string; action: string }[]>`
      select e.status, r.action::text
      from events e
      join event_reviews r on r.event_id = e.id
      where e.slug = 'e2e-er-revise'
      order by r.created_at desc limit 1
    `;
    expect(row.status).toBe("rejected");
    expect(row.action).toBe("requested_revisions");
  } finally {
    await sql.end();
  }
});

test("ER5 — reject records the review row and reason", async ({ page }) => {
  await page.goto("/committee/events");
  await page
    .getByRole("link", { name: "Review E2E Accreditation Reject" })
    .click();
  await expect(async () => {
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Reject accreditation request" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Reason for rejection").click();
  await page
    .getByRole("option", { name: "Does not meet CPD accreditation criteria" })
    .click();
  await page.getByRole("button", { name: "Reject request" }).click();
  await expect(page.getByText("This request is rejected.")).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { status: string; action: string; comments: string | null }[]
    >`
      select e.status, r.action::text, r.comments
      from events e
      join event_reviews r on r.event_id = e.id
      where e.slug = 'e2e-er-reject'
      order by r.created_at desc limit 1
    `;
    expect(row.status).toBe("rejected");
    expect(row.action).toBe("rejected");
    expect(row.comments).toContain("accreditation criteria");
  } finally {
    await sql.end();
  }
});

test("AI3 — revoking the accreditation withdraws it", async ({ page }) => {
  await page.goto("/committee/audit");
  await expect(
    page.getByRole("heading", { name: "Accreditation history" })
  ).toBeVisible();
  await expect(async () => {
    await page
      .getByRole("button", { name: "Revoke E2E Accreditation Approve" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Revoke accreditation" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Reason for revocation").click();
  await page
    .getByRole("option", {
      name: "Sponsored / promotional content — not eligible",
    })
    .click();
  await page
    .getByLabel("Details")
    .fill("Post-review found the session was primarily promotional.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Revoke accreditation" })
    .click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<
      { status: string; revocation_reason: string | null }[]
    >`
      select a.status, a.revocation_reason
      from event_accreditations a
      join events e on e.id = a.event_id
      where e.slug = 'e2e-er-approve'
      order by a.created_at desc limit 1
    `;
    expect(row.status).toBe("revoked");
    expect(row.revocation_reason).toContain("promotional");
  } finally {
    await sql.end();
  }
});

test("a plain practitioner cannot reach the committee area (negative)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: "e2e/.auth/practitioner.json",
  });
  const page = await ctx.newPage();
  await page.goto("/committee/entries");
  await page.waitForURL(/\/dashboard/);
  await ctx.close();
});

test("committee pages have no serious/critical a11y violations", async ({
  page,
}) => {
  await page.goto("/committee/entries");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
