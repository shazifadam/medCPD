-- ============================================================================
-- Fix 1: registration attempts
-- Every registration submission (web sign-up, reapply by the applicant,
-- reopen by MMA) is logged as one row under the SAME profile, so a
-- rejected practitioner never creates a duplicate profile. Attempt 1 comes
-- from handle_new_user(); later attempts are written server-side
-- (postgres-js owner role) by lib/registration.ts.
-- No audit trigger here: trg_audit_profiles already captures the
-- registration_state flips, and the audit_log table-name CHECK is unchanged.
-- ============================================================================

create table registration_attempts (
  id                     uuid        primary key default gen_random_uuid(),
  profile_id             uuid        not null references profiles(id) on delete cascade,
  attempt_no             int         not null,
  submitted_at           timestamptz not null default now(),
  submitted_via          text        not null default 'signup'
    check (submitted_via in ('signup', 'reapply', 'admin_reopen')),
  full_name              text        not null,
  email                  citext      not null,
  phone                  text,
  mmdc_registration      text,
  mmdc_registration_type text
    check (mmdc_registration_type in ('PMR', 'TMR')),
  outcome                text        not null default 'pending'
    check (outcome in ('pending', 'verified', 'rejected')),
  decided_at             timestamptz,
  decided_by             uuid        references profiles(id) on delete set null,
  rejection_reason       text,
  created_at             timestamptz not null default now(),
  unique (profile_id, attempt_no)
);

create index registration_attempts_profile_idx
  on registration_attempts(profile_id);

-- --- RLS ---------------------------------------------------------------------
alter table registration_attempts enable row level security;

create policy "Users read own attempts" on registration_attempts
  for select using (profile_id = (select auth.uid()));

create policy "MMA admin reads all attempts" on registration_attempts
  for select using ((select current_user_has_role('mma_admin')));

create policy "CPD committee reads all attempts" on registration_attempts
  for select using ((select current_user_has_role('cpd_committee')));

-- inserts/updates/deletes are server-side only (postgres-js owner role)
-- no client write policies

-- --- Backfill: attempt 1 for every existing profile --------------------------
insert into registration_attempts (
  profile_id, attempt_no, submitted_at, submitted_via,
  full_name, email, phone, mmdc_registration, mmdc_registration_type,
  outcome, decided_at, decided_by, rejection_reason
)
select
  p.id, 1, p.created_at, 'signup',
  p.full_name, p.email, p.phone, p.mmdc_registration, p.mmdc_registration_type,
  p.registration_state,
  case p.registration_state
    when 'verified' then p.verified_at
    when 'rejected' then p.updated_at
    else null
  end,
  p.verified_by,
  p.rejection_reason
from profiles p
on conflict (profile_id, attempt_no) do nothing;

-- --- Signup: profile + attempt 1 from auth.users -----------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (
    id, full_name, email, phone,
    mmdc_registration, mmdc_registration_type
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'mmdc_registration',
    new.raw_user_meta_data->>'mmdc_registration_type'
  );

  insert into registration_attempts (
    profile_id, attempt_no, submitted_via,
    full_name, email, phone, mmdc_registration, mmdc_registration_type
  )
  values (
    new.id,
    1,
    'signup',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'mmdc_registration',
    new.raw_user_meta_data->>'mmdc_registration_type'
  );
  return new;
end;
$$;
