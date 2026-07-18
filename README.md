# Gradus — CPD Portal (MMA)

Continuing Professional Development portal for the Maldives Medical
Association. Product name: **Gradus**.

## Stack (locked 2026-05-23 — see `Stack.md` in the project vault)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + two-tier design tokens (`app/globals.css`) |
| Components | shadcn/ui (Radix) — owned in-repo under `components/ui` |
| Database | Supabase Postgres (`ap-south-1`) via **postgres-js** (`lib/db.ts`) |
| Auth | Supabase Auth behind a thin interface (`lib/auth`) |
| Storage | S3 protocol against Supabase Storage (`lib/storage.ts`) |
| Forms | React Hook Form + Zod (`lib/schemas` — shared client/server) |
| Server state | TanStack Query (`components/providers.tsx`) |
| Email | Resend (`lib/email.ts`) |
| PDF | `@react-pdf/renderer` in Node serverless functions (not Edge) |
| QR verify | UUID-in-QR → `/verify/<uuid>` (revocable) |

## Mandatory disciplines

1. **RLS**: every policy uses `(select auth.uid())`, never bare `auth.uid()`.
2. **Index** every column an RLS policy references.
3. **Provider-agnostic data layer**: queries via `postgres-js` + `DATABASE_URL`
   (never the Supabase JS client), auth behind `lib/auth`, storage via the
   S3 protocol. This is the data-residency escape hatch.
4. **Audit log is append-only** — no UPDATE/DELETE policies.
5. **Tokens first**: components read Tier-2 semantic tokens only
   (`bg-primary`, `text-status-pending`) — no raw hex/px, no `text-[13px]`.
   Every `className` merge goes through `cn()` (`lib/utils.ts`).

## Getting started

```bash
cp .env.example .env.local   # fill in Supabase / Resend keys
pnpm install
pnpm dev
```

## Layout

```
app/            routes (App Router) — (auth) and (portal) groups
components/ui/  shadcn primitives (owned, edit freely)
components/     patterns/ and features/ compose ui/ primitives
lib/db.ts       postgres-js client (server-only)
lib/auth/       auth interface + Supabase implementation
lib/schemas/    Zod schemas shared by RHF + API routes
lib/storage.ts  S3-protocol file storage
lib/email.ts    Resend client
supabase/       SQL migrations (schema source: vault Database Schema doc)
```

## Status & dev log

Phases **P0 (scaffold) → P3 (log activity + entries)** are complete: full
auth (passwordless email-link signup, roles, approval gate), app shell,
data-driven dashboard, the Log CPD Activity dialog (evidence upload → S3,
pre-registration gate), and the My CPD ledger + entry detail with withdraw.
Suite: 16 unit + 40 e2e green. Next: **P4 events**.

The build is documented in [`docs/dev-log/`](docs/dev-log/):
[build-progress](docs/dev-log/build-progress.md) (master checklist) ·
[current-state](docs/dev-log/current-state.md) (resume block) ·
[decisions-and-notes](docs/dev-log/decisions-and-notes.md) ·
[activity-log](docs/dev-log/activity-log.md). These are synced from the
project vault after every completed chunk.

## Testing

```bash
pnpm test:unit   # credit engine (Vitest, lib/ scope)
pnpm test:e2e    # Playwright + axe (seeds e2e users; needs the live DB)
```

## Design source

- Figma: `CPD-System` (fileKey `spdjUic9Nq5Os6Xd47QxQt`) — v1 Flow Map page,
  93 screens across Practitioner / Committee / Super Admin / Public.
- Tokens in `app/globals.css` are synced from the Figma variable collections;
  brand accent `#065BA1` = accent-9. Light mode only for v1.
