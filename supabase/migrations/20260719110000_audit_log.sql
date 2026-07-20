-- ============================================================================
-- P6 — Part 6: audit_log + generic audit trigger + attachments + RLS.
-- Faithful to vault "Database Schema.md" Part 6 (audit_action enum came in
-- 0004). Deviation: the two cycle-completion snapshot triggers are deferred
-- with their tables (close-cycle routine, future phase).
-- ============================================================================

create table audit_log (
  id            uuid          primary key default gen_random_uuid(),
  occurred_at   timestamptz   not null default now(),
  actor_id      uuid          references profiles(id) on delete restrict,
  actor_role    user_role,
  action        audit_action  not null,
  table_name    text,
  row_id        uuid,
  old_values    jsonb,
  new_values    jsonb,
  diff          jsonb,
  context       jsonb         not null default '{}'::jsonb,

  created_at    timestamptz   not null default now(),

  check (
    action not in ('create', 'update', 'delete', 'approve', 'reject', 'revoke')
    or (table_name is not null and row_id is not null)
  ),
  check (
    action not in ('login', 'export')
    or (table_name is null and row_id is null)
  ),
  check (
    case action
      when 'create' then new_values is not null and old_values is null
      when 'delete' then old_values is not null and new_values is null
      when 'update' then old_values is not null and new_values is not null
      else true
    end
  )
);

create index idx_audit_log_occurred_at on audit_log(occurred_at desc);
create index idx_audit_log_actor on audit_log(actor_id, occurred_at desc);
create index idx_audit_log_row on audit_log(table_name, row_id);
create index idx_audit_log_action on audit_log(action);

-- --- Generic audit trigger ---------------------------------------------------
create or replace function audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action     audit_action;
  v_row_id     uuid;
  v_old        jsonb;
  v_new        jsonb;
  v_diff       jsonb;
  v_actor      uuid := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  v_actor_role user_role;
  v_context    jsonb := coalesce(
                          nullif(current_setting('app.audit_context', true), '')::jsonb,
                          '{}'::jsonb
                        );
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_new    := to_jsonb(new);
    v_row_id := (v_new->>'id')::uuid;
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_old    := to_jsonb(old);
    v_new    := to_jsonb(new);
    v_row_id := (v_new->>'id')::uuid;
    select jsonb_object_agg(key, value)
      into v_diff
      from jsonb_each(v_new)
     where v_old->key is distinct from value;
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_old    := to_jsonb(old);
    v_row_id := (v_old->>'id')::uuid;
  end if;

  if v_actor is not null then
    select role into v_actor_role
      from role_assignments
     where user_id = v_actor
       and revoked_at is null
     order by case role
                when 'mma_admin' then 1
                when 'cpd_committee' then 2
                when 'institution_admin' then 3
                when 'organizer' then 4
                when 'practitioner' then 5
              end
     limit 1;
  end if;

  insert into audit_log (
    actor_id, actor_role, action, table_name, row_id,
    old_values, new_values, diff, context
  )
  values (
    v_actor, v_actor_role, v_action, TG_TABLE_NAME, v_row_id,
    v_old, v_new, v_diff, v_context
  );

  return coalesce(new, old);
end;
$$;

-- --- Trigger attachment ------------------------------------------------------
-- Fully audited (compliance-critical rows)
create trigger trg_audit_cpd_entries
  after insert or update or delete on cpd_entries
  for each row execute function audit_row_changes();
create trigger trg_audit_event_accreditations
  after insert or update or delete on event_accreditations
  for each row execute function audit_row_changes();
create trigger trg_audit_event_credit_allocations
  after insert or update or delete on event_credit_allocations
  for each row execute function audit_row_changes();
create trigger trg_audit_event_attendances
  after insert or update or delete on event_attendances
  for each row execute function audit_row_changes();
create trigger trg_audit_role_assignments
  after insert or update or delete on role_assignments
  for each row execute function audit_row_changes();
create trigger trg_audit_events
  after insert or update or delete on events
  for each row execute function audit_row_changes();
create trigger trg_audit_event_reviews
  after insert or update or delete on event_reviews
  for each row execute function audit_row_changes();
create trigger trg_audit_event_organizers
  after insert or update or delete on event_organizers
  for each row execute function audit_row_changes();
create trigger trg_audit_profiles
  after update or delete on profiles
  for each row execute function audit_row_changes();

-- Configuration-audited (framework changes)
create trigger trg_audit_cpd_cycles
  after insert or update or delete on cpd_cycles
  for each row execute function audit_row_changes();
create trigger trg_audit_credit_categories
  after insert or update or delete on credit_categories
  for each row execute function audit_row_changes();
create trigger trg_audit_cpd_cycle_category_caps
  after insert or update or delete on cpd_cycle_category_caps
  for each row execute function audit_row_changes();
create trigger trg_audit_activity_types
  after insert or update or delete on activity_types
  for each row execute function audit_row_changes();
create trigger trg_audit_framework_rules
  after insert or update or delete on framework_rules
  for each row execute function audit_row_changes();

-- --- RLS ---------------------------------------------------------------------
alter table audit_log enable row level security;

create policy "CPD committee reads audit log"
  on audit_log for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads audit log"
  on audit_log for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin enforces retention"
  on audit_log for delete
  using ((select current_user_has_role('mma_admin')));
