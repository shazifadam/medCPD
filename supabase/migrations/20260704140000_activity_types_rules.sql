-- ============================================================================
-- 0006 — Framework Part 3b: activity types + framework rules (rate book)
-- Faithful to vault "Database Schema.md" Part 3b DDL + RLS.
-- Seeds follow in 0007 (kept separate for reviewability).
-- ============================================================================

create type credit_calculation_method as enum (
  'flat',         -- fixed credits per occurrence regardless of duration
  'per_hour',     -- credits = hours × rate
  'per_session',  -- credits = sessions attended × rate
  'banded',       -- credits = stepped lookup from duration
  'manual'        -- credits set per-entry by reviewer
);

create type evidence_requirement as enum (
  'never',
  'on_audit',
  'always'
);

create table activity_types (
  id                  uuid        primary key default gen_random_uuid(),
  code                text        not null unique,
  name                text        not null,
  description         text,
  default_category_id uuid        references credit_categories(id) on delete restrict,
  subcategory_id      uuid        references credit_subcategories(id) on delete restrict,
  calculation_method  credit_calculation_method not null,
  evidence_requirement evidence_requirement not null default 'on_audit',
  allows_self_report  boolean     not null default true,
  requires_event      boolean     not null default false,
  is_active           boolean     not null default true,
  display_order       int         not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid        references profiles(id) on delete set null,
  updated_by          uuid        references profiles(id) on delete set null,

  -- An event-only type cannot be self-reported
  check (not (requires_event and allows_self_report))
);

create trigger trg_activity_types_updated_at
  before update on activity_types
  for each row execute function set_updated_at();

create index idx_activity_types_default_category
  on activity_types(default_category_id);

-- Controlled vocabulary for the role a practitioner plays at an event.
create type participant_role as enum (
  'attendee',
  'speaker',
  'panelist',
  'organizer'
);

create type cap_period as enum (
  'per_cycle',
  'per_year'
);

create table framework_rules (
  id                  uuid        primary key default gen_random_uuid(),
  cycle_id            uuid        not null references cpd_cycles(id) on delete cascade,
  activity_type_id    uuid        not null references activity_types(id) on delete restrict,
  category_id         uuid        not null references credit_categories(id) on delete restrict,
  role_label          participant_role,
  rate                numeric(8,2) not null,
  max_per_entry       numeric(8,2),
  max_per_cycle       numeric(8,2),
  cap_period          cap_period  not null default 'per_cycle',
  band_lookup         jsonb,       -- for 'banded': [{max_hours, points}…] ascending
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid        references profiles(id) on delete set null,
  updated_by          uuid        references profiles(id) on delete set null,

  check (rate >= 0),
  check (max_per_entry is null or max_per_entry >= 0),
  check (max_per_cycle is null or max_per_cycle >= 0),

  unique (cycle_id, activity_type_id, category_id, role_label)
);

create trigger trg_framework_rules_updated_at
  before update on framework_rules
  for each row execute function set_updated_at();

create index idx_framework_rules_cycle on framework_rules(cycle_id);
create index idx_framework_rules_activity_type on framework_rules(activity_type_id);
create index idx_framework_rules_category on framework_rules(category_id);

-- --- RLS --------------------------------------------------------------------
alter table activity_types enable row level security;
alter table framework_rules enable row level security;

create policy "Anyone reads active activity types"
  on activity_types for select
  using (is_active or (select current_user_has_role('mma_admin')));

create policy "Anyone reads framework rules"
  on framework_rules for select using (true);

create policy "CPD committee writes activity types"
  on activity_types for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes activity types"
  on activity_types for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "CPD committee writes framework rules"
  on framework_rules for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes framework rules"
  on framework_rules for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
