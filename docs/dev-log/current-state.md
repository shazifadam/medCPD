# Current State

**Snapshot date:** 2026-07-19 (P6 ✅ COMPLETE — admin suite + audit_log, e2e 66 green, unit 16/16, pushed — P7 certificates next)

## ▶ RESUME HERE — 2026-07-19 (P6 done; next: P7 certificates)

**P6 landed (2026-07-19):**
- ✅ Migration `20260719110000_audit_log.sql` (Part 6: audit_log + CHECKs + `audit_row_changes()` security-definer trigger on **14 tables** — fully-audited compliance set + configuration-audited framework set; snapshot-table triggers deferred with their tables). ⚠️ **Attribution note:** postgres-js writes carry no JWT → `actor_id` null; AL/OD1 resolve the actor from the row snapshot's updated_by/reviewed_by/created_by (app-level `app.audit_context` wiring = follow-up).
- ✅ **OD1** rebuilt: live tiles (pending approvals+events, entries also pending, active practitioners, certificates 0 til P7) + **Needs attention** (linked items incl. cycle countdown) + **Recent activity** (audit_log).
- ✅ **EM1–EM8** `/admin/events`: list w/ status pills → `new` (create form — **wizard compressed to one form, sessions post-creation**, noted deviation) → `[id]` manage page (EM5 tiles + Manage panel: submit-for-accreditation feeds the ER queue, cancel w/ confirm) → `roster` (EM6 tabs + remove) → `attendance` (**EM7: self check-ins pre-ticked → "Verify & award credits to N"** — verifies pending attendances + creates pending event-derived entries; resolves AT4). EM8 participants detail folded into roster (deviation).
- ✅ **UM1/UM3** `/admin/users`: list w/ roles/status/joined + Manage-roles dialog (grant/revoke via role_assignments; self-demotion guard). Invite + deactivate (UM4) deferred — profiles has no is_active; needs auth-admin surface (noted).
- ✅ **AL1** `/admin/audit-log`: newest 100 w/ action pills + actor + target (search/filters/export + AL2 detail = reporting pass, noted). **FM1/5/6** `/admin/framework`: read-only cycle + floors + rate book (editing = FM7 warning path, deferred pending C1). **OG1/OG2** `/admin/organizations`: list + register dialog (OG3 org detail deferred).
- ✅ e2e `admin.spec.ts` 7 tests (OD1, EM create→submit DB-asserted, **EM7 verify→award DB-asserted**, UM grant/revoke DB-asserted, OG register, FM+AL live, axe). **Suite 66 e2e green (65+1 retry-flake), unit 16/16.** Playwright: `retries: 1` locally + workers 3 (suite outgrew the dev server; every spec passes in isolation — flakes are saturation, not bugs).
- 🗒️ e2e cross-spec rules learned: approved events leak into every user's /events browse → after clicking a card title, `waitForURL(/\/events\/[uuid]/)` before touching detail buttons; direct action buttons (no dialog) also need the `expect().toPass()` click-retry wrapper.

## ▶ P7 RESUME BLOCK — paused 2026-07-20 mid-scan, NO P7 code written yet

**Where P7 stands:** research/scan phase ~70% done, zero code. Pick up at "next steps" below.

**Done so far (this session):**
- Frame IDs found — **CT1** `287:12998` (certificates list), **CT2** `287:13001` (event cert detail/download), **CT3** `287:13004` (cycle-completion cert detail), **CT4** `287:13007` (public QR verification — this IS the PB flow), **PF1–3** `287:13021/13024/13027` (profile — still unbuilt, /profile 404s; fold into P8 or do alongside P7). **CA1** `287:13011` (admin list), **CA2** `287:13014` (manual issue dialog), **CA3** `287:13017` (revoke dialog). None screenshotted yet — do that first (Figma-first rule).
- Schema read (Database Schema.md): **certificates DDL ~line 3884** (kind enum event_attendance|cycle_completion at ~3873; CHECKs partition FK columns by kind; payload jsonb = frozen snapshot w/ documented shape ~3981; two partial unique indexes = one active cert per practitioner-per-event / per-cycle; storage_bucket/path pair for the rendered PDF), **RLS block** (practitioner reads own; committee narrow revoke UPDATE active→revoked w/ revoked_by pinned; admin all; NO client INSERT — issuance is service-role only; NO public SELECT), **`verify_certificate(p_certificate_number)`** security-definer RPC = the ONLY public verify path (returns redacted fields incl. names from payload, not live joins).
- certificate_status enum already exists (0004); certificate_kind does NOT — goes in the P7 migration.

