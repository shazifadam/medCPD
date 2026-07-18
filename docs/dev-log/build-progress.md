# Build Progress — Master Checklist

> Ticked as each step completes. Phase order is the agreed build sequence. `✅` phase done · `🔄` in progress · `⬜` not started.

**Last updated:** 2026-07-18 (P3 COMPLETE — LA + EN flows, e2e 40/40; P4 events next, see [[Current State]])

---

## P0 — Scaffold ✅
- [x] Next.js 14.2 App Router + TS + Tailwind 3 + pnpm, clean build
- [x] shadcn/ui (new-york), 28 components in `components/ui/`
- [x] Locked-stack deps installed (zod, RHF, React Query, postgres-js, supabase, resend, react-pdf, qrcode, S3, cva/clsx, lucide, date-fns, next-themes/sonner/cmdk)
- [x] Design tokens synced from Figma → `app/globals.css` (two-tier, **light only**)
- [x] Provider-agnostic seams: `lib/db.ts`, `lib/auth/`, `lib/storage.ts`, `lib/email.ts`, `lib/schemas/`
- [x] `.env.example`, `CLAUDE.md` (Figma-first rule), Playwright + e2e scaffold
- [ ] Dark-mode token values synced from Figma (Primitives mode Dark `8:1`) — *deferred to P8*
- [ ] Commit scaffold to git *(all scaffold work still uncommitted)*

---

## P1 — Authentication + Identity 🔄
**DB — Migrations Part 1** *(✅ applied + verified on remote Supabase `anokimucjgtdfemrdcgp`, 2026-07-04)*
- [x] `profiles` table — `20260702120000_identity.sql` (MMDC fields, registration_state, verify cols)
- [x] `user_role` enum + `role_assignments` (append-only, revoke-aware, scoped) + `current_user_has_role()`
- [x] `registration_state` (pending/verified/rejected) + rejection/verify fields
- [x] RLS policies — `20260702120100_identity_rls.sql` (self / committee / mma_admin / institution_admin)
- [x] Seed: super-admin bootstrap — `supabase/seed_bootstrap_admin.sql` (idempotent, by email)
- [x] Signup trigger `handle_new_user()` (auth.users → profiles)
- [x] Full identity foundation incl. specialties + institutions tables (schema-faithful, features deferred)

**Auth screens (AU1–AU9, labels per inventory)** — *flow decision 2026-07-04: passwordless email-link signup, exactly as designed*
- [x] AU1/AU2 — Login default + error (wired to real Supabase auth + role redirect)
- [x] AU3 — Sign up, form (6 designed fields, no password; specialty dropdown from DB seed)
- [x] AU4 — Sign up, validation error (callout + inline errors)
- [x] AU5 — Sign up, success (pending approval card)
- [x] AU6 — Email verification → `/auth/confirm` route bridges link → session *(dedicated “check your inbox” page not built — AU5 covers the post-signup message; revisit if needed)*
- [x] AU7 — Forgot password (+ non-leaking sent state)
- [x] AU8 — Reset/set password (lock-icon fields, routes by approval/role)
- [x] AU9 — Account pending gate (`/pending`, covers rejected state too)

