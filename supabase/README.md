# Database migrations

SQL migrations for the Supabase Postgres instance (`ap-south-1`).

The schema source of truth is the **Database Schema** doc in the project
vault (`CPD System - MMA/research/Database Schema.md`) — Parts 1–5 cover
identity/roles, organizations, the credit framework (cycles, categories,
sub-categories, activity types, rate book), events, and audit.

Conventions (non-negotiable, from the Stack doc):

- Every RLS policy wraps auth calls: `(select auth.uid())` — never bare
  `auth.uid()` (re-evaluated per row otherwise).
- Every column referenced by an RLS policy gets an index.
- `audit_log` is append-only: no UPDATE or DELETE policies, ever.
- Closed CPD cycles are locked by guard trigger — thresholds and caps
  on a snapshotted cycle must not be editable.

Apply with the Supabase CLI: `supabase db push` (or `supabase migration up`).
