-- ============================================================================
-- 0001 — Identity foundation
-- Faithful to vault "Database Schema.md" Parts 1, 2a, 2b, 2c.
-- Tables: profiles, specialties, practitioner_specialties, institutions,
--         institution_memberships, role_assignments.
-- Institution *features* are deferred for v1, but the schema foundation is
-- created complete so role_assignments' FK + constraints are exactly as
-- documented (no partial-migration debt later).
-- ============================================================================

-- --- Extensions -------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email
create extension if not exists pg_trgm;    -- trigram search on names

-- --- Enums ------------------------------------------------------------------
create type user_role as enum (
  'practitioner',
  'organizer',
  'institution_admin',
  'cpd_committee',
  'mma_admin'
);

create type institution_type as enum (
  'hospital',
  'clinic',
  'polyclinic',
  'health_centre',
  'ministry',
  'other'
);

-- --- Helper: set_updated_at() ----------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles (Part 2a)
-- ============================================================================
create table profiles (
  id                 uuid        primary key references auth.users(id) on delete cascade,
  full_name          text        not null,
  email              citext      not null unique,
  phone              text,
  mmdc_registration  text        unique,
  mmdc_registration_type text
    check (mmdc_registration_type in ('PMR', 'TMR')),
  registration_state text        not null default 'pending'
    check (registration_state in ('pending', 'verified', 'rejected')),
  verified_at        timestamptz,
  verified_by        uuid        references profiles(id) on delete set null,
  rejection_reason   text,
  avatar_url         text,
  locale             text        not null default 'en',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  check (mmdc_registration is null or mmdc_registration_type is not null),
  check (registration_state = 'rejected' or rejection_reason is null)
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- specialties + practitioner_specialties (Part 2a)
-- ============================================================================
create table specialties (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null,
  parent_id   uuid        references specialties(id) on delete restrict,
  is_active   boolean     not null default true,
  display_order int       not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_specialties_updated_at
  before update on specialties
  for each row execute function set_updated_at();

create index idx_specialties_parent_id on specialties(parent_id);

create table practitioner_specialties (
  practitioner_id uuid not null references profiles(id) on delete cascade,
  specialty_id    uuid not null references specialties(id) on delete restrict,
  is_primary      boolean not null default false,
  added_at        timestamptz not null default now(),

  primary key (practitioner_id, specialty_id)
);

create index idx_practitioner_specialties_specialty_id
  on practitioner_specialties(specialty_id);

create unique index idx_practitioner_specialties_one_primary
  on practitioner_specialties(practitioner_id)
  where is_primary;

-- ============================================================================
-- institutions + institution_memberships (Part 2b)
-- ============================================================================
create table institutions (
  id              uuid              primary key default gen_random_uuid(),
  name            text              not null,
  type            institution_type  not null,
  registration_no text              unique,
  atoll           text,
  island          text,
  address         text,
  contact_email   citext,
  contact_phone   text,
  website_url     text,
  is_verified     boolean           not null default false,
  verified_at     timestamptz,
  verified_by     uuid              references profiles(id) on delete set null,
  is_active       boolean           not null default true,

  created_at      timestamptz       not null default now(),
  updated_at      timestamptz       not null default now(),
  created_by      uuid              references profiles(id) on delete set null,
  updated_by      uuid              references profiles(id) on delete set null
);

create trigger trg_institutions_updated_at
  before update on institutions
  for each row execute function set_updated_at();

create index idx_institutions_atoll_island on institutions(atoll, island);
create index idx_institutions_name_trgm on institutions using gin (name gin_trgm_ops);

create table institution_memberships (
  id              uuid        primary key default gen_random_uuid(),
  practitioner_id uuid        not null references profiles(id) on delete cascade,
  institution_id  uuid        not null references institutions(id) on delete restrict,
  job_title       text,
  started_at      date        not null default current_date,
  ended_at        date,
  is_active       boolean     generated always as (ended_at is null) stored,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid        references profiles(id) on delete set null,
  updated_by      uuid        references profiles(id) on delete set null,

  check (ended_at is null or ended_at >= started_at)
);

create trigger trg_institution_memberships_updated_at
  before update on institution_memberships
  for each row execute function set_updated_at();

create index idx_institution_memberships_practitioner_id
  on institution_memberships(practitioner_id);
create index idx_institution_memberships_institution_id
  on institution_memberships(institution_id);
create index idx_institution_memberships_active
  on institution_memberships(institution_id)
  where ended_at is null;

create unique index idx_institution_memberships_one_active_per_pair
  on institution_memberships(practitioner_id, institution_id)
  where ended_at is null;

-- ============================================================================
-- role_assignments (Part 2c) — anchors every authz decision
-- ============================================================================
create table role_assignments (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references profiles(id) on delete cascade,
  role                  user_role   not null,
  scope_institution_id  uuid        references institutions(id) on delete cascade,

  granted_at            timestamptz not null default now(),
  granted_by            uuid        references profiles(id) on delete set null,
  revoked_at            timestamptz,
  revoked_by            uuid        references profiles(id) on delete set null,
  revoke_reason         text,

  constraint role_scope_consistency check (
    (role = 'institution_admin' and scope_institution_id is not null)
    or
    (role <> 'institution_admin' and scope_institution_id is null)
  ),

  constraint revocation_consistency check (
    (revoked_at is null and revoked_by is null)
    or
    (revoked_at is not null)
  )
);

create unique index idx_role_assignments_one_active
  on role_assignments(user_id, role, coalesce(scope_institution_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create index idx_role_assignments_user_id on role_assignments(user_id);
create index idx_role_assignments_role on role_assignments(role) where revoked_at is null;
create index idx_role_assignments_scope on role_assignments(scope_institution_id) where revoked_at is null;

-- --- Helper: current_user_has_role() (finalized, revoked-aware, scoped) -----
create or replace function current_user_has_role(
  check_role           user_role,
  check_institution_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from role_assignments
    where user_id = (select auth.uid())
      and role = check_role
      and revoked_at is null
      and (
        check_institution_id is null
        or scope_institution_id = check_institution_id
      )
  );
$$;

-- --- Signup: auto-create profile from auth.users ---------------------------
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
