-- CPD Update 1 — foundation (approved 2026-08-09)
-- 1) calendar-year cycle + rate-book lifecycle
-- 2) events → organizing institution FK
-- 3) notifications
-- 4) per-practitioner eligibility overrides
-- 5) profile workplaces + avatar

-- --- 1) cycles ---------------------------------------------------------------
alter table cpd_cycles
  add column rate_book_status text not null default 'approved'
    check (rate_book_status in ('draft','approved')),
  add column rate_book_approved_by uuid references profiles(id) on delete set null,
  add column rate_book_approved_at timestamptz;

-- current cycle becomes the 2026 calendar year (entries table is empty post-wipe)
update cpd_cycles
set name = '2026 cycle', starts_on = '2026-01-01', ends_on = '2026-12-31'
where is_current;

-- --- 2) events ↔ organizations ----------------------------------------------
-- restrict: an institution with events cannot be deleted out from under them
alter table events
  add column organizer_institution_id uuid references institutions(id) on delete restrict;
create index idx_events_organizer_institution on events(organizer_institution_id);

-- --- 3) notifications --------------------------------------------------------
create table notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  kind       text        not null,
  title      text        not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, read_at, created_at desc);

alter table notifications enable row level security;
create policy notifications_select_own on notifications
  for select using ((select auth.uid()) = user_id);
create policy notifications_update_own on notifications
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- inserts are server-side only (postgres-js owner role) — no client insert policy

-- --- 4) per-practitioner eligibility overrides -------------------------------
create table practitioner_cycle_overrides (
  id              uuid         primary key default gen_random_uuid(),
  practitioner_id uuid         not null references profiles(id) on delete cascade,
  cycle_id        uuid         not null references cpd_cycles(id) on delete cascade,
  field           text         not null check (field in ('category_floor','cycle_total')),
  category_id     uuid         references credit_categories(id) on delete cascade,
  old_value       numeric(8,2),
  new_value       numeric(8,2) not null,
  reason          text         not null,
  evidence_path   text         not null,
  adjusted_by     uuid         references profiles(id) on delete set null,
  created_at      timestamptz  not null default now(),

  -- category_floor rows carry a category; cycle_total rows must not
  check ((field = 'category_floor') = (category_id is not null))
);
create index idx_pco_practitioner_cycle
  on practitioner_cycle_overrides(practitioner_id, cycle_id, field, created_at desc);

alter table practitioner_cycle_overrides enable row level security;
create policy pco_select_own on practitioner_cycle_overrides
  for select using (
    (select auth.uid()) = practitioner_id
    or current_user_has_role('mma_admin')
    or current_user_has_role('cpd_committee')
  );
-- writes are server-side only (postgres-js owner role)

-- --- 5) profile workplaces + avatar ------------------------------------------
alter table profiles
  add column primary_institution_id uuid references institutions(id) on delete set null,
  add column avatar_path text;

create table practitioner_workplaces (
  practitioner_id uuid        not null references profiles(id) on delete cascade,
  institution_id  uuid        not null references institutions(id) on delete restrict,
  added_at        timestamptz not null default now(),
  primary key (practitioner_id, institution_id)
);

alter table practitioner_workplaces enable row level security;
create policy pw_select_all on practitioner_workplaces
  for select using (true);
create policy pw_insert_own on practitioner_workplaces
  for insert with check ((select auth.uid()) = practitioner_id);
create policy pw_delete_own on practitioner_workplaces
  for delete using ((select auth.uid()) = practitioner_id);
