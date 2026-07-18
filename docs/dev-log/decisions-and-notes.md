# Decisions & Notes

> Running log of build decisions, gotchas, and deviations from the plan.

## 2026-07-02
- Created `development/` folder as the build-tracking home.
- Set up a Claude Code hook to auto-log dev-codebase file changes to [[Activity Log]].
- Phase checkboxes in [[00 - Build Progress]] are ticked by Claude as each step lands (a shell hook can't judge *which* step is done — the auto-hook logs raw file activity; the checklist is curated).
- Resuming from P1 (Auth).

## 2026-07-16
- **Supabase free tier auto-pauses the project after ~1 week idle.** Symptom: `ENOTFOUND anokimucjgtdfemrdcgp.supabase.co` (NXDOMAIN) → e2e global-setup dies with "fetch failed". Fix: restore via Management API (`POST /v1/projects/<ref>/restore`, token from macOS keychain "Supabase CLI"), takes ~3 min to `ACTIVE_HEALTHY`. Consider upgrading the project or a keep-alive ping before client demos.
- Session "finish CPD in phases" started: baseline re-verified green (unit 16/16, e2e 29/29), LA1–LA7 frames scanned. Paused before writing code — full resume block in [[Current State]].

## 2026-07-04
- **P3 migration deviation (documented in-file):** `cpd_entries` is created BEFORE the Part 4 event tables, so its four event-provenance FK constraints (events / event_attendances / event_accreditations / event_credit_allocations) are deferred to the P4 events migration. Safe: until P4, every row is `self_reported`, whose CHECK forces all event columns null. P4's migration MUST add the four `alter table … add constraint … on delete restrict/set null` lines.
- Supabase project created by client: **CPD-System** (`anokimucjgtdfemrdcgp`, org `yfosonjrfqcrzwydjwuh`, ap-south-1 Mumbai). Owned by a **different Supabase account** than the CLI's previous login (which held mma-membership, Akuru, fitbasev2, mma-v0).
- Re-logged the CLI into the owning account to link + push. **⚠️ This switched the CLI's default account** — to work with the other 4 projects again, run `supabase login` and switch back.
- Applied identity migrations via `supabase db push` (user ran it; DB password kept in their terminal). Verified end-to-end against the remote DB (tables, RLS, signup trigger, cascade) using the service_role key over PostgREST + Auth admin API.
- `.env.local` written with project URL + anon + service_role keys. **DATABASE_URL still has a `[YOUR-DB-PASSWORD]` placeholder** — must be filled for app runtime queries.
- Gotcha logged: `UID` is a reserved zsh variable — never use it as a script var name (caused "bad math expression").
- **Typography direction (user, 2026-07-04, REVISED same day): body stays Regular; ONLY form labels are Geist Light** (`ui/label.tsx` = `font-light` instead of shadcn's `font-medium` — inherited by every FormLabel). The brief global-light experiment was reverted. ⚠️ Figma label styles show Regular/Medium — sync labels to Light for parity.
- **Signup flow decision (user, 2026-07-04): email-link / passwordless signup, exactly as designed.** AU3 collects the 6 designed fields (no password) → `signInWithOtp(shouldCreateUser: true, metadata)` creates the account → AU5 success → Supabase emails a verification/magic link (AU6) → clicking signs them in → AU8 set-password → AU9 pending gate until approved. AU8 doubles as the reset-password screen for AU7's flow. Known caveat: dev testing throttled by Supabase's built-in sender (~2–4 emails/hr) until Resend SMTP is wired.
