-- ============================================================================
-- P4 — Parts 4a/4b/4c/4e/5a/5b: events, sessions, organizers, accreditations,
-- credit allocations, registrations, attendances + event_credit_for_role()
-- + the FOUR event FKs on cpd_entries deferred by 0008 (see its header).
-- Faithful to vault "Database Schema.md" DDL. RLS follows in …100100.
-- (event_reviews, Part 4d, is deferred to the committee phase P5.)
-- ============================================================================

-- --- New enums (event_status already exists from 0004 core_enums) -----------
create type event_accreditation_status as enum ('active', 'revoked');

create type registration_status as enum ('confirmed', 'waitlisted', 'cancelled');

create type attendance_method as enum (
  'self_check_in',     -- attendee scanned a QR code or clicked an attestation
  'organizer_marked',  -- organizer added the row at the venue or after the fact
  'imported'           -- bulk imported from a paper sheet or external system
);

create type attendance_status as enum (
  'pending',   -- recorded but not yet verified
  'verified',  -- confirmed; this is the row that creates a credit entry
  'rejected'   -- disputed and rejected; no credit issued
);

-- --- events (4a) -------------------------------------------------------------
create table events (
  id                  uuid          primary key default gen_random_uuid(),
  title               text          not null,
  slug                text          not null unique,
  description         text,
  activity_type_id    uuid          not null references activity_types(id) on delete restrict,
  status              event_status  not null default 'draft',
  is_virtual          boolean       not null default false,
  is_hybrid           boolean       not null default false,
  venue_name          text,
  venue_address       text,
  atoll               text,
  island              text,
  online_url          text,
  starts_at           timestamptz   not null,
  ends_at             timestamptz   not null,
  timezone            text          not null default 'Indian/Maldives',
  capacity            int,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  cover_image_url     text,
  contact_email       citext,
  contact_phone       text,
  cycle_id            uuid          references cpd_cycles(id) on delete restrict,
  is_public           boolean       not null default true,
  submitted_at        timestamptz,
  submitted_by        uuid          references profiles(id) on delete set null,

  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  created_by          uuid          references profiles(id) on delete set null,
  updated_by          uuid          references profiles(id) on delete set null,

  check (ends_at > starts_at),
  check (capacity is null or capacity > 0),
  check (registration_opens_at is null
         or registration_closes_at is null
         or registration_closes_at >= registration_opens_at),
  check (registration_closes_at is null or registration_closes_at <= ends_at),
  check (
    (is_virtual = false and is_hybrid = false)
    or (is_virtual = true  and online_url is not null)
    or (is_hybrid  = true  and online_url is not null and venue_name is not null)
  )
);

create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

create index idx_events_status on events(status);
create index idx_events_starts_at on events(starts_at);
create index idx_events_activity_type on events(activity_type_id);
create index idx_events_cycle on events(cycle_id);
create index idx_events_submitted_by on events(submitted_by);
create index idx_events_title_trgm on events using gin (title gin_trgm_ops);

-- --- event_sessions (4b) -----------------------------------------------------
create table event_sessions (
  id              uuid          primary key default gen_random_uuid(),
  event_id        uuid          not null references events(id) on delete cascade,
  title           text          not null,
  description     text,
  sequence        int           not null default 0,
  speaker_name    text,
  speaker_title   text,
  speaker_org     text,
  starts_at       timestamptz   not null,
  ends_at         timestamptz   not null,
  room            text,
  online_url      text,
  capacity        int,
  is_optional     boolean       not null default false,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  created_by      uuid          references profiles(id) on delete set null,
  updated_by      uuid          references profiles(id) on delete set null,

  check (ends_at > starts_at),
  check (capacity is null or capacity > 0),
  check (sequence >= 0),
  unique (event_id, sequence)
);

create trigger trg_event_sessions_updated_at
  before update on event_sessions
  for each row execute function set_updated_at();

create index idx_event_sessions_event on event_sessions(event_id);
create index idx_event_sessions_starts_at on event_sessions(starts_at);
create index idx_event_sessions_title_trgm on event_sessions using gin (title gin_trgm_ops);

