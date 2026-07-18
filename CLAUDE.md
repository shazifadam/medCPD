# Gradus CPD — development rules

## Test gate (MANDATORY)

Work proceeds in small chunks; **no chunk is done until its Playwright
tests pass**, and no new phase/step starts while the suite is red.

- Every flow gets E2E coverage as it's built: happy path AND the
  negative paths (wrong input, blocked access, forbidden transition) —
  negative-path tests are the centre of gravity per the vault Testing
  Strategy doc.
- Run `pnpm test:e2e` after every chunk; fix before moving on.
- Keep the E2E suite lean — credit-math permutations and RLS policies
  belong in unit/pgTAP layers, not Playwright.
- A11y: `@axe-core/playwright` smoke on each new page (serious/critical
  violations fail the test).
- Config: `playwright.config.ts` (1440×1024 viewport = Figma frame size,
  auto-starts `pnpm dev`). Tests live in `e2e/`.

## Figma-first workflow (MANDATORY)

Every screen/UI task starts in Figma, not in code:

1. **Scan the design before building.** Find the screen's frame in the
   CPD-System Figma file (fileKey `spdjUic9Nq5Os6Xd47QxQt`) and pull it with
   `get_screenshot` + `get_design_context` (or `get_metadata` to locate it)
   BEFORE writing any component. Never build a screen from memory or from
   the spec docs alone.
2. **Where screens live:** page `v1 Flow Map` (`286:1330`), organised
   role → flow → screen. Sections: PRACTITIONER `286:1331` (AU, DB, LA, EN,
   EV, AT, CT, PF), CPD COMMITTEE `286:1332` (ER, IR, AI), SUPER ADMIN
   `286:1333` (OD, RA, OG, EM, FM, UM, CA, AL), PUBLIC `286:1334` (PB).
   Frames are named `<FLOW><n> — <state>` (e.g. `AU1 — Login, default`).
   Mobile practitioner screens: page `Mobile` (`505:1330`). Empty/loading/
   error states: page `Enhancements` (`527:12902`).
3. **The build must align with the design** — layout, spacing, component
   choice, and states must match the frame. Deviations (responsive
   adaptations, interaction details the static frame can't show) are fine
   but must be deliberate and noted in the PR/summary, not accidental.
4. Cover every designed state of the flow (default / error / empty /
   success frames), not just the happy path.

## Design tokens

- Components read Tier-2 semantic tokens ONLY (`bg-primary`,
  `text-status-pending`, `border-border`). No raw hex, no `text-[13px]`,
  no Tier-1 primitives (`--gray-6`) in components.
- Tokens in `app/globals.css` are synced from the Figma variable
  collections (Light mode). If a design value seems missing, sync the
  token — don't hardcode.
- All `className` composition goes through `cn()` from `lib/utils.ts`.

## Data layer disciplines (from the locked Stack doc)

- Queries via `postgres-js` (`lib/db.ts`) against `DATABASE_URL` — never
  the Supabase JS client.
- Auth only through the `@/lib/auth` interface.
- File storage via the S3 protocol (`lib/storage.ts`).
- Zod schemas in `lib/schemas/` validate on BOTH client (RHF resolver)
  and server (API route) — never one side only.
- RLS policies always wrap: `(select auth.uid())`. Index every column an
  RLS policy references. `audit_log` is append-only.

## Source-of-truth docs (Obsidian vault)

`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/Freelance/projects/CPD System - MMA/`

- `research/Database Schema.md` — full schema (Parts 1–5) + seeds
- `research/Credit Framework.md` — the official MMA credit matrix + open
  clarifications C1–C7 (C1: overall cycle total still unstated — 50.0 is
  a placeholder)
- `research/Credit Logic.md` — the five-limit credit engine
- `research/Initial Launch Level.md` — v1 scope (what's deferred)
- `research/v1 Screen & Flow Inventory.md` — every screen, coded
- `research/Stack.md` — locked stack + disciplines
