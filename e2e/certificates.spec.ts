import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connectDb } from "./db";

/**
 * P7 — CT1–CT4 certificates + CA1/CA3 admin + public verify
 * (Figma 287:12998…13017). Runs as e2e-certs (dedicated user: issuance
 * writes certificates + needs a complete cycle, which would pollute the
 * pristine users). Seeds: one ended accredited event with a verified
 * attendance + pending entry (event-cert subject) and approved entries
 * totalling 55 credits with both floors met (cycle-cert subject).
 */

const EMAIL = "e2e-certs@cpd-test.local";
const ADMIN_EMAIL = "e2e-admin@cpd-test.local";
const SLUG = "e2e-cert-event";
const EVENT_TITLE = "E2E Certificate Symposium";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const sql = connectDb();
  try {
    // Wipe this user's prior runs (certs first — FKs restrict deletes).
    await sql`delete from certificates where practitioner_id in
      (select id from profiles where email = ${EMAIL})`;
    await sql`delete from cpd_entries where practitioner_id in
      (select id from profiles where email = ${EMAIL})`;
    await sql`delete from event_attendances where event_id in
      (select id from events where slug = ${SLUG})`;
    await sql`delete from event_registrations where event_id in
      (select id from events where slug = ${SLUG})`;
    await sql`delete from event_credit_allocations where accreditation_id in
      (select id from event_accreditations where event_id in
        (select id from events where slug = ${SLUG}))`;
    await sql`delete from event_accreditations where event_id in
      (select id from events where slug = ${SLUG})`;
    await sql`delete from events where slug = ${SLUG}`;

    // Ended approved event + active accreditation + verified attendance
    // + the entry the check-in pipeline would have created (AT3).
    await sql`
      with me as (select id from profiles where email = ${EMAIL}),
           admin_p as (select id from profiles where email = ${ADMIN_EMAIL}),
           cy as (select id from cpd_cycles where is_current limit 1),
           t as (select id, default_category_id from activity_types
                 where code = 'CAT2_EXTERNAL'),
           ev as (
             insert into events
               (title, slug, description, activity_type_id, status, venue_name,
                venue_address, starts_at, ends_at, capacity, cycle_id,
                is_public, created_by)
             values
               (${EVENT_TITLE}, ${SLUG}, 'Certificate e2e subject.',
                (select id from t), 'approved', 'MMA HQ', 'Malé',
                now() - interval '2 days',
                now() - interval '2 days' + interval '4 hours',
                50, (select id from cy), true, (select id from admin_p))
             returning id
           ),
           acc as (
             insert into event_accreditations
               (event_id, accreditation_number, accredited_by)
             select id, 'MMA-CPD-E2E-CERT', (select id from admin_p) from ev
             returning id, event_id
           ),
           att as (
             insert into event_attendances
               (event_id, practitioner_id, role_label, status, method,
                verified_at, verified_by)
             select (select id from ev), (select id from me), 'attendee',
                    'verified', 'self_check_in', now(), (select id from me)
             returning id, event_id
           )
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id,
         activity_type_id, credits, title, event_id, attendance_id,
         accreditation_id)
      select (select id from me), 'event_attendance', 'pending',
             (select id from cy), (select default_category_id from t),
             (select id from t), 3.0, ${EVENT_TITLE},
             (select event_id from att),
             (select id from att), (select id from acc)
    `;

    // Approved self-reported entries → complete cycle (55 ≥ 50, floors 5/5
    // met; subcats 1A/2A2 carry no shelf caps, rule caps need a rule id).
    await sql`
      with me as (select id from profiles where email = ${EMAIL}),
           cy as (select id from cpd_cycles where is_current limit 1),
           t1 as (select id, default_category_id from activity_types
                  where code = 'CAT1_KNOWLEDGE'),
           t2 as (select id, default_category_id from activity_types
                  where code = 'CAT2_EXTERNAL')
      insert into cpd_entries
        (practitioner_id, source, status, cycle_id, category_id,
         activity_type_id, credits, title, occurred_on, sessions,
         reviewed_at, reviewed_by)
      values
        ((select id from me), 'self_reported', 'approved',
         (select id from cy), (select default_category_id from t1),
         (select id from t1), 30.0, 'E2E cycle filler CAT1',
         '2026-05-10', null, now(), (select id from me)),
        ((select id from me), 'self_reported', 'approved',
         (select id from cy), (select default_category_id from t2),
         (select id from t2), 25.0, 'E2E cycle filler CAT2',
         '2026-05-11', 25, now(), (select id from me))
    `;
  } finally {
    await sql.end();
  }
});

