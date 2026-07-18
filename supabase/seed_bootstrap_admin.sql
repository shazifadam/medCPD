-- ============================================================================
-- Bootstrap the first MMA admin.
--
-- The first mma_admin can't be granted through the API (every write policy on
-- role_assignments requires an *existing* mma_admin). This seed runs as the
-- service role (RLS-exempt) and grants the role directly.
--
-- Prerequisite: the target person has already signed up (an auth.users row +
-- profiles row exist for their email). Then run, substituting the email:
--
--   psql "$DATABASE_URL" \
--     -v admin_email="admin@mma.mv" \
--     -f supabase/seed_bootstrap_admin.sql
--
-- Idempotent: re-running does nothing if the active grant already exists
-- (the partial unique index idx_role_assignments_one_active guards it, and
-- the WHERE NOT EXISTS avoids a constraint error on re-run).
-- ============================================================================

insert into role_assignments (user_id, role, granted_by)
select p.id, 'mma_admin', null
from profiles p
where p.email = :'admin_email'
  and not exists (
    select 1 from role_assignments ra
    where ra.user_id = p.id
      and ra.role = 'mma_admin'
      and ra.revoked_at is null
  );

-- Optional: mark the bootstrap admin's own registration verified so they can
-- use the portal immediately (they approve everyone else after).
update profiles
set registration_state = 'verified',
    verified_at = now()
where email = :'admin_email'
  and registration_state <> 'verified';
