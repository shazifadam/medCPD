import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P6 — OD1 overview, EM manage events (create → submit → verify
 * attendance), UM roles, FM framework, OG organizations, AL audit log.
 * Runs as the admin; the EM7 attendance subject is the admin themselves
 * (they hold the practitioner role) so no other spec's data races this one.
 */

const ADMIN_EMAIL = "e2e-admin@cpd-test.local";
const ROLE_SUBJECT = "e2e-entries-view@cpd-test.local";
const EVENT_TITLE = "E2E Admin Created Event";
const ORG_NAME = "E2E Test Hospital";

test.use({ storageState: "e2e/.auth/admin.json" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    await sql`
      delete from cpd_entries
      where practitioner_id in (select id from profiles where email = ${ADMIN_EMAIL})
    `;
    await sql`
      delete from event_attendances
      where practitioner_id in (select id from profiles where email = ${ADMIN_EMAIL})
    `;
    await sql`
      delete from event_registrations
      where practitioner_id in (select id from profiles where email = ${ADMIN_EMAIL})
    `;
    await sql`delete from event_credit_allocations where accreditation_id in
      (select id from event_accreditations where event_id in
        (select id from events where title = ${EVENT_TITLE}))`;
    await sql`delete from event_accreditations where event_id in
      (select id from events where title = ${EVENT_TITLE})`;
    await sql`delete from events where title = ${EVENT_TITLE}`;
    await sql`delete from institutions where name = ${ORG_NAME}`;
    await sql`
      update role_assignments set revoked_at = now()
      where user_id in (select id from profiles where email = ${ROLE_SUBJECT})
        and role = 'organizer' and revoked_at is null
    `;
  } finally {
    await sql.end();
  }
});

test("OD1 — overview shows tiles, attention items and recent activity", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Operations overview" })
  ).toBeVisible();
  await expect(page.getByText("Pending approvals")).toBeVisible();
  await expect(page.getByText("Active practitioners")).toBeVisible();
  await expect(page.getByText("Needs attention")).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
});

test("EM1–EM4 — create a draft event and submit it for accreditation", async ({
  page,
}) => {
  await page.goto("/admin/events/new");
  await page.getByLabel("Event title").fill(EVENT_TITLE);
  await page.getByLabel("Activity type").click();
  await page
    .getByRole("option", { name: /Scientific meeting \/ conference/ })
    .click();
  await page.getByLabel("Venue").fill("MMA HQ, Malé");
  await page.getByLabel("Starts").fill("2026-09-01T09:00");
  await page.getByLabel("Ends").fill("2026-09-01T17:00");
  await page.getByLabel("Capacity").fill("50");
  await page
    .getByLabel("Description")
    .fill("Created by the admin e2e spec.");
  await page.getByRole("button", { name: "Create draft" }).click();

  // Redirects to the manage page as a draft
  await expect(
    page.getByRole("heading", { name: EVENT_TITLE })
  ).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Submit for accreditation" })
    .click();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

  const sql = connectDb();
  try {
    const [row] = await sql<{ status: string }[]>`
      select status from events where title = ${EVENT_TITLE}
    `;
    expect(row.status).toBe("submitted");
  } finally {
    await sql.end();
  }
});