-- --- event_organizers (4c) ---------------------------------------------------
create table event_organizers (
  id            uuid          primary key default gen_random_uuid(),
  event_id      uuid          not null references events(id) on delete cascade,
  user_id       uuid          not null references profiles(id) on delete cascade,
  can_edit      boolean       not null default false,
  added_at      timestamptz   not null default now(),
  added_by      uuid          references profiles(id) on delete set null,

  unique (event_id, user_id)
);

create index idx_event_organizers_event on event_organizers(event_id);
create index idx_event_organizers_user  on event_organizers(user_id);

-- --- event_accreditations (4e) ----------------------------------------------
create table event_accreditations (
  id                    uuid                          primary key default gen_random_uuid(),
  event_id              uuid                          not null references events(id) on delete restrict,
  accreditation_number  text                          not null unique,
  status                event_accreditation_status    not null default 'active',
  accredited_at         timestamptz                   not null default now(),
  accredited_by         uuid                          not null references profiles(id) on delete restrict,
  revoked_at            timestamptz,
  revoked_by            uuid                          references profiles(id) on delete restrict,
  revocation_reason     text,
  certificate_template  text,
  notes                 text,

  created_at            timestamptz                   not null default now(),
  updated_at            timestamptz                   not null default now(),
  created_by            uuid                          references profiles(id) on delete set null,
  updated_by            uuid                          references profiles(id) on delete set null,

  check (
    (status = 'active'  and revoked_at is null and revoked_by is null)
    or
    (status = 'revoked' and revoked_at is not null and revoked_by is not null and revocation_reason is not null)
  )
);

create trigger trg_event_accreditations_updated_at
  before update on event_accreditations
  for each row execute function set_updated_at();

create unique index idx_event_accreditations_one_active
  on event_accreditations(event_id)
  where status = 'active';

create index idx_event_accreditations_event on event_accreditations(event_id);
create index idx_event_accreditations_status on event_accreditations(status);
create index idx_event_accreditations_accredited_by on event_accreditations(accredited_by);

-- --- event_credit_allocations (4e) ------------------------------------------
create table event_credit_allocations (
  id                uuid          primary key default gen_random_uuid(),
  accreditation_id  uuid          not null references event_accreditations(id) on delete cascade,
  category_id       uuid          not null references credit_categories(id) on delete restrict,
  role_label        participant_role,
  credits           numeric(8,2)  not null,
  max_per_attendee  numeric(8,2),
  framework_rule_id uuid          references framework_rules(id) on delete set null,
  notes             text,

  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  created_by        uuid          references profiles(id) on delete set null,
  updated_by        uuid          references profiles(id) on delete set null,

  check (credits >= 0),
  check (max_per_attendee is null or max_per_attendee >= 0),

  unique (accreditation_id, category_id, role_label)
);

create trigger trg_event_credit_allocations_updated_at
  before update on event_credit_allocations
  for each row execute function set_updated_at();

create index idx_event_credit_allocations_accreditation
  on event_credit_allocations(accreditation_id);
create index idx_event_credit_allocations_category
  on event_credit_allocations(category_id);
create index idx_event_credit_allocations_rule
  on event_credit_allocations(framework_rule_id);

