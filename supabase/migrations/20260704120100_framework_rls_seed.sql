-- ============================================================================
-- 0005 — Framework Part 3a: RLS + seeds
-- RLS per Database Schema.md (world-readable framework; committee + admin
-- write). Seeds per Part 8: the real MMA four-category matrix (2026-06-22),
-- 17 sub-tiers, the 2026–2027 cycle (total 50.0 = C1 PLACEHOLDER), floors
-- CAT1/CAT2 = 5, pooled shelf caps 2D=3 / 4A=5 / 4B=6.
-- ============================================================================

-- --- RLS --------------------------------------------------------------------
alter table cpd_cycles enable row level security;
alter table credit_categories enable row level security;
alter table cpd_cycle_category_caps enable row level security;
alter table credit_subcategories enable row level security;
alter table cpd_cycle_subcategory_caps enable row level security;

create policy "Anyone reads cycles"
  on cpd_cycles for select using (true);

create policy "Anyone reads active categories"
  on credit_categories for select
  using (is_active or (select current_user_has_role('mma_admin')));

create policy "Anyone reads caps"
  on cpd_cycle_category_caps for select using (true);

create policy "Anyone reads active subcategories"
  on credit_subcategories for select
  using (is_active or (select current_user_has_role('mma_admin')));

create policy "Anyone reads subcategory caps"
  on cpd_cycle_subcategory_caps for select using (true);

create policy "CPD committee writes cycles"
  on cpd_cycles for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "CPD committee writes categories"
  on credit_categories for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "CPD committee writes caps"
  on cpd_cycle_category_caps for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes cycles"
  on cpd_cycles for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes categories"
  on credit_categories for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "MMA admin writes caps"
  on cpd_cycle_category_caps for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "CPD committee writes subcategories"
  on credit_subcategories for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes subcategories"
  on credit_subcategories for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

create policy "CPD committee writes subcategory caps"
  on cpd_cycle_subcategory_caps for all
  using ((select current_user_has_role('cpd_committee')))
  with check ((select current_user_has_role('cpd_committee')));

create policy "MMA admin writes subcategory caps"
  on cpd_cycle_subcategory_caps for all
  using ((select current_user_has_role('mma_admin')))
  with check ((select current_user_has_role('mma_admin')));

-- --- Seeds ------------------------------------------------------------------
insert into credit_categories (code, name, description, display_order) values
  ('CAT1', 'Category 1 — Formal Education & Learning',            'Scientific meetings, conferences, skill workshops', 1),
  ('CAT2', 'Category 2 — Practice Improvement & Work-Based Learning', 'CMEs, M&M, audits, performance review, committees', 2),
  ('CAT3', 'Category 3 — Academic & Scholarly Activities',        'Presenting, teaching roles, research, publications, guidelines', 3),
  ('CAT4', 'Category 4 — Professional Leadership & Self-Development',  'Leadership roles, community service, non-medical courses', 4)
on conflict (code) do nothing;

insert into credit_subcategories (category_id, code, name, pre_registration, pillar, display_order)
select cc.id, t.code, t.name, t.prereg::pre_registration_rule, t.pillar, t.ord
from (values
  ('CAT1','1A', 'Knowledge-based (meetings/conferences/seminars)', 'required',     null::int, 1),
  ('CAT1','1B', 'Skill-based workshops (ACLS/BLS/PALS/ATLS/POCUS)', 'required',     null,      2),
  ('CAT2','2A1','Institutional (CME, MDT, case conf, journal club, grand rounds)', 'required', null, 3),
  ('CAT2','2A2','External (CME, topic seminars, MDT)',              'not_required', null,      4),
  ('CAT2','2B', 'Quality & Safety (M&M, audits, accreditation, QA)','conditional',  null,      5),
  ('CAT2','2C', 'Performance Review (peer review, appraisal, mentoring received)', 'not_required', null, 6),
  ('CAT2','2D', 'Institutional strengthening (committee/task-force membership)', 'not_required', null, 7),
  ('CAT3','3A', 'Keynote/trainer/facilitator (Pillar 1)',           'not_required', 1,         8),
  ('CAT3','3B', 'Standard presenter/moderator (Pillar 1)',          'not_required', 1,         9),
  ('CAT3','3C', 'Presenter in hospital/dept meetings (Pillar 2)',   'not_required', 2,         10),
  ('CAT3','3D', 'Educational/mentorship roles (faculty/mentor/examiner)', 'not_required', null, 11),
  ('CAT3','3E1','Research & publications (PI/1st author/editor)',   'not_required', null,      12),
  ('CAT3','3E2','Research & publications (co-author/reviewer)',     'not_required', null,      13),
  ('CAT3','3F', 'Member of clinical/consensus guidelines',         'not_required', null,      14),
  ('CAT4','4A', 'Leadership roles (societies, NGOs, committees)',   'not_required', null,      15),
  ('CAT4','4B', 'Community service beyond Greater Malé (outreach, camps)', 'not_required', null, 16),
  ('CAT4','4C', 'Self-development courses (outside medical field)', 'not_required', null,      17)
) as t(cat_code, code, name, prereg, pillar, ord)
join credit_categories cc on cc.code = t.cat_code
on conflict (code) do nothing;

insert into cpd_cycles (name, starts_on, ends_on, is_current, total_credits_required, notes)
values (
  '2026–2027 cycle',
  '2026-01-01',
  '2027-12-31',
  true,
  50.0,  -- ⚠️ PLACEHOLDER — matrix states no overall total (Credit Framework C1). Confirm before launch.
  'Initial cycle — overall total (C1) and cycle length (C4) still owed by MMA; floors/sub-caps per the 2026-06-22 matrix.'
)
on conflict do nothing;

insert into cpd_cycle_category_caps (cycle_id, category_id, min_credits, max_credits)
select cy.id, cc.id, t.min_c, t.max_c
from (values
  ('CAT1', 5.0,  null::numeric),
  ('CAT2', 5.0,  null)
) as t(code, min_c, max_c)
join credit_categories cc on cc.code = t.code
cross join cpd_cycles cy
where cy.name = '2026–2027 cycle'
on conflict (cycle_id, category_id) do nothing;

insert into cpd_cycle_subcategory_caps (cycle_id, subcategory_id, max_per_cycle)
select cy.id, sc.id, t.cap
from (values
  ('2D', 3.0),
  ('4A', 5.0),
  ('4B', 6.0)
) as t(code, cap)
join credit_subcategories sc on sc.code = t.code
cross join cpd_cycles cy
where cy.name = '2026–2027 cycle'
on conflict (cycle_id, subcategory_id) do nothing;