test("EM7 — verify attendance awards the pending credit entry", async ({
  page,
}) => {
  // Accredit the event + register the admin with a pending self check-in.
  const sql = connectDb();
  try {
    await sql`
      with ev as (select id from events where title = ${EVENT_TITLE}),
           admin_p as (select id from profiles where email = ${ADMIN_EMAIL}),
           upd as (
             update events set status = 'approved',
               cycle_id = (select id from cpd_cycles where is_current limit 1)
             where id = (select id from ev) returning id
           ),
           acc as (
             insert into event_accreditations
               (event_id, accreditation_number, accredited_by)
             values ((select id from ev), 'MMA-CPD-E2E-ADMIN-1',
                     (select id from admin_p))
             returning id
           ),
           alloc as (
             insert into event_credit_allocations
               (accreditation_id, category_id, role_label, credits)
             select acc.id, at.default_category_id, null, 8.0
             from acc, events e
             join activity_types at on at.id = e.activity_type_id
             where e.id = (select id from ev)
             returning id
           ),
           reg as (
             insert into event_registrations
               (event_id, practitioner_id, role_label, status, confirmed_at)
             values ((select id from ev), (select id from admin_p),
                     'attendee', 'confirmed', now())
             returning id
           )
      insert into event_attendances
        (event_id, practitioner_id, registration_id, role_label, status, method)
      values ((select id from ev), (select id from admin_p),
              (select id from reg), 'attendee', 'pending', 'self_check_in')
    `;
  } finally {
    await sql.end();
  }

  await page.goto("/admin/events");
  await page.getByRole("link", { name: new RegExp(EVENT_TITLE) }).click();
  await page.getByRole("link", { name: "Verify attendance" }).click();

  // Self check-in comes pre-ticked (design) — verify & award
  await expect(page.getByText("1 of 1 marked attended")).toBeVisible();
  await expect(
    page.getByText("Self check-in", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Verify & award credits to 1" })
    .click();
  await expect(page.getByText("Attended", { exact: true })).toBeVisible();

  const sql2 = connectDb();
  try {
    const [row] = await sql2<
      { att_status: string; entry_status: string | null; credits: string | null }[]
    >`
      select a.status as att_status, e.status as entry_status, e.credits
      from event_attendances a
      left join cpd_entries e on e.attendance_id = a.id
      where a.practitioner_id = (select id from profiles where email = ${ADMIN_EMAIL})
        and a.event_id = (select id from events where title = ${EVENT_TITLE})
      order by a.created_at desc limit 1
    `;
    expect(row.att_status).toBe("verified");
    expect(row.entry_status).toBe("pending");
    expect(Number(row.credits)).toBe(8);
  } finally {
    await sql2.end();
  }
});

test("UM3 — granting and revoking a role updates assignments", async ({
  page,
}) => {
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Users & roles" })
  ).toBeVisible();
  await expect(async () => {
    await page
      .getByRole("button", { name: "Manage roles for E2E Entries View" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Roles", exact: true })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();

  await page.getByLabel("Organizer role").click();
  // The dialog stays open; the checkbox reflects the grant after refresh
  await expect(page.getByLabel("Organizer role")).toBeChecked();

  const sql = connectDb();
  try {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from role_assignments
      where user_id = (select id from profiles where email = ${ROLE_SUBJECT})
        and role = 'organizer' and revoked_at is null
    `;
    expect(row.n).toBe(1);
  } finally {
    await sql.end();
  }

  await page.getByLabel("Organizer role").click();
  await expect(page.getByLabel("Organizer role")).not.toBeChecked();

  const sql2 = connectDb();
  try {
    const [row] = await sql2<{ n: number }[]>`
      select count(*)::int as n from role_assignments
      where user_id = (select id from profiles where email = ${ROLE_SUBJECT})
        and role = 'organizer' and revoked_at is null
    `;
    expect(row.n).toBe(0);
  } finally {
    await sql2.end();
  }
});

test("OG — registering an organization lists it as a provider", async ({
  page,
}) => {
  await page.goto("/admin/organizations");
  await expect(async () => {
    await page
      .getByRole("button", { name: "Register organization" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Register organization" })
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.getByLabel("Organization name").fill(ORG_NAME);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByText(ORG_NAME)).toBeVisible();
  await expect(
    page.getByText("Accredited provider").first()
  ).toBeVisible();
});

test("FM + AL — framework and audit log render live data", async ({
  page,
}) => {
  await page.goto("/admin/framework");
  await expect(page.getByRole("heading", { name: "Framework" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rate book" })
  ).toBeVisible();
  await expect(page.getByText("Skill-based workshop", { exact: false })).toBeVisible();

  await page.goto("/admin/audit-log");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  // The spec's own writes guarantee rows exist
  await expect(page.getByText("Created").first()).toBeVisible();
});

test("admin pages have no serious/critical a11y violations", async ({
  page,
}) => {
  await page.goto("/admin");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