**Exact next steps:**
1. Screenshot CT1–4, CA1–3 (+ PF1–3 if doing profile) via get_screenshot; review before building.
2. Migration `…_certificates.sql`: certificate_kind enum + certificates table + indexes + RLS + verify_certificate() — all verbatim from schema doc (read the payload design notes ~3978–4000 again for the payload shape). Push + verify.
3. Issuance pipeline (service-role server actions, per schema design notes):
   - Event-attendance certs: issue on demand for verified attendance at a completed/approved event (v1: "Download certificate" generates-if-missing) — number `MMA-CERT-<yyyy>-<seq>`.
   - Cycle-completion certs: issue when aggregateCycle(...).complete (DB3 button path) — number `MMA-CYCLE-<cycle>-<seq>`.
   - CA2 manual issue + CA3/AI4 revoke (committee/admin; revoke = narrow status flip w/ reason).
4. PDF: @react-pdf/renderer (already a dep, render in Node runtime route — NOT Edge), embed QR (qrcode dep) pointing at `${NEXT_PUBLIC_APP_URL}/verify/<certificate_number>`; upload to a private `certificates` bucket (create like cpd-evidence; storage session-token auth already works); store storage_bucket/path on the row.
5. Public `/verify/[number]` page (CT4/PB): calls verify_certificate RPC via anon PostgREST or postgres-js; must be middleware-public (add to public paths like /auth) and render valid/revoked states.
6. Screens: `/certificates` practitioner list+detail (CT1–3, nav "Certificates" item exists only in ADMIN group — practitioner nav has no certificates item; DB3 dashboard button + My CPD are the entry points per design), `/admin/certificates` (CA1–3). Wire DB3 "Download certificate" button on dashboard complete state.
7. e2e `certificates.spec.ts`: issue-on-download happy path (needs a complete cycle → seed approved entries ≥ target for a dedicated user... or issue event cert from admin.spec's verified attendance — cheaper), verify page valid + revoked states, CA revoke negative (practitioner blocked). Full suite green.
8. Completion logging per [[cpd-completion-logging]] (vault+memory+docs+push).

**Then P8 polish (last phase):** PF1–3 profile screens (if not done in P7), empty/loading/error states (Enhancements page `527:12902`), self-host JetBrains Mono (fonts.gstatic DNS flake), app.audit_context wiring for audit actor attribution, notifications, settings, AL search/filters/export, dark-mode token sync, Resend SMTP, and the pre-launch checklist (C1 cycle total confirmation with MMA, commit strategy, deploy).

---

## (superseded) P5 snapshot — 2026-07-19

**P5 landed (2026-07-19):**
- ✅ Migration `20260719090000_event_reviews.sql` (Part 4d: event_review_action enum + append-only event_reviews + RLS) pushed + verified.
- ✅ **IR1–IR4** `/committee/entries` + `[id]`: queue (pill tabs Pending/Approved/Rejected/All), detail (entry details, evidence downloads, practitioner card w/ cycle totals), decisions = **Approve as claimed / Adjust & approve (credits + category + reason, `calc_inputs.committee_adjusted_credits`) / Reject (reason select + details)**. This CLOSES the credit loop — pending entries (self-reported AND event-derived) now become approved/rejected.
- ✅ **ER1–ER6** `/committee/events` + `[id]`: queue (Pending/Revisions/Approved/All; revisions = status rejected + last review action requested_revisions per 4d), detail (overview/agenda/requested accreditation from rate-book default), decisions in ONE tx per the 4d atomicity contract: **Approve & allocate** (event→approved + accreditation `MMA-CPD-<yyyy>-<seq>` + allocation + review row), **Request revisions**, **Reject**.
- ✅ **AI2/AI3** `/committee/audit`: accreditation history + revoke dialog — revocation flips the accreditation AND rejects+zeroes every entry that rode on it (design copy "credits withdrawn"), one tx. Deviations: per-organizer drill-down → P6 (needs organizations), AI1 audit-log search → P6 (needs Part 6 audit_log), AI4 revoke certificate → P7.
- ✅ Committee shell: `/committee/*` layout guard (cpd_committee or mma_admin), **nav Overview item removed** (design has 3 items), `homePathForRoles` committee → `/committee/entries`.
- ✅ e2e `committee.spec.ts` 10 tests (IR approve/adjust/reject, ER approve/revise/reject, AI revoke — all DB-asserted — + practitioner-blocked negative + axe). 6th e2e user **e2e-committee@cpd-test.local** (committee.json). **Suite 59/59, unit 16/16.**
- 🗒️ Gotcha: postgres-js param inside `jsonb_build_object` (and similar fn args) needs an explicit `::numeric` cast — "could not determine data type of parameter".

**Next: P6 admin** — audit_log table (Part 6) + OD1 attention/activity panels, EM manage events (admin creates/submits events — feeds the ER queue for real), OG organizations, FM framework management, UM users, AL audit log screen. Then P7 certificates → P8 polish.

---

## (superseded) P4 snapshot — 2026-07-18 late

**GitHub:** `https://github.com/shazifadam/medCPD` (remote `origin`, branch `main`) — P0–P3 pushed as the first commit; P4 commit follows this snapshot. Dev-log docs mirror into `CPD-Dev/docs/dev-log/` every completion (standing user directive, see memory `cpd-completion-logging`).

**P4 landed (2026-07-18):**
- ✅ Migrations `20260718100000_events.sql` (4 enums + events, event_sessions, event_organizers, event_accreditations, event_credit_allocations, event_registrations, event_attendances + `event_credit_for_role()` + **the 4 deferred event FKs on cpd_entries**) and `…100100_events_rls.sql` (41 policies, faithful; sessions/organizers/allocations trailing policies pattern-completed). Pushed + verified. event_reviews (Part 4d) deferred to P5.
- ✅ **EV1–EV5** `/events` (search + All/Registered/Past tabs + 2-col cards) and `/events/[id]` (About, Agenda from event_sessions, credit callout, Registration panel, EV4 confirm dialog, EV5 registered state + cancel). Deviation: Category/Date/Credits filter selects deferred (search+tabs cover v1); "Event by" = creator's institution, falls back to "Maldives Medical Association" (events has no host-org column by design).
- ✅ **AT1–AT5** `/events/my` (Upcoming/Past/Pending-verification tabs, date-tile rows, state pills) + check-in dialog (QR panel is visual-only; attestation checkbox drives it). **Check-in decision:** registered + attested → attendance VERIFIED (self-attested) + **pending cpd_entry** priced via event_credit_for_role in ONE transaction (AT3, "+N credits awarded" = pending until MMA review, matching EV3 copy); walk-in + prereg-required → pending attendance, no entry (AT5); walk-in otherwise → pending attendance (AT4). AT5/AT4 walk-in outcomes have **no v1 UI entry point** (future QR deep-link) — server logic ready.
- ✅ **RA1–RA4** `/admin/approvals` (Pending/Approved/Rejected/All chips + queue) + `/admin/approvals/[id]` (details, Decision card, Application meta) + approve dialog (grants practitioner role, fixed role/cycle in v1) + reject dialog (reason select + details → `profiles.rejection_reason`). Deviation: designed IC/passport, qualification, practice + verification-documents sections not collected at signup (P1) — render from what exists.
- ✅ Dashboard "Upcoming events" panel now live (top 3, Register/Check-in CTA).
- ✅ e2e: `events.spec.ts` (5: browse+search, EV3→EV5 register, **AT check-in → DB-asserted verified attendance + pending entry w/ provenance**, cancel-registration, axe) + `approvals.spec.ts` (4: queue, approve→role granted DB-assert, reject→reason DB-assert, axe). **Suite 49/49**, unit 16/16. New e2e users: e2e-events (events.json), e2e-applicant-a/b (seeded in-spec).
- **Gotchas this session:** CTE inserts aren't visible via the base table in the same statement (join the CTE, not the table — broke the event seed's allocations); Radix dialog clicks can land pre-hydration under full-suite load → wrap open-click in `expect(...).toPass()`; `rm -rf .next` forces next/font/google re-fetch — if fonts.gstatic.com DNS fails the dev server throws `useContext` null Server Errors until it recovers (consider self-hosting JetBrains Mono in P8); playwright now `workers: 4`, expect timeout 10s, test timeout 60s.

