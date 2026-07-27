-- ============================================================================
-- 0015 — Part 7a: certificates (event attendance + cycle completion),
-- public verification RPC, RLS. certificate_status landed in 0007b;
-- certificate_kind is new here.
-- Certificate numbers are application-generated: GRD-EV-<yyyy>-<seq> for
-- event certs, GRD-CY-<yyyy>-<seq> for cycle certs (per the CT/CA designs;
-- the schema doc leaves the format to the application).
-- ============================================================================

create type certificate_kind as enum (
  'event_attendance',   -- single event participation certificate
  'cycle_completion'    -- end-of-cycle credit-total certificate
);

create table certificates (
  id                   uuid                primary key default gen_random_uuid(),
  certificate_number   text                not null unique,
  kind                 certificate_kind    not null,
  status               certificate_status  not null default 'active',
  practitioner_id      uuid                not null references profiles(id) on delete restrict,

  -- Source links; constrained by CHECK below to match `kind`
  event_id             uuid                references events(id) on delete restrict,
  attendance_id        uuid                references event_attendances(id) on delete restrict,
  cycle_id             uuid                references cpd_cycles(id) on delete restrict,
  accreditation_id     uuid                references event_accreditations(id) on delete restrict,

  -- Lifecycle
  issued_at            timestamptz         not null default now(),
  issued_by            uuid                references profiles(id) on delete restrict,
  revoked_at           timestamptz,
  revoked_by           uuid                references profiles(id) on delete restrict,
  revocation_reason    text,

  -- Frozen snapshot of the data the certificate attests to
  payload              jsonb               not null,

  -- Rendered PDF in Supabase Storage
  storage_bucket       text,
  storage_path         text,

  created_at           timestamptz         not null default now(),
  updated_at           timestamptz         not null default now(),
  created_by           uuid                references profiles(id) on delete set null,
  updated_by           uuid                references profiles(id) on delete set null,

  -- Event-attendance certificates carry the event chain; cycle certs carry the cycle
  check (
    (kind = 'event_attendance'
       and event_id is not null
       and attendance_id is not null
       and accreditation_id is not null
       and cycle_id is null)
    or
    (kind = 'cycle_completion'
       and cycle_id is not null
       and event_id is null
       and attendance_id is null
       and accreditation_id is null)
  ),
  -- Status/revocation symmetry — same pattern as event_accreditations
  check (
    (status = 'active'  and revoked_at is null and revoked_by is null)
    or
    (status = 'revoked'
      and revoked_at is not null
      and revoked_by is not null
      and revocation_reason is not null)
  ),
  -- Storage path/bucket are paired
  check (
    (storage_bucket is null and storage_path is null)
    or
    (storage_bucket is not null and storage_path is not null)
  )
);

create trigger trg_certificates_updated_at
  before update on certificates
  for each row execute function set_updated_at();

-- At most one active event-attendance certificate per (practitioner, event)
create unique index idx_certificates_one_active_per_event
  on certificates(practitioner_id, event_id)
  where status = 'active' and kind = 'event_attendance';

-- At most one active cycle-completion certificate per (practitioner, cycle)
create unique index idx_certificates_one_active_per_cycle
  on certificates(practitioner_id, cycle_id)
  where status = 'active' and kind = 'cycle_completion';

create index idx_certificates_practitioner on certificates(practitioner_id);
create index idx_certificates_event on certificates(event_id);
create index idx_certificates_cycle on certificates(cycle_id);
create index idx_certificates_status on certificates(status);
create index idx_certificates_kind on certificates(kind);

-- ----------------------------------------------------------------------------
-- Public verification — the ONLY public read path (RLS has no anon policy)
-- ----------------------------------------------------------------------------

create or replace function verify_certificate(p_certificate_number text)
returns table (
  certificate_number  text,
  kind                certificate_kind,
  status              certificate_status,
  practitioner_name   text,
  mmdc_number         text,
  issued_at           timestamptz,
  event_title         text,
  event_dates         daterange,
  cycle_name          text,
  total_credits       numeric(8,2),
  revoked_at          timestamptz,
  revocation_reason   text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.certificate_number,
    c.kind,
    c.status,
    c.payload #>> '{practitioner,display_name}'                          as practitioner_name,
    c.payload #>> '{practitioner,mmdc_number}'                           as mmdc_number,
    c.issued_at,
    c.payload #>> '{event,title}'                                        as event_title,
    case
      when c.kind = 'event_attendance' then daterange(
        (c.payload #>> '{event,starts_on}')::date,
        (c.payload #>> '{event,ends_on}')::date,
        '[]'
      )
      else null
    end                                                                  as event_dates,
    c.payload #>> '{cycle,name}'                                         as cycle_name,
    case
      when c.kind = 'cycle_completion'
        then (c.payload #>> '{totals,earned}')::numeric(8,2)
      else null
    end                                                                  as total_credits,
    c.revoked_at,
    case
      when c.status = 'revoked' then c.revocation_reason
      else null
    end                                                                  as revocation_reason
  from certificates c
  where c.certificate_number = p_certificate_number;
$$;

revoke all on function verify_certificate(text) from public;
grant execute on function verify_certificate(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table certificates enable row level security;

-- Practitioners read their own certificates
create policy "Practitioners read own certificates"
  on certificates for select
  using (practitioner_id = (select auth.uid()));

-- CPD committee reads all certificates
create policy "CPD committee reads certificates"
  on certificates for select
  using ((select current_user_has_role('cpd_committee')));

-- CPD committee revokes certificates (UPDATE active → revoked)
create policy "CPD committee revokes certificates"
  on certificates for update
  using (
    (select current_user_has_role('cpd_committee'))
    and status = 'active'
  )
  with check (
    (select current_user_has_role('cpd_committee'))
    and status = 'revoked'
    and revoked_by = (select auth.uid())
  );

-- MMA admin reads and writes everything
create policy "MMA admin reads certificates"
  on certificates for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes certificates"
  on certificates for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