**Plumbing**
- [x] Supabase auth wired through `lib/auth` (sign-in/up/out, session, email links)
- [x] Auth seam extended: `signUpWithEmailLink` / `sendPasswordReset` / `updatePassword`
- [x] Identity/role resolver `lib/auth/identity.ts` (postgres-js — approval + roles)
- [x] `middleware.ts` — session refresh + signed-out/-in route gating
- [x] Pending-approval gate (`app/(portal)/layout.tsx` — unapproved → /pending)
- [x] Role-based redirect after login (`homePathForRoles`)
- [x] Specialties seed (18 placeholder entries, pending MMDC list Q6) — applied to remote
- [x] e2e: **17/17 passing** (login, signup AU3/4, forgot AU7, set-password gate, / auth-gate smoke, axe)
- [x] Live email-link loop tested end-to-end (signup → email → callback → set password → login) — fixed en route: PKCE `/auth/callback` code-exchange route (free tier can't customize templates → token_hash flow deferred to Resend SMTP), `/auth` exempted in middleware, redirect-resolves-undefined crash in login/set-password forms
- [x] Bootstrap first admin — hussain.shaxif002@gmail.com verified + `mma_admin` granted (2026-07-04)
- [x] `/auth/signout` GET escape hatch
- [x] AU3 redesign (Figma `294:13161`): PMR/TMR radio pair + live prefix in the number field
- [x] e2e final: **20/20 passing**

> **Verified 2026-07-04:** migrations applied to remote Supabase project `anokimucjgtdfemrdcgp` (CPD-System, ap-south-1) via `supabase db push`. Confirmed: all 6 identity tables exist, RLS enforced (anon → empty, not error), `handle_new_user()` trigger creates a profile with metadata + `registration_state='pending'`, and auth-user delete cascades to profile. `.env.local` created with URL + anon + service_role keys.
>
> **Still open:** (1) `DATABASE_URL` in `.env.local` needs the DB password filled so app runtime (postgres-js) works. (2) Post-login `/dashboard` route lands in P2 (currently 404 for verified users). (3) Bootstrap admin seed not yet run — needs the first admin to sign up first. (4) CLI is now logged into the CPD-System account (switched away from the 4 other projects).

---

## P2 — App Shell + Dashboard 🔄
- [x] Portal layout shell: Navbar (lockup/bell/settings/initials) + role-grouped Sidebar per Figma DB1/OD1 (`components/features/shell/`, nav config in `nav.ts` incl. committee group for P5)
- [x] `/admin` guard (mma_admin-only, others → /dashboard) + `/` → portal redirect (scaffold demo home retired)
- [x] OD1 first pass — header + 4 stat tiles (practitioner counts live; events/certs 0 until P4/P7). *Needs-attention + recent-activity panels pending (need audit_log).*
- [x] DB1 header pass — title + name·registration·specialty line (live). *Body pending framework seed.*
- [x] e2e auth infra: global-setup seeds e2e-practitioner/e2e-admin (idempotent) + storageState login; **27/27 passing** (shell render both roles, role guard negative, sign-out re-gate, axe both pages)
- [x] `signOut` scoped local (was global — would revoke all devices/sessions)
- [x] Migration Part 3a — cycles/categories/17 sub-tiers/caps + RLS + matrix seeds (`20260704120000` + `…120100`), pushed + verified on remote (2026–2027 cycle current, floors CAT1/CAT2=5, shelf caps 2D=3/4A=5/4B=6; ⚠️ total 50.0 = C1 placeholder)
- [x] DB1–DB4 — full dashboard body, all values data-driven (callout variants, 3 stat tiles, progress bar w/ floor tick, entries/events panels). With zero entries every user renders DB4 exactly; DB2/DB3 branch logic in `lib/dashboard.ts`, e2e for those states lands with P3 entries.
- [x] Contrast fix: welcome callout body full-primary (80% opacity failed WCAG 4.5:1 on accent bg)
- [x] e2e **29/29** (DB4 empty state fed by live seed values + axe)
- [ ] Part 3b — activity_types + framework_rules rate book (deferred to P3)
- [ ] OD1 — needs-attention + recent-activity panels (needs audit_log)
- [ ] Loading states wired (P8 polish)

---

## P3 — Log Activity + Entries 🔄
- [x] Migrations pushed + verified: Part 3b `activity_types` + `framework_rules` + RLS (`…140000`), 17 leaves + rate book seed (`…140100`), remaining Part 1 enums (`…145000` — gap found when 0008 failed on missing `cpd_entry_source`), `cpd_entries` + full RLS (`…150000`; event FKs deferred to P4, documented)
- [x] Credit resolver `lib/credits.ts` — five-limit engine in ONE place (priceEntry: flat/per_hour/per_session/banded/manual + Limit #1; aggregateCycle: #2 rule caps incl. per_year → #2.5 shelf caps → #3 ceilings → #4 floors + target). Reconciliation = doc Option A (counted totals).
- [x] Unit tests: vitest installed (`pnpm test:unit`, scoped to lib/) — **16/16** incl. the doc's Dr. A worked example (30/30 target met yet incomplete, CAT2 3/5) + banding boundaries + per_year windows + limit ordering
- [x] LA1–LA7 — Log Activity flow (two-step dialog over dashboard; evidence upload → S3 `cpd-evidence` via session-token auth; LA6 pre-reg gate = 0.0 credits + calc_inputs audit trail)
- [x] EN1–EN7 — Entries list (/my-cpd: progress + 4 category cards + tabs/search ledger) + detail (/my-cpd/[id]: evidence downloads, review panel by status, EN7 withdraw). Edit = withdraw & re-log (v1)
- [x] Zod schema + submit server action (prices via priceEntry, freezes calc_inputs); dashboard switched to aggregateCycle counted totals
- [x] cpd_entry_attachments (Part 5d) migration + RLS pushed; private `cpd-evidence` bucket + lib/storage session-token fallback
- [x] e2e: LA happy path + LA5 validation + LA6 gate (DB-verified) + axe — suite 33/33; DB2/DB3 states now reachable (dedicated specs still open)

---

## P4 — Events + Attendance ⬜
- [ ] Migrations: `events`, `registrations`, `attendance`
- [ ] EV1–EV5 — Event discovery / browse / detail / register
- [ ] AT1–AT5 — My events, attendance, result states
- [ ] RA — Registration/attendance approvals
- [ ] e2e: browse → register → attendance

---

## P5 — Committee ⬜
- [ ] Committee role gating + committee portal nav
- [ ] ER1–ER6 — Event review + approve/reject dialogs
- [ ] IR1–IR4 — Entry review
- [ ] AI1–AI4 — Audit & integrity (incl. destructive revoke dialogs)
- [ ] Review actions write audit-log rows

---

## P6 — Super Admin ⬜
- [ ] Admin role gating + admin portal nav
- [ ] OD — Overview dashboard
- [ ] OG — Organizations CRUD
- [ ] EM — Events manage (create wizard + roster/attendance/participants)
- [ ] FM — Framework management (categories, credit rules)
- [ ] UM — Users management (approve, roles, suspend)
- [ ] AL — Audit log viewer
- [ ] RA approvals surfaced in admin (if not in P4)

---

## P7 — Certificates + PDF + Public Verify ⬜
- [ ] Migrations: `certificates` + issuance
- [ ] CT1–CT4 — Practitioner certificates (view/download)
- [ ] CA — Certificate admin (issue/revoke)
- [ ] PDF generation (@react-pdf/renderer) — certificate document
- [ ] QR code (qrcode) → public verify URL
- [ ] PB1–PB3 — Public verification pages (no-shell)
- [ ] e2e: issue → download PDF → verify via QR link

---

## P8 — Enhancements + Polish ⬜
- [ ] Dark-mode tokens synced + theme toggle
- [ ] Empty / loading / error states across app (design page `527:12902`)
- [ ] Notifications
- [ ] Settings
- [ ] Mobile responsive pass (17 mobile screens designed)
- [ ] Accessibility + final QA
- [ ] Production env + deploy

---

## Cross-cutting (ongoing)
- [ ] Commit discipline — feature branches per phase
- [ ] Keep tokens in sync with Figma on any design change
- [ ] Update [[Current State]] at each phase boundary
