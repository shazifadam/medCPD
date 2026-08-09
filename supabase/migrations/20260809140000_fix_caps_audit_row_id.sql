-- Fix (latent P6 bug): audit_row_changes() derived row_id only from the
-- row's 'id' key; cpd_cycle_category_caps has a composite PK (no id), so
-- every write there violated audit_log_check. Fall back to cycle_id for
-- composite-key framework tables.
CREATE OR REPLACE FUNCTION public.audit_row_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_row_id := coalesce((v_new->>'id')::uuid, (v_new->>'cycle_id')::uuid);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_old    := to_jsonb(old);
    v_new    := to_jsonb(new);
    v_row_id := coalesce((v_new->>'id')::uuid, (v_new->>'cycle_id')::uuid);
    select jsonb_object_agg(key, value)
      into v_diff
      from jsonb_each(v_new)
     where v_old->key is distinct from value;
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_old    := to_jsonb(old);
    v_row_id := coalesce((v_old->>'id')::uuid, (v_old->>'cycle_id')::uuid);
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
$function$
;
