-- ============================================================================
-- P4 — RLS for events, sessions, organizers, accreditations, allocations,
-- registrations, attendances. Faithful to the vault doc policy blocks;
-- trailing committee/admin policies for sessions/organizers/allocations
-- pattern-complete the doc's stated conventions.
-- ============================================================================

-- --- events (4a) -------------------------------------------------------------
alter table events enable row level security;

create policy "Anyone reads approved public events"
  on events for select
  using (status in ('approved', 'completed') and is_public);

create policy "Organizers read own events"
  on events for select
  using (
    submitted_by = (select auth.uid())
    or created_by = (select auth.uid())
    or exists (
      select 1 from event_organizers
      where event_id = events.id
        and user_id  = (select auth.uid())
    )
  );

create policy "Organizers manage own events in editable status"
  on events for update
  using (
    status in ('draft', 'rejected')
    and (
      created_by = (select auth.uid())
      or submitted_by = (select auth.uid())
      or exists (
        select 1 from event_organizers
        where event_id = events.id
          and user_id  = (select auth.uid())
          and can_edit
      )
    )
  )
  with check (
    status in ('draft', 'submitted', 'cancelled')
  );

create policy "Organizers insert events"
  on events for insert
  with check (
    (select current_user_has_role('organizer'))
    and created_by = (select auth.uid())
  );

create policy "CPD committee reads all events"
  on events for select
  using ((select current_user_has_role('cpd_committee')));

create policy "CPD committee transitions events under review"
  on events for update
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all events"
  on events for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes events"
  on events for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- event_sessions (4b) -----------------------------------------------------
alter table event_sessions enable row level security;

create policy "Anyone reads sessions of approved public events"
  on event_sessions for select
  using (
    exists (
      select 1 from events
      where events.id = event_sessions.event_id
        and events.status in ('approved', 'completed')
        and events.is_public
    )
  );

create policy "Organizers read own event sessions"
  on event_sessions for select
  using (
    exists (
      select 1 from events
      where events.id = event_sessions.event_id
        and (
          events.created_by    = (select auth.uid())
          or events.submitted_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
          )
        )
    )
  );

create policy "Organizers manage own event sessions"
  on event_sessions for all
  using (
    exists (
      select 1 from events
      where events.id = event_sessions.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_sessions.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  );

create policy "CPD committee reads all sessions"
  on event_sessions for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes sessions"
  on event_sessions for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- event_organizers (4c) ---------------------------------------------------
alter table event_organizers enable row level security;

create policy "Anyone reads organizers of approved public events"
  on event_organizers for select
  using (
    exists (
      select 1 from events
      where events.id = event_organizers.event_id
        and events.status in ('approved', 'completed')
        and events.is_public
    )
  );

create policy "Organizers read same-event organizers"
  on event_organizers for select
  using (
    exists (
      select 1 from events
      where events.id = event_organizers.event_id
        and (
          events.created_by    = (select auth.uid())
          or events.submitted_by = (select auth.uid())
          or exists (
            select 1 from event_organizers eo
            where eo.event_id = events.id
              and eo.user_id  = (select auth.uid())
          )
        )
    )
  );

create policy "Lead organizer manages roster"
  on event_organizers for all
  using (
    exists (
      select 1 from events
      where events.id = event_organizers.event_id
        and events.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_organizers.event_id
        and events.created_by = (select auth.uid())
    )
  );

create policy "CPD committee reads all organizers"
  on event_organizers for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes organizers"
  on event_organizers for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- event_accreditations + allocations (4e) --------------------------------
alter table event_accreditations enable row level security;
alter table event_credit_allocations enable row level security;

create policy "Anyone reads accreditations of approved public events"
  on event_accreditations for select
  using (
    exists (
      select 1 from events
      where events.id = event_accreditations.event_id
        and events.status in ('approved', 'completed')
        and events.is_public
    )
  );

create policy "Organizers read own event accreditations"
  on event_accreditations for select
  using (
    exists (
      select 1 from events
      where events.id = event_accreditations.event_id
        and (
          events.created_by    = (select auth.uid())
          or events.submitted_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
          )
        )
    )
  );

create policy "CPD committee reads all accreditations"
  on event_accreditations for select
  using ((select current_user_has_role('cpd_committee')));

create policy "CPD committee writes accreditations"
  on event_accreditations for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes accreditations"
  on event_accreditations for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "Anyone reads allocations of approved public events"
  on event_credit_allocations for select
  using (
    exists (
      select 1 from event_accreditations ea
      join events on events.id = ea.event_id
      where ea.id = event_credit_allocations.accreditation_id
        and events.status in ('approved', 'completed')
        and events.is_public
    )
  );

create policy "CPD committee writes allocations"
  on event_credit_allocations for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes allocations"
  on event_credit_allocations for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- event_registrations (5a) -----------------------------------------------
alter table event_registrations enable row level security;

create policy "Practitioners read own registrations"
  on event_registrations for select
  using (practitioner_id = (select auth.uid()));

create policy "Practitioners insert own registrations"
  on event_registrations for insert
  with check (
    practitioner_id = (select auth.uid())
    and exists (
      select 1 from events
      where events.id = event_registrations.event_id
        and events.status in ('approved', 'completed')
    )
  );

create policy "Practitioners update own registrations"
  on event_registrations for update
  using (practitioner_id = (select auth.uid()))
  with check (practitioner_id = (select auth.uid()));

create policy "Organizers read own event registrations"
  on event_registrations for select
  using (
    exists (
      select 1 from events
      where events.id = event_registrations.event_id
        and (
          events.created_by    = (select auth.uid())
          or events.submitted_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
          )
        )
    )
  );

create policy "Organizers write own event registrations"
  on event_registrations for all
  using (
    exists (
      select 1 from events
      where events.id = event_registrations.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_registrations.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  );

create policy "CPD committee reads all registrations"
  on event_registrations for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all registrations"
  on event_registrations for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes registrations"
  on event_registrations for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- event_attendances (5b) -------------------------------------------------
alter table event_attendances enable row level security;

create policy "Practitioners read own attendances"
  on event_attendances for select
  using (practitioner_id = (select auth.uid()));

create policy "Practitioners self check in"
  on event_attendances for insert
  with check (
    practitioner_id = (select auth.uid())
    and method      = 'self_check_in'
    and status      = 'pending'
    and verified_at is null
    and verified_by is null
    and exists (
      select 1 from events
      where events.id = event_attendances.event_id
        and events.status in ('approved', 'completed')
    )
  );

create policy "Organizers read own event attendances"
  on event_attendances for select
  using (
    exists (
      select 1 from events
      where events.id = event_attendances.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
          )
        )
    )
  );

create policy "Organizers manage own event attendances"
  on event_attendances for all
  using (
    exists (
      select 1 from events
      where events.id = event_attendances.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  )
  with check (
    exists (
      select 1 from events
      where events.id = event_attendances.event_id
        and (
          events.created_by = (select auth.uid())
          or exists (
            select 1 from event_organizers
            where event_organizers.event_id = events.id
              and event_organizers.user_id  = (select auth.uid())
              and event_organizers.can_edit
          )
        )
    )
  );

create policy "CPD committee reads all attendances"
  on event_attendances for select
  using ((select current_user_has_role('cpd_committee')));

create policy "MMA admin reads all attendances"
  on event_attendances for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes attendances"
  on event_attendances for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
