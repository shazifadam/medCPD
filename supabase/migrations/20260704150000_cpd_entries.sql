-- ============================================================================
-- 0008 — Part 5c: cpd_entries (the credit ledger) + RLS
-- Faithful to vault "Database Schema.md" Part 5c with ONE deliberate
-- deviation: the four event-provenance FK CONSTRAINTS (events,
-- event_attendances, event_accreditations, event_credit_allocations) are
-- DEFERRED to the P4 events migration — those tables don't exist yet, and
-- until they do every row is source='self_reported', whose CHECK forces all
-- event columns null. The P4 migration adds:
--   alter table cpd_entries add constraint cpd_entries_event_id_fkey
--     foreign key (event_id) references events(id) on delete restrict;  (etc.)
-- ============================================================================

create table cpd_entries (
  id                    uuid                primary key default gen_random_uuid(),
  practitioner_id       uuid                not null references profiles(id) on delete cascade,
  source                cpd_entry_source    not null,
  status                cpd_entry_status    not null default 'pending',

  cycle_id              uuid                not null references cpd_cycles(id) on delete restrict,
  category_id           uuid                not null references credit_categories(id) on delete restrict,
  activity_type_id      uuid                not null references activity_types(id) on delete restrict,
  credits               numeric(8,2)        not null,

  -- Event-derived provenance (required when source = 'event_attendance');
  -- FK constraints land with the P4 events migration (see header).
  event_id              uuid,
  attendance_id         uuid,
  accreditation_id      uuid,
  allocation_id         uuid,
  role_label            participant_role,

  -- Self-reported fields (required when source = 'self_reported')
  title                 text,
  description           text,
  occurred_on           date,
  hours                 numeric(5,2),
  sessions              int,

  -- Review metadata
  submitted_at          timestamptz         not null default now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid                references profiles(id) on delete restrict,
  review_comments       text,

  -- Audit-friendly calculation inputs (frozen at submission)
  framework_rule_id     uuid                references framework_rules(id) on delete set null,
  calc_inputs           jsonb               not null default '{}'::jsonb,

  created_at            timestamptz         not null default now(),
  updated_at            timestamptz         not null default now(),
  created_by            uuid                references profiles(id) on delete set null,
  updated_by            uuid                references profiles(id) on delete set null,

  check (credits >= 0),
  check (hours is null or hours >= 0),
  check (sessions is null or sessions >= 0),

  -- Event-derived entries must carry the provenance chain
  check (
    source <> 'event_attendance'
    or (event_id is not null
        and attendance_id is not null
        and accreditation_id is not null)
  ),
  -- Self-reported entries must carry title and date; cannot carry event provenance
  check (
    source <> 'self_reported'
    or (title is not null
        and occurred_on is not null
        and event_id is null
        and attendance_id is null
        and accreditation_id is null
        and allocation_id is null)
  ),
  -- Approved or rejected entries must carry review metadata
  check (
    status = 'pending'
    or (reviewed_at is not null and reviewed_by is not null)
  ),
  -- Rejected entries must carry a reason
  check (
    status <> 'rejected'
    or review_comments is not null
  )
);

create trigger trg_cpd_entries_updated_at
  before update on cpd_entries
  for each row execute function set_updated_at();

create unique index idx_cpd_entries_one_per_attendance_category
  on cpd_entries(attendance_id, category_id)
  where attendance_id is not null;

create index idx_cpd_entries_practitioner_cycle
  on cpd_entries(practitioner_id, cycle_id);
create index idx_cpd_entries_status on cpd_entries(status);
create index idx_cpd_entries_cycle_category on cpd_entries(cycle_id, category_id);
create index idx_cpd_entries_event on cpd_entries(event_id);
create index idx_cpd_entries_attendance on cpd_entries(attendance_id);
create index idx_cpd_entries_occurred_on on cpd_entries(occurred_on);
create index idx_cpd_entries_reviewed_by on cpd_entries(reviewed_by);

-- --- RLS --------------------------------------------------------------------
alter table cpd_entries enable row level security;

create policy "Practitioners read own entries"
  on cpd_entries for select
  using (practitioner_id = (select auth.uid()));

create policy "Practitioners submit own self-reported entries"
  on cpd_entries for insert
  with check (
    practitioner_id = (select auth.uid())
    and source      = 'self_reported'
    and status      = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and exists (
      select 1 from activity_types
      where activity_types.id = cpd_entries.activity_type_id
        and activity_types.allows_self_report
        and activity_types.is_active
    )
  );

create policy "Practitioners edit own pending entries"
  on cpd_entries for update
  using (
    practitioner_id = (select auth.uid())
    and source      = 'self_reported'
    and status      = 'pending'
  )
  with check (
    practitioner_id = (select auth.uid())
    and source      = 'self_reported'
    and status      = 'pending'
  );

create policy "Practitioners delete own pending entries"
  on cpd_entries for delete
  using (
    practitioner_id = (select auth.uid())
    and source      = 'self_reported'
    and status      = 'pending'
  );

create policy "CPD committee reads all entries"
  on cpd_entries for select
  using ((select current_user_has_role('cpd_committee')));

create policy "CPD committee reviews entries"
  on cpd_entries for update
  using ((select current_user_has_role('cpd_committee')))
  with check (
    (select current_user_has_role('cpd_committee'))
    and (status = 'pending' or reviewed_by = (select auth.uid()))
  );

create policy "MMA admin reads all entries"
  on cpd_entries for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes entries"
  on cpd_entries for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