test.describe("practitioner (CT1–CT3, DB3)", () => {
  test.use({ storageState: "e2e/.auth/certs.json" });

  test("CT1 — opening the certificates page issues eligible certs and lists them", async ({
    page,
  }) => {
    await page.goto("/my-cpd/certificates");
    await expect(
      page.getByRole("heading", { name: "Certificates", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Event certificate", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cycle completion certificate", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(EVENT_TITLE).first()).toBeVisible();

    // Issue-on-load wrote both rows with design-format numbers.
    const sql = connectDb();
    try {
      const certs = await sql<
        { certificate_number: string; kind: string; status: string }[]
      >`select certificate_number, kind, status from certificates
        where practitioner_id in (select id from profiles where email = ${EMAIL})
        order by kind`;
      expect(certs).toHaveLength(2);
      const ev = certs.find((c) => c.kind === "event_attendance");
      const cy = certs.find((c) => c.kind === "cycle_completion");
      expect(ev?.certificate_number).toMatch(/^GRD-EV-\d{4}-\d{6}$/);
      expect(cy?.certificate_number).toMatch(/^GRD-CY-\d{4}-\d{6}$/);
      expect(certs.every((c) => c.status === "active")).toBe(true);
    } finally {
      await sql.end();
    }
  });

  test("CT2 — event certificate detail renders the paper + details rail", async ({
    page,
  }) => {
    await page.goto("/my-cpd/certificates?type=event");
    await expect(async () => {
      await page.getByRole("link", { name: "View" }).first().click();
      await page.waitForURL(/\/my-cpd\/certificates\/[0-9a-f-]{36}$/, {
        timeout: 5_000,
      });
    }).toPass();
    await expect(
      page.getByRole("heading", { name: "Event certificate" })
    ).toBeVisible();
    await expect(page.getByText("CERTIFICATE OF ATTENDANCE")).toBeVisible();
    await expect(page.getByText("E2E Certificates", { exact: true })).toBeVisible();
    await expect(page.getByText("Certificate details")).toBeVisible();
    await expect(page.getByText(/^GRD-EV-\d{4}-\d{6}$/).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download PDF" })
    ).toBeVisible();
  });

  test("PDF route renders, uploads and redirects to a signed URL", async ({
    page,
  }) => {
    const sql = connectDb();
    let certId = "";
    try {
      const [row] = await sql<{ id: string }[]>`
        select id from certificates
        where practitioner_id in (select id from profiles where email = ${EMAIL})
          and kind = 'event_attendance' and status = 'active' limit 1`;
      certId = row.id;
    } finally {
      await sql.end();
    }

    const res = await page.request.get(`/my-cpd/certificates/${certId}/pdf`);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("application/pdf");

    const sql2 = connectDb();
    try {
      const [row] = await sql2<
        { storage_bucket: string | null; storage_path: string | null }[]
      >`select storage_bucket, storage_path from certificates where id = ${certId}`;
      expect(row.storage_bucket).toBe("cpd-certificates");
      expect(row.storage_path).toContain(".pdf");
    } finally {
      await sql2.end();
    }
  });

  test("DB3 — dashboard complete state downloads the cycle certificate", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByText("Cycle complete — certificate ready")
    ).toBeVisible();
    await page.getByRole("button", { name: "Download certificate" }).click();
    await page.waitForURL(/\/my-cpd\/certificates\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: "Cycle completion certificate" })
    ).toBeVisible();
    await expect(page.getByText("CERTIFICATE OF COMPLETION")).toBeVisible();
    await expect(page.getByText("All category floors met")).toBeVisible();
  });

  test("CT1 axe", async ({ page }) => {
    await page.goto("/my-cpd/certificates");
    await expect(
      page.getByText("Event certificate", { exact: true })
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});

test.describe("public verify (CT4/PB)", () => {
  // No storageState — anonymous visitor.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("valid certificate verifies; unknown ID says not found", async ({
    page,
  }) => {
    const sql = connectDb();
    let number = "";
    try {
      const [row] = await sql<{ certificate_number: string }[]>`
        select certificate_number from certificates
        where practitioner_id in (select id from profiles where email = ${EMAIL})
          and kind = 'event_attendance' limit 1`;
      number = row.certificate_number;
    } finally {
      await sql.end();
    }

    await page.goto(`/verify/${number}`);
    await expect(
      page.getByRole("heading", { name: "Certificate verified" })
    ).toBeVisible();
    await expect(page.getByText("E2E Certificates")).toBeVisible();
    await expect(page.getByText(number)).toBeVisible();

    await page.goto("/verify/GRD-EV-2099-999999");
    await expect(
      page.getByRole("heading", { name: "Certificate not found" })
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? "")
    );
    expect(serious).toEqual([]);
  });
});

