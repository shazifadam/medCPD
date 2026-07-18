-- ============================================================================
-- 0004 — Framework Part 3a: cycles, credit categories, sub-tiers, caps
-- Faithful to vault "Database Schema.md" Part 3a + Part 8 seeds.
-- Activity types + framework_rules (Part 3b rate book) land with P3.
-- ============================================================================

create extension if not exists btree_gist;  -- daterange exclusion constraint

-- --- cpd_cycles -------------------------------------------------------------
create table cpd_cycles (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  starts_on       date        not null,
  ends_on         date        not null,
  is_current      boolean     not null default false,
  total_credits_required numeric(8,2) not null,
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid        references profiles(id) on delete set null,
  updated_by      uuid        references profiles(id) on delete set null,

  check (ends_on > starts_on),
  check (total_credits_required >= 0)
);

create trigger trg_cpd_cycles_updated_at
  before update on cpd_cycles
  for each row execute function set_updated_at();

create unique index idx_cpd_cycles_one_current
  on cpd_cycles(is_current)
  where is_current;

create index idx_cpd_cycles_range on cpd_cycles using gist (
  daterange(starts_on, ends_on, '[]')
);

alter table cpd_cycles add constraint cpd_cycles_no_overlap
  exclude using gist (
    daterange(starts_on, ends_on, '[]') with &&
  );

-- --- credit_categories + per-cycle caps -------------------------------------
create table credit_categories (
  id            uuid        primary key default gen_random_uuid(),
  code          text        not null unique,
  name          text        not null,
  description   text,
  display_order int         not null default 0,
  is_active     boolean     not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_credit_categories_updated_at
  before update on credit_categories
  for each row execute function set_updated_at();

create table cpd_cycle_category_caps (
  cycle_id      uuid        not null references cpd_cycles(id) on delete cascade,
  category_id   uuid        not null references credit_categories(id) on delete restrict,
  min_credits   numeric(8,2),
  max_credits   numeric(8,2),

  primary key (cycle_id, category_id),

  check (min_credits is null or min_credits >= 0),
  check (max_credits is null or max_credits >= 0),
  check (min_credits is null or max_credits is null or max_credits >= min_credits)
);

create index idx_cpd_cycle_category_caps_category
  on cpd_cycle_category_caps(category_id);

-- --- credit_subcategories (matrix sub-tiers) + pooled caps ------------------
create type pre_registration_rule as enum (
  'required',
  'not_required',
  'conditional'
);

create table credit_subcategories (
  id            uuid        primary key default gen_random_uuid(),
  category_id   uuid        not null references credit_categories(id) on delete restrict,
  code          text        not null unique,            -- '1A', '2A1', '3E1', '4B' …
  name          text        not null,
  description   text,
  pre_registration   pre_registration_rule not null default 'not_required',
  pillar        int,                                    -- CAT3 reporting tier: 1 or 2
  display_order int         not null default 0,
  is_active     boolean     not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_credit_subcategories_category
  on credit_subcategories(category_id);

create trigger trg_credit_subcategories_updated_at
  before update on credit_subcategories
  for each row execute function set_updated_at();

create table cpd_cycle_subcategory_caps (
  cycle_id        uuid        not null references cpd_cycles(id) on delete cascade,
  subcategory_id  uuid        not null references credit_subcategories(id) on delete restrict,
  max_per_cycle   numeric(8,2) not null,

  primary key (cycle_id, subcategory_id),
  check (max_per_cycle >= 0)
);

create index idx_cpd_cycle_subcategory_caps_subcategory
  on cpd_cycle_subcategory_caps(subcategory_id);
