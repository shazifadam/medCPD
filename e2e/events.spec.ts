import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P4 — EV1–EV5 + AT1–AT3 (Figma 287:12931…12981). Runs as e2e-events with
 * two seeded approved events (accredited CAT2 2.0cr + CAT1 6.0cr). The
 * check-in test drives the full attendance → pending credit-entry pipeline.
 * AT5 (walk-in, no credit) has no v1 UI entry point — its server logic is
 * exercised by the pipeline test's DB assertions.
 */

const EMAIL = "e2e-events@cpd-test.local";
const ADMIN_EMAIL = "e2e-admin@cpd-test.local";
const SLUG_A = "e2e-external-cme-evening";
const SLUG_B = "e2e-cardiology-conference";

test.use({ storageState: "e2e/.auth/events.json" });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    // Wipe this user's event footprint + re-seed the two e2e events.
    await sql`
      delete from cpd_entries
      where practitioner_id in (select id from profiles where email = ${EMAIL})
    `;
    await sql`
      delete from event_attendances
      where practitioner_id in (select id from profiles where email = ${EMAIL})
    `;
    await sql`
      delete from event_registrations
      where practitioner_id in (select id from profiles where email = ${EMAIL})
    `;
    await sql`delete from event_credit_allocations where accreditation_id in
      (select id from event_accreditations where event_id in
        (select id from events where slug in (${SLUG_A}, ${SLUG_B})))`;
    await sql`delete from event_accreditations where event_id in
      (select id from events where slug in (${SLUG_A}, ${SLUG_B}))`;
    await sql`delete from event_sessions where event_id in
      (select id from events where slug in (${SLUG_A}, ${SLUG_B}))`;
    await sql`delete from events where slug in (${SLUG_A}, ${SLUG_B})`;

    await sql`
      with admin_p as (select id from profiles where email = ${ADMIN_EMAIL}),
           cy as (select id from cpd_cycles where is_current limit 1),
           t2 as (select id from activity_types where code = 'CAT2_EXTERNAL'),
           t1 as (select id from activity_types where code = 'CAT1_KNOWLEDGE'),
           ev as (
             insert into events
               (title, slug, description, activity_type_id, status, venue_name,
                venue_address, starts_at, ends_at, capacity, cycle_id, is_public, created_by)
             values
               ('E2E External CME Evening', ${SLUG_A},
                'Evening CME session for e2e coverage.',
                (select id from t2), 'approved', 'MMA HQ', 'Malé',
                now() - interval '1 hour', now() + interval '3 hours',
                50, (select id from cy), true, (select id from admin_p)),
               ('E2E Cardiology Conference', ${SLUG_B},
                'Full-day conference for e2e coverage.',
                (select id from t1), 'approved', 'ADK Hospital', 'Malé',
                now() + interval '7 days', now() + interval '7 days 8 hours',
                220, (select id from cy), true, (select id from admin_p))
             returning id, slug, activity_type_id
           ),
           acc as (
             insert into event_accreditations
               (event_id, accreditation_number, accredited_by)
             select ev.id,
                    'MMA-CPD-E2E-' || ev.slug,
                    (select id from admin_p)
             from ev
             returning id, event_id
           )
      insert into event_credit_allocations (accreditation_id, category_id, role_label, credits)
      select acc.id,
             at.default_category_id,
             null,
             case when ev.slug = ${SLUG_A} then 2.0 else 6.0 end
      from acc
      join ev on ev.id = acc.event_id
      join activity_types at on at.id = ev.activity_type_id
    `;
  } finally {
    await sql.end();
  }
});

test("EV1 — browse lists the seeded events with credit lines", async ({
  page,
}) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "CPD Events" })).toBeVisible();
  await expect(page.getByText("E2E External CME Evening")).toBeVisible();
  await expect(page.getByText("E2E Cardiology Conference")).toBeVisible();
  await expect(page.getByText("2.0 credits · Cat 2")).toBeVisible();
  await expect(page.getByText("6.0 credits · Cat 1")).toBeVisible();
  // Search narrows
  await page.getByLabel("Search events").fill("cardiology");
  await expect(page.getByText("E2E External CME Evening")).toHaveCount(0);
  await expect(page.getByText("E2E Cardiology Conference")).toBeVisible();
});

test("EV3→EV5 — register through the confirm dialog", async ({ page }) => {
  await page.goto("/events");
  await page.getByText("E2E External CME Evening").click();

  await expect(
    page.getByRole("heading", { name: "E2E External CME Evening" })
  ).toBeVisible();
  await expect(page.getByText("About this activity")).toBeVisible();
  await page.getByRole("button", { name: "Register" }).click();

  // EV4 confirm dialog
  await expect(page.getByText("Register for this event?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm registration" }).click();

  // EV5 registered state
  await expect(page.getByText("You're registered")).toBeVisible();
  await expect(page.getByText("Registered ✓")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel registration" })
  ).toBeVisible();
});

test("AT1→AT3 — check-in awards the pending credit entry", async ({
  page,
}) => {
  await page.goto("/events/my");
  await expect(page.getByRole("heading", { name: "My Events" })).toBeVisible();
  await expect(page.getByText("E2E External CME Evening")).toBeVisible();

  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Check in to event")).toBeVisible();
  // Confirm is gated on the attestation
  await expect(
    page.getByRole("button", { name: "Confirm check-in" })
  ).toBeDisabled();
  await page
    .getByText("I attest that I attended this session in full.")
    .click();
  await page.getByRole("button", { name: "Confirm check-in" }).click();

  // AT3 — success
  await expect(page.getByText("Checked in successfully")).toBeVisible();
  await expect(page.getByText("+2 CPD credits awarded")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();

  // DB: verified attendance + pending event-derived entry with provenance
  const sql = connectDb();
  try {
    const [row] = await sql<
      {
        att_status: string;
        entry_status: string | null;
        credits: string | null;
        accreditation_id: string | null;
      }[]
    >`
      select a.status as att_status, e.status as entry_status,
             e.credits, e.accreditation_id
      from event_attendances a
      left join cpd_entries e on e.attendance_id = a.id
      where a.practitioner_id = (select id from profiles where email = ${EMAIL})
        and a.event_id = (select id from events where slug = ${SLUG_A})
      order by a.created_at desc limit 1
    `;
    expect(row.att_status).toBe("verified");
    expect(row.entry_status).toBe("pending");
    expect(Number(row.credits)).toBe(2);
    expect(row.accreditation_id).not.toBeNull();
  } finally {
    await sql.end();
  }
});

test("EV5 — cancelling a registration restores the register CTA", async ({
  page,
}) => {
  // Use the future event (no attendance yet) for the cancel path.
  await page.goto("/events");
  await page.getByText("E2E Cardiology Conference").click();
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByRole("button", { name: "Confirm registration" }).click();
  await expect(page.getByText("You're registered")).toBeVisible();

  await page.getByRole("button", { name: "Cancel registration" }).click();
  await expect(page.getByRole("button", { name: "Register" })).toBeVisible();
  await expect(page.getByText("You're registered")).toHaveCount(0);
});

test("events pages have no serious/critical a11y violations", async ({
  page,
}) => {
  await page.goto("/events");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(serious).toEqual([]);
});
