-- ============================================================================
-- 0002 — Identity RLS policies
-- Faithful to vault "Database Schema.md" RLS blocks for Parts 2a/2b/2c.
-- Every policy uses (select auth.uid()) per Stack discipline #1, and calls
-- current_user_has_role() wrapped in a subquery.
-- ============================================================================

-- --- profiles ---------------------------------------------------------------
alter table profiles enable row level security;

create policy "Users read own profile"
  on profiles for select
  using (id = (select auth.uid()));

create policy "Users update own profile"
  on profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "CPD committee reads all profiles"
  on profiles for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all profiles"
  on profiles for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin updates verification fields"
  on profiles for update
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "Institution admin reads own institution staff profiles"
  on profiles for select
  using (
    exists (
      select 1
      from institution_memberships im
      join role_assignments ra
        on ra.user_id = (select auth.uid())
       and ra.role = 'institution_admin'
       and ra.scope_institution_id = im.institution_id
      where im.practitioner_id = profiles.id
        and im.is_active
    )
  );

-- --- specialties + practitioner_specialties ---------------------------------
alter table specialties enable row level security;
alter table practitioner_specialties enable row level security;

create policy "Anyone reads active specialties"
  on specialties for select
  using (is_active or (select current_user_has_role('mma_admin')));

create policy "MMA admin writes specialties"
  on specialties for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "Practitioners read own specialties"
  on practitioner_specialties for select
  using (practitioner_id = (select auth.uid()));

create policy "Practitioners manage own specialties"
  on practitioner_specialties for all
  using (practitioner_id = (select auth.uid()))
  with check (practitioner_id = (select auth.uid()));

create policy "CPD committee reads all practitioner specialties"
  on practitioner_specialties for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all practitioner specialties"
  on practitioner_specialties for select
  using ((select current_user_has_role('mma_admin')));

-- --- institutions -----------------------------------------------------------
alter table institutions enable row level security;

create policy "Anyone reads verified active institutions"
  on institutions for select
  using (is_verified and is_active);

create policy "Institution admin reads own institution"
  on institutions for select
  using (
    exists (
      select 1 from role_assignments
      where user_id = (select auth.uid())
        and role = 'institution_admin'
        and scope_institution_id = institutions.id
    )
  );

create policy "Institution admin updates own institution"
  on institutions for update
  using (
    exists (
      select 1 from role_assignments
      where user_id = (select auth.uid())
        and role = 'institution_admin'
        and scope_institution_id = institutions.id
    )
  )
  with check (
    exists (
      select 1 from role_assignments
      where user_id = (select auth.uid())
        and role = 'institution_admin'
        and scope_institution_id = institutions.id
    )
  );

create policy "MMA admin reads all institutions"
  on institutions for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes institutions"
  on institutions for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- institution_memberships ------------------------------------------------
alter table institution_memberships enable row level security;

create policy "Practitioners read own memberships"
  on institution_memberships for select
  using (practitioner_id = (select auth.uid()));

create policy "Practitioners manage own memberships"
  on institution_memberships for all
  using (practitioner_id = (select auth.uid()))
  with check (practitioner_id = (select auth.uid()));

create policy "Institution admin reads own institution memberships"
  on institution_memberships for select
  using (
    exists (
      select 1 from role_assignments
      where user_id = (select auth.uid())
        and role = 'institution_admin'
        and scope_institution_id = institution_memberships.institution_id
    )
  );

create policy "CPD committee reads all memberships"
  on institution_memberships for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all memberships"
  on institution_memberships for select
  using ((select current_user_has_role('mma_admin')));

-- --- role_assignments -------------------------------------------------------
alter table role_assignments enable row level security;

create policy "Users read own role assignments"
  on role_assignments for select
  using (user_id = (select auth.uid()));

create policy "MMA admin reads all role assignments"
  on role_assignments for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes role assignments"
  on role_assignments for insert
  with check ((select current_user_has_role('mma_admin')));

create policy "MMA admin revokes role assignments"
  on role_assignments for update
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "CPD committee reads all role assignments"
  on role_assignments for select
  using ((select current_user_has_role('cpd_committee')));
