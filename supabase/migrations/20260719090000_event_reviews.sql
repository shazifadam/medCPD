-- ============================================================================
-- P5 — Part 4d: event_reviews (accreditation workflow log) + RLS.
-- Faithful to vault "Database Schema.md" Part 4d. Append-only by policy —
-- no UPDATE/DELETE for non-admin roles (enforced by absence).
-- ============================================================================

create type event_review_action as enum (
  'picked_up',            -- committee member moves event from submitted to under_review
  'approved',             -- committee approves; event.status → approved
  'rejected',             -- committee rejects; event.status → rejected
  'requested_revisions',  -- committee asks for changes; event.status → rejected (org resubmits)
  'commented'             -- review note without a state transition
);

create table event_reviews (
  id              uuid                  primary key default gen_random_uuid(),
  event_id        uuid                  not null references events(id) on delete cascade,
  reviewer_id     uuid                  not null references profiles(id) on delete restrict,
  action          event_review_action   not null,
  comments        text,
  from_status     event_status,
  to_status       event_status,
  stage           int                   not null default 1,

  created_at      timestamptz           not null default now(),

  check (
    (action in ('picked_up', 'approved', 'rejected', 'requested_revisions')
       and from_status is not null and to_status is not null)
    or
    (action = 'commented'
       and from_status is null and to_status is null)
  ),
  check (
    action not in ('rejected', 'requested_revisions') or comments is not null
  )
);

create index idx_event_reviews_event on event_reviews(event_id, created_at desc);
create index idx_event_reviews_reviewer on event_reviews(reviewer_id);
create index idx_event_reviews_action on event_reviews(action);

-- --- RLS ---------------------------------------------------------------------
alter table event_reviews enable row level security;

create policy "Organizers read reviews on own events"
  on event_reviews for select
  using (
    exists (
      select 1 from events
      where events.id = event_reviews.event_id
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

create policy "CPD committee reads all reviews"
  on event_reviews for select
  using ((select current_user_has_role('cpd_committee')));

create policy "CPD committee writes own reviews"
  on event_reviews for insert
  with check (
    (select current_user_has_role('cpd_committee'))
    and reviewer_id = (select auth.uid())
  );

create policy "MMA admin reads all reviews"
  on event_reviews for select
  using ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes reviews"
  on event_reviews for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));
