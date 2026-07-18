-- ============================================================================
-- 0007b — Remaining Part 1 central enums.
-- 0001 created user_role + institution_type only; these four were deferred
-- and cpd_entries (0008) needs the entry pair. event_status / certificate_
-- status / audit_action land here too so Part 1 is complete in one place.
-- ============================================================================

create type event_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'cancelled',
  'completed'
);

create type cpd_entry_source as enum (
  'event_attendance',   -- auto-created from attendance at an accredited event
  'self_reported'       -- practitioner-entered
);

create type cpd_entry_status as enum (
  'pending',     -- awaiting review (if audit policy requires it)
  'approved',
  'rejected'
);

create type certificate_status as enum (
  'active',
  'revoked'
);

create type audit_action as enum (
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'revoke',
  'login',
  'export'
);