-- --- event_registrations (5a) -----------------------------------------------
create table event_registrations (
  id              uuid                  primary key default gen_random_uuid(),
  event_id        uuid                  not null references events(id) on delete cascade,
  practitioner_id uuid                  not null references profiles(id) on delete cascade,
  role_label      participant_role      not null default 'attendee',
  status          registration_status   not null default 'confirmed',
  registered_at   timestamptz           not null default now(),
  confirmed_at    timestamptz,
  cancelled_at    timestamptz,
  cancellation_reason text,
  notes           text,

  created_at      timestamptz           not null default now(),
  updated_at      timestamptz           not null default now(),
  created_by      uuid                  references profiles(id) on delete set null,
  updated_by      uuid                  references profiles(id) on delete set null,

  check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create trigger trg_event_registrations_updated_at
  before update on event_registrations
  for each row execute function set_updated_at();

create unique index idx_event_registrations_one_active
  on event_registrations(event_id, practitioner_id, role_label)
  where status <> 'cancelled';

create index idx_event_registrations_event on event_registrations(event_id);
create index idx_event_registrations_practitioner on event_registrations(practitioner_id);
create index idx_event_registrations_status on event_registrations(status);

-- --- event_attendances (5b) -------------------------------------------------
create table event_attendances (
  id                uuid                primary key default gen_random_uuid(),
  event_id          uuid                not null references events(id) on delete cascade,
  practitioner_id   uuid                not null references profiles(id) on delete cascade,
  registration_id   uuid                references event_registrations(id) on delete set null,
  role_label        participant_role    not null default 'attendee',
  status            attendance_status   not null default 'pending',
  method            attendance_method   not null,
  attended_at       timestamptz         not null default now(),
  hours_attended    numeric(5,2),
  sessions_attended int,
  verified_at       timestamptz,
  verified_by       uuid                references profiles(id) on delete set null,
  rejected_at       timestamptz,
  rejected_by       uuid                references profiles(id) on delete set null,
  rejection_reason  text,
  notes             text,

  created_at        timestamptz         not null default now(),
  updated_at        timestamptz         not null default now(),
  created_by        uuid                references profiles(id) on delete set null,
  updated_by        uuid                references profiles(id) on delete set null,

  check (
    status <> 'verified'
    or (verified_at is not null and verified_by is not null)
  ),
  check (
    status <> 'rejected'
    or (rejected_at is not null and rejected_by is not null and rejection_reason is not null)
  ),
  check (
    status = 'verified'
    or (verified_at is null and verified_by is null)
  ),
  check (
    status = 'rejected'
    or (rejected_at is null and rejected_by is null and rejection_reason is null)
  ),
  check (hours_attended is null or hours_attended >= 0),
  check (sessions_attended is null or sessions_attended >= 0)
);

create trigger trg_event_attendances_updated_at
  before update on event_attendances
  for each row execute function set_updated_at();

create unique index idx_event_attendances_one_verified
  on event_attendances(event_id, practitioner_id, role_label)
  where status = 'verified';

create index idx_event_attendances_event on event_attendances(event_id);
create index idx_event_attendances_practitioner on event_attendances(practitioner_id);
create index idx_event_attendances_status on event_attendances(status);
create index idx_event_attendances_registration on event_attendances(registration_id);

-- --- Credit resolution helper (4e) ------------------------------------------
create or replace function event_credit_for_role(
  p_event_id    uuid,
  p_role_label  participant_role
)
returns table (
  category_id       uuid,
  credits           numeric(8,2),
  max_per_attendee  numeric(8,2),
  accreditation_id  uuid
)
language sql
stable
as $$
  with active_accred as (
    select id
    from event_accreditations
    where event_id = p_event_id
      and status   = 'active'
    limit 1
  ),
  matched as (
    select
      ea.category_id,
      ea.credits,
      ea.max_per_attendee,
      ea.accreditation_id,
      case when ea.role_label is not distinct from p_role_label then 0 else 1 end as rank
    from event_credit_allocations ea
    join active_accred on ea.accreditation_id = active_accred.id
    where ea.role_label is not distinct from p_role_label
       or ea.role_label is null
  )
  select category_id, credits, max_per_attendee, accreditation_id
  from matched
  order by rank
  limit 1;
$$;

-- --- The four event FKs deferred by 0008 (cpd_entries header) ---------------
alter table cpd_entries
  add constraint cpd_entries_event_id_fkey
    foreign key (event_id) references events(id) on delete restrict,
  add constraint cpd_entries_attendance_id_fkey
    foreign key (attendance_id) references event_attendances(id) on delete restrict,
  add constraint cpd_entries_accreditation_id_fkey
    foreign key (accreditation_id) references event_accreditations(id) on delete restrict,
  add constraint cpd_entries_allocation_id_fkey
    foreign key (allocation_id) references event_credit_allocations(id) on delete restrict;