test.describe("admin (CA1/CA3) + access control", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("CA1 — admin table lists the cert; CA3 revoke withdraws credits", async ({
    page,
  }) => {
    const sql = connectDb();
    let number = "";
    try {
      const [row] = await sql<{ certificate_number: string }[]>`
        select certificate_number from certificates
        where practitioner_id in (select id from profiles where email = ${EMAIL})
          and kind = 'event_attendance' and status = 'active' limit 1`;
      number = row.certificate_number;
    } finally {
      await sql.end();
    }

    await page.goto(`/admin/certificates?q=${number}`);
    await expect(
      page.getByRole("heading", { name: "Certificates", exact: true })
    ).toBeVisible();
    const revokeBtn = page.getByRole("button", { name: `Revoke ${number}` });
    await expect(async () => {
      await revokeBtn.click();
      await expect(
        page.getByRole("heading", { name: "Revoke certificate" })
      ).toBeVisible({ timeout: 3_000 });
    }).toPass();
    await page
      .getByPlaceholder("Add context for the audit trail")
      .fill("Attendance could not be verified after audit.");
    await page
      .getByRole("button", { name: "Revoke certificate", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Revoke certificate" })
    ).toBeHidden();

    // DB: cert revoked, riding entry rejected + zeroed.
    const sql2 = connectDb();
    try {
      const [cert] = await sql2<
        { status: string; revocation_reason: string | null; attendance_id: string }[]
      >`select status, revocation_reason, attendance_id from certificates
        where certificate_number = ${number}`;
      expect(cert.status).toBe("revoked");
      expect(cert.revocation_reason).toContain("Attendance could not be verified");
      const [entry] = await sql2<{ status: string; credits: string }[]>`
        select status, credits from cpd_entries
        where attendance_id = ${cert.attendance_id}`;
      expect(entry.status).toBe("rejected");
      expect(Number(entry.credits)).toBe(0);
    } finally {
      await sql2.end();
    }

    // Public verify now reports revoked.
    await page.goto(`/verify/${number}`);
    await expect(
      page.getByRole("heading", { name: "Certificate revoked" })
    ).toBeVisible();
  });
});

test.describe("practitioner blocked from admin surface", () => {
  test.use({ storageState: "e2e/.auth/certs.json" });

  test("/admin/certificates bounces non-admins to the dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/certificates");
    await page.waitForURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: "Certificates", exact: true })
    ).toBeHidden();
  });
});
