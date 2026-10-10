-- ============================================================================
-- Fix 2: "Designation" + Medical Officer
-- Client decision 2026-10-10: the practitioner's field list is presented as
-- "Designation" in the UI (table/columns keep the specialties naming). Most
-- practitioners are Medical Officers, so the option is added with
-- display_order 5, which sorts it FIRST (seeded specialties start at 10).
-- Idempotent: re-running is a no-op if the code already exists.
-- ============================================================================

insert into specialties (code, name, display_order) values ('MO', 'Medical Officer', 5)
on conflict (code) do nothing;
