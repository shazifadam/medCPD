-- Part 5d — Evidence attachments
-- Metadata rows for files stored in Supabase Storage (bucket `cpd-evidence`).
-- The DB never holds file bytes; Storage RLS must agree with these policies —
-- the application keeps the two layers aligned.

create table cpd_entry_attachments (
  id              uuid        primary key default gen_random_uuid(),
  entry_id        uuid        not null references cpd_entries(id) on delete cascade,
  storage_bucket  text        not null default 'cpd-evidence',
  storage_path    text        not null,
  filename        text        not null,
  mime_type       text        not null,
  size_bytes      bigint      not null,
  checksum_sha256 text,
  description     text,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     uuid        not null references profiles(id) on delete restrict,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (size_bytes > 0),
  check (size_bytes <= 50 * 1024 * 1024),  -- 50 MB hard ceiling at the DB
  check (checksum_sha256 is null or length(checksum_sha256) = 64),

  -- Storage paths must be unique within their bucket
  unique (storage_bucket, storage_path)
);

create trigger trg_cpd_entry_attachments_updated_at
  before update on cpd_entry_attachments
  for each row execute function set_updated_at();

create index idx_cpd_entry_attachments_entry on cpd_entry_attachments(entry_id);
create index idx_cpd_entry_attachments_uploaded_by on cpd_entry_attachments(uploaded_by);
create index idx_cpd_entry_attachments_mime on cpd_entry_attachments(mime_type);

-- --- RLS ---------------------------------------------------------------------
-- Attachment visibility follows the parent entry. Attachments are immutable
-- after upload for practitioners (delete + re-upload; no UPDATE policy).

alter table cpd_entry_attachments enable row level security;

-- Practitioners read attachments on their own entries
create policy "Practitioners read own attachments"
  on cpd_entry_attachments for select
  using (
    exists (
      select 1 from cpd_entries
      where cpd_entries.id = cpd_entry_attachments.entry_id
        and cpd_entries.practitioner_id = (select auth.uid())
    )
  );

-- Practitioners upload to their own pending self-reported entries
create policy "Practitioners upload to own pending entries"
  on cpd_entry_attachments for insert
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from cpd_entries
      where cpd_entries.id = cpd_entry_attachments.entry_id
        and cpd_entries.practitioner_id = (select auth.uid())
        and cpd_entries.status          = 'pending'
        and cpd_entries.source          = 'self_reported'
    )
  );

-- Practitioners delete their own uploads on still-pending entries
create policy "Practitioners delete own pending uploads"
  on cpd_entry_attachments for delete
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from cpd_entries
      where cpd_entries.id = cpd_entry_attachments.entry_id
        and cpd_entries.practitioner_id = (select auth.uid())
        and cpd_entries.status          = 'pending'
    )
  );

-- Practitioners can also upload audit-requested evidence to already-approved entries
create policy "Practitioners upload audit evidence"
  on cpd_entry_attachments for insert
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from cpd_entries
      join activity_types on activity_types.id = cpd_entries.activity_type_id
      where cpd_entries.id = cpd_entry_attachments.entry_id
        and cpd_entries.practitioner_id    = (select auth.uid())
        and activity_types.evidence_requirement = 'on_audit'
    )
  );

create policy "CPD committee reads all attachments"
  on cpd_entry_attachments for select
  using ((select current_user_has_role('cpd_committee')));

create policy "CPD committee uploads attachments"
  on cpd_entry_attachments for insert
  with check (
    (select current_user_has_role('cpd_committee'))
    and uploaded_by = (select auth.uid())
  );

create policy "MMA admin reads all attachments"
  on cpd_entry_attachments for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes attachments"
  on cpd_entry_attachments for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
