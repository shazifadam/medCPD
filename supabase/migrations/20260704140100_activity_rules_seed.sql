-- ============================================================================
-- 0007 — Part 3b seeds: 17 activity leaves (one per matrix sub-tier) + the
-- 2026–2027 rate book. Per Database Schema.md Part 8 (updated 2026-06-22).
-- evidence_requirement per leaf = C7 working defaults. Idempotent.
-- ============================================================================

insert into activity_types (code, name, calculation_method, evidence_requirement,
                            allows_self_report, requires_event, default_category_id, subcategory_id)
select t.code, t.name, t.calc::credit_calculation_method, t.evi::evidence_requirement,
       t.srep, t.revent, cc.id, sc.id
from (values
  -- CAT1 — event-based, pre-reg required, day-banded
  ('CAT1_KNOWLEDGE', 'Scientific meeting / conference / seminar', 'banded', 'on_audit', false, true,  '1A'),
  ('CAT1_SKILL',     'Skill-based workshop (ACLS/BLS/PALS/ATLS/POCUS)', 'banded', 'on_audit', false, true, '1B'),
  -- CAT2 — per session
  ('CAT2_INSTITUTIONAL', 'Institutional CME / MDT / case conf / journal club / grand rounds', 'per_session', 'on_audit', true, false, '2A1'),
  ('CAT2_EXTERNAL',  'External CME / topic seminar / MDT',         'per_session', 'on_audit', true,  false, '2A2'),
  ('CAT2_QUALITY',   'Quality & Safety (M&M / audit / accreditation / QA)', 'per_session', 'on_audit', true, false, '2B'),
  ('CAT2_PERFREVIEW','Performance review / mentoring received',    'per_session', 'on_audit', true,  false, '2C'),
  ('CAT2_INSTSTRENGTH','Committee / task-force membership',         'per_session', 'on_audit', true,  false, '2D'),
  -- CAT3 — flat per event/activity/year
  ('CAT3_KEYNOTE',   'Keynote / trainer / facilitator (Pillar 1)', 'flat', 'always',   true,  false, '3A'),
  ('CAT3_PRESENTER', 'Standard presenter / moderator (Pillar 1)',  'flat', 'always',   true,  false, '3B'),
  ('CAT3_DEPTPRES',  'Presenter in hospital/dept meeting (Pillar 2)', 'flat', 'on_audit', true, false, '3C'),
  ('CAT3_EDUROLE',   'Faculty / mentor / examiner role',           'flat', 'always',   true,  false, '3D'),
  ('CAT3_RESEARCH1', 'Research/publication — PI / 1st author / editor', 'flat', 'always', true, false, '3E1'),
  ('CAT3_RESEARCH2', 'Research/publication — co-author / reviewer','flat', 'always',   true,  false, '3E2'),
  ('CAT3_GUIDELINE', 'Clinical / consensus guideline member',      'flat', 'always',   true,  false, '3F'),
  -- CAT4 — flat per activity/course
  ('CAT4_LEADERSHIP','Leadership role (society / NGO / committee)', 'flat', 'always',   true,  false, '4A'),
  ('CAT4_COMMUNITY', 'Community service beyond Greater Malé',       'flat', 'always',   true,  false, '4B'),
  ('CAT4_SELFDEV',   'Self-development course (outside medicine)',  'flat', 'always',   true,  false, '4C')
) as t(code, name, calc, evi, srep, revent, sub_code)
join credit_subcategories sc on sc.code = t.sub_code
join credit_categories cc    on cc.id   = sc.category_id
on conflict (code) do nothing;

-- Rate book: one rule per activity type. CAT1 banded (rate ignored,
-- band_lookup carries ½d→4, 1d→8, 2d→16, 2.5d+→20). 3D = 5/YEAR.
-- Pooled shelf caps (2D/4A/4B) live on cpd_cycle_subcategory_caps, NOT here.
insert into framework_rules (cycle_id, activity_type_id, category_id, role_label, rate,
                             cap_period, band_lookup)
select
  cy.id, at.id, at.default_category_id, null::participant_role, t.rate,
  t.cap_period::cap_period, t.band_lookup::jsonb
from (values
  ('CAT1_KNOWLEDGE',  0, 'per_cycle', '[{"max_hours":4,"points":4},{"max_hours":8,"points":8},{"max_hours":16,"points":16},{"max_hours":null,"points":20}]'),
  ('CAT1_SKILL',      0, 'per_cycle', '[{"max_hours":4,"points":4},{"max_hours":8,"points":8},{"max_hours":16,"points":16},{"max_hours":null,"points":20}]'),
  ('CAT2_INSTITUTIONAL', 1.0, 'per_cycle', null),
  ('CAT2_EXTERNAL',      1.0, 'per_cycle', null),
  ('CAT2_QUALITY',       1.0, 'per_cycle', null),
  ('CAT2_PERFREVIEW',    1.0, 'per_cycle', null),
  ('CAT2_INSTSTRENGTH',  1.0, 'per_cycle', null),
  ('CAT3_KEYNOTE',    5.0, 'per_cycle', null),
  ('CAT3_PRESENTER',  3.0, 'per_cycle', null),
  ('CAT3_DEPTPRES',   2.0, 'per_cycle', null),
  ('CAT3_EDUROLE',    5.0, 'per_year',  null),
  ('CAT3_RESEARCH1',  5.0, 'per_cycle', null),
  ('CAT3_RESEARCH2',  3.0, 'per_cycle', null),
  ('CAT3_GUIDELINE',  3.0, 'per_cycle', null),
  ('CAT4_LEADERSHIP', 5.0, 'per_cycle', null),
  ('CAT4_COMMUNITY',  3.0, 'per_cycle', null),
  ('CAT4_SELFDEV',    3.0, 'per_cycle', null)
) as t(activity_code, rate, cap_period, band_lookup)
join activity_types at on at.code = t.activity_code
cross join cpd_cycles cy
where cy.name = '2026–2027 cycle'
on conflict (cycle_id, activity_type_id, category_id, role_label) do nothing;