**Next: P5 committee** — ER entry review queue (approve/reject pending entries — completes the credit loop incl. event-derived entries), event_reviews table (Part 4d) + EV submission review, IR institution review, AI audit sampling. Then P6 admin rest → P7 certificates → P8 polish (incl. self-host fonts, AT walk-in QR path).

---

## (superseded) P3 snapshot — 2026-07-18

**P3 EN1–EN7 landed (same day, after the LA block below):**
- ✅ `/my-cpd` (EN1–EN3): `lib/entries.ts` (getMyCpdData / getRecentEntries / getEntryDetail; **counted totals come from aggregateCycle via `DashboardData.perCategory`**, never raw sums), `components/features/entries/{entries-card,status-badge,withdraw-button}.tsx`. Four category cards render (design frames show 3 — deliberate; matrix has 4). "Floor met" note uses **text-status-approved** (text-success #08c29d fails AA at 12px — axe caught it).
- ✅ `/my-cpd/[id]` (EN4–EN6): details + evidence (presigned download URLs) + Review panel branching by status. EN6 "Revise & resubmit" = link back to /my-cpd (v1 simplification, noted). EN7 withdraw = AlertDialog → server action hard-deletes pending self-reported entry + best-effort S3 byte cleanup, redirects to /my-cpd.
- ✅ Dashboard "Recent CPD entries" panel now renders the last 4 real entries (rows link to detail).
- ✅ e2e: `entries.spec.ts` 7 tests (EN1 ledger+chips, EN2 tab filter+chip+search, EN4 approved/no-withdraw, EN6 rejected reason, EN5+EN7 withdraw loop, EN3 empty, axe) — **full suite 40/40**. Fourth seed user **e2e-entries-view@cpd-test.local** (`entries-view.json`), ledger seeded via direct SQL in beforeAll; spec is `serial` (fullyParallel + per-worker beforeAll wipes race otherwise — log-activity.spec made serial too).
- ⚙️ **Perf fixes for the grown suite:** `lib/db.ts` postgres-js `max: 20` (default 10 queued under parallel page renders) and playwright `workers: 6` locally (dev server saturates above ~6 → 40s flake timeouts). Full-suite flakes before these fixes were cold-compile/saturation, not app bugs.
- 🗒️ postgres-js may return `date`/jsonb columns as Date objects / strings — `lib/entries.ts` has `isoDate()` normalizer; specs parse jsonb defensively.

**Next: P4 events** — EV/AT frames scan first (Figma-first), events + attendance + accreditation tables, **MUST add the 4 deferred event FKs on cpd_entries** (see 0008 header), RA approvals, dashboard Upcoming events panel. Then P5 committee → P6 admin → P7 certificates → P8 polish.

---

## (superseded) P3 LA resume block — 2026-07-18

**P3 Log Activity landed this session (2026-07-18):**
- ✅ Migration `20260716120000_cpd_entry_attachments.sql` (Part 5d, faithful DDL + RLS) pushed & verified on remote.
- ✅ Storage: private bucket **`cpd-evidence`** created (schema-doc name, NOT the resume note's `evidence`; 50 MB limit to match the DB CHECK). **No dashboard-minted S3 keys needed** — `lib/storage.ts` falls back to Supabase S3 *session-token auth* (accessKeyId = project ref, secret = anon key, sessionToken = service-role JWT) when `S3_ACCESS_KEY_ID` is empty; probe PUT/GET/DELETE verified. Minting real keys later just fills the env vars.
- ✅ LA1–LA7 dialog: `components/features/log-activity/{log-activity-dialog,category-step,entry-form-fields,evidence-field,callouts}.tsx`, `lib/activities.ts` (options loader), `logActivitySchema` in `lib/schemas`, action `app/(portal)/dashboard/actions.ts` (prices via `priceEntry`, uploads evidence, sha256 checksum, rolls entry back if upload fails).
- ✅ **LA6 pre-reg gate decision:** subcategory `pre_registration='required'` → entry inserted with **credits 0.0**, `calc_inputs.pre_registration_gate=true` + `ungated_credits`. ⚠️ Deliberate deviation: CAT1 seeds say `allows_self_report=false` (RLS would block PostgREST inserts) but the server action writes via postgres-js (owner role) per the LA6 design ("log for your record"). Revisit if the API surface ever opens.
- ✅ `lib/dashboard.ts` now takes `practitionerId` and runs approved entries through **`aggregateCycle`** (counted totals); pending = raw sum. DB2/DB3 states are now reachable with real data.
- ✅ e2e **33/33** (`log-activity.spec.ts`: happy path, LA5 empty-submit, LA6 gate w/ DB assertion, axe). New third seed user **e2e-entries@cpd-test.local** (`e2e/.auth/entries.json`) for entry-creating specs — keeps e2e-practitioner pristine for DB4 empty-state. `e2e/db.ts` = service DB helper for spec setup/teardown.
- **Playwright gotchas:** FormControl labels name the trigger (date button = "Date", not its placeholder); rdp day cells are `gridcell`s named "Wednesday, July 1st, 2026"; postgres-js may return jsonb as a *string* in spec context — parse defensively; dialog needs exactly ONE DialogTitle (sr-only + visible dupe = strict-mode violation).

**Next steps:**
1. **EN1–EN7** (nodes `287:12871`–`287:12889`, not yet scanned) — scan per Figma-first rule, then entries list/detail (+ "Recent CPD entries" table on the dashboard, still placeholder).
2. Then P4 events (+ MUST add the 4 deferred event FKs on cpd_entries) → P5 committee → P6 admin → P7 certificates → P8 polish.

---

## (superseded) resume block — 2026-07-16 (P3 Log Activity, scan done, build not started)

**Session goal was:** "finish CPD system completely in phases" (P3 → P8). Paused right before writing P3 code.

**Done this session:**
- ✅ Baseline re-verified green: unit **16/16**, `tsc --noEmit` clean, e2e **29/29** (2026-07-16).
- ⚠️ **Supabase project had auto-PAUSED** (free tier, ~1 week idle → DNS NXDOMAIN, e2e global-setup "fetch failed"). **Restored** via Management API: token from macOS keychain `security find-generic-password -s "Supabase CLI" -w` (strip `go-keyring-base64:` prefix, base64 -d) → `POST https://api.supabase.com/v1/projects/anokimucjgtdfemrdcgp/restore` → poll `/v1/projects` until `ACTIVE_HEALTHY` (~3 min). **Expect this again after any idle week.**
- ✅ All 7 LA frames scanned per Figma-first rule (LA1 full `get_design_context`, LA2–LA7 screenshots reviewed).

**LA flow understanding (from the frames):**
- LA is a **two-step dialog over the dashboard** (not a route): opens from the "Log CPD activity" button.
- **LA1 (step 1):** "Log CPD activity / Choose what you'd like to log" — Activity type Select ("Select activity type") + 4 selectable category cards (Cat 1 Formal learning / Cat 2 Practice-based / Cat 3 Academic & scholarly / Cat 4 Leadership; selected = `accent` bg + 1.5px `primary` border + circle-check icon right). Footer: Cancel (outline) / Continue (primary). 560px wide dialog, scrim = navy `accent/12` @0.55.
- **LA2 (step 2, empty):** fields — Activity title (input, ph "e.g. Advanced Cardiac Life Support"), Activity type (select, e.g. "Cat 1 · Formal learning"), Date (calendar-icon field, ph "Select date"), Hours / sessions (input, ph "e.g. 8"), Description (textarea, ph "Describe the activity…"), Evidence (dashed dropzone: "Drag & drop or browse / PDF/JPG/PNG up to 10 MB"). Footer: Cancel / **Submit for review** (primary).
- **LA3:** same form filled (ACLS example, date 18 Jun 2026, hours 8).
- **LA4:** evidence uploaded state — file row replaces dropzone: accent icon tile (clipboard glyph) + filename `acls-certificate.pdf` + mono size `1.2 MB` + remove ✕.
- **LA5:** validation error — destructive callout at top ("Please complete the required fields." + "Some details are missing before you can submit.") + Date field red border + inline "Date is required" below it.
- **LA6:** pre-registration gate — **amber/pending callout**: "No credit will be awarded — This activity's sub-category (CAT1 1A) requires pre-registration. You can still log it for your record, but it won't count toward your cycle." Form still submittable.
- **LA7:** success dialog (small, centered): green success circle-check in pale-green circle tile, "Activity submitted", "Your entry is pending review. You'll be notified once it's approved.", full-width primary **Done** button.

**Figma node IDs (v1 Flow Map, fileKey `spdjUic9Nq5Os6Xd47QxQt`):**
- LA1 `287:12826` · LA2 `287:12829` · LA3 `287:12832` · LA4 `287:12835` · LA5 `287:12838` · LA6 `287:12841` · LA7 `287:12844`
- EN1 `287:12871` · EN2 `287:12874` · EN3 `287:12877` · EN4 `287:12880` · EN5 `287:12883` · EN6 `287:12886` · EN7 `287:12889` (not yet scanned)

**Exact next steps (was mid-way through pre-build checks when paused):**
1. Inspect `credit_subcategories` (pre_registration_rule lives THERE, not on activity_types) in `20260704120000_framework_cycles.sql`; activity-type codes/rates in `…140100_activity_rules_seed.sql`.
2. Read vault `Database Schema.md` **Part 5d `cpd_entry_attachments`** → write migration (+ RLS) and push.
3. Check `.env.local` has `S3_*` keys (endpoint/access/secret) — if missing, mint Supabase Storage S3 access keys + create private `evidence` bucket before upload wiring works.
4. Build: `lib/schemas` logActivity schema → `components/features/log-activity/` two-step dialog (LA1→LA2 states incl. LA4 file row, LA5 error callout + field errors, LA6 pre-reg amber callout via subcategory rule, LA7 success) → server action (submit via `priceEntry` from `lib/credits.ts`, insert `cpd_entries` + attachments, upload to S3 `evidence` bucket).
5. Switch `lib/dashboard.ts` sums to real `cpd_entries` reads (aggregateCycle) — makes DB2/DB3 testable.
6. e2e: log-activity happy path + validation-error + pre-reg-gate negative paths; then `pnpm test:e2e` full suite.
7. Then EN1–EN7 (task list continues P4–P8 as phased plan).

**Session task list (recreate on resume):** P3 LA (in progress) → P3 EN → P4 events+attendance+RA (+ MUST add 4 deferred FKs on cpd_entries) → P5 committee → P6 admin → P7 certificates/PDF/QR/PB → P8 polish.

---

**(previous snapshot 2026-07-02 below)**

## Where we are
- **Design:** ✅ 100% — all 93 v1 screens + 17 mobile screens in Figma.
- **Dev scaffold (P0):** ✅ complete, builds clean, uncommitted.
- **Phase 1 (Auth):** 🔄 partially started.

## Verified on disk (`CPD-Dev`)
```
app/(auth)/layout.tsx
app/(auth)/login/page.tsx
app/(auth)/login/actions.ts
app/(portal)/          ← empty
app/api/               ← empty
lib/auth/{index,supabase,types}.ts
lib/{db,email,storage,utils}.ts
lib/schemas/index.ts
e2e/{auth-login,smoke}.spec.ts
supabase/migrations/   ← empty (.gitkeep only)
```
- Git: single `Initial commit from Create Next App`; everything since is **uncommitted / untracked**.

## P1 progress (2026-07-02, evening)
Landed this session:
- `supabase/migrations/20260702120000_identity.sql` — full identity foundation.
- `supabase/migrations/20260702120100_identity_rls.sql` — all identity RLS.
- `supabase/seed_bootstrap_admin.sql` — first mma_admin seed.
- `lib/auth/identity.ts` — approval + role resolver (postgres-js).
- `middleware.ts` — session refresh + auth route gating.
- `app/(portal)/layout.tsx` — approval gate.
- `app/(auth)/pending/page.tsx` (AU6/AU7) + `app/(auth)/actions.ts` (signOut).
- Login action now routes by approval + role.
- ✅ `tsc --noEmit` clean · ✅ `eslint` clean · ✅ SQL offline balance check.

## ✅ P1 COMPLETE — proven live (2026-07-04)
Full loop verified by the user in-browser: signup → email link → `/auth/callback` → set password → login → **routed to `/admin` as mma_admin** (404 there = P2 not built yet, expected). e2e 20/20. First admin bootstrapped.

## P1 auth screens complete (2026-07-04)
- Remote Supabase **CPD-System** (`anokimucjgtdfemrdcgp`) live: identity migrations + RLS + specialties seed applied & verified.
- **All AU screens built** (AU1–AU9, passwordless email-link flow per design decision).
- `.env.local` fully configured (pooler host is **aws-1**-ap-south-1, not aws-0).
- **e2e: 17/17 passing** (`pnpm test:e2e`).

## Immediate next step
Manual live-loop test: sign up with a real inbox → email link → `/auth/confirm` → set password → `/pending`. Then run `seed_bootstrap_admin.sql` for the first admin and start **P2 (app shell + dashboard)** — `/dashboard` currently 404s for verified users.

## Open TODOs carried forward
- Live email-link loop untested (Supabase built-in sender, ~2–4 emails/hr until Resend SMTP).
- `/dashboard` route is P2 — verified users currently 404 post-login.
- Dark-mode tokens not yet synced (light only).
- Nothing committed to git yet — decide branch strategy before P1 lands.
- CLI is logged into the CPD-System Supabase account (switched from the other 4 projects).
