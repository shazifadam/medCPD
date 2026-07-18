# Current State

**Snapshot date:** 2026-07-18 (P3 ✅ COMPLETE — LA + EN both landed, e2e 40/40, unit 16/16 — P4 events next)

## ▶ RESUME HERE — 2026-07-18 evening (P3 done; next: P4 events)

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
