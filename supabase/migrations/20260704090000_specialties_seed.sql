-- ============================================================================
-- 0003 — Specialties starter seed
-- PLACEHOLDER taxonomy: the official list comes from MMDC (Discovery Q6).
-- Codes are stable identifiers; names/ordering can be edited by MMA admin in
-- FM (Framework Management) without migration. is_active toggles retirement.
-- ============================================================================

insert into specialties (code, name, display_order) values
  ('GP',    'General Practice',            10),
  ('IM',    'Internal Medicine',           20),
  ('PED',   'Paediatrics',                 30),
  ('OBGYN', 'Obstetrics & Gynaecology',    40),
  ('SURG',  'General Surgery',             50),
  ('ORTHO', 'Orthopaedics',                60),
  ('CARD',  'Cardiology',                  70),
  ('DERM',  'Dermatology',                 80),
  ('ENT',   'Otorhinolaryngology (ENT)',   90),
  ('OPHTH', 'Ophthalmology',              100),
  ('PSYCH', 'Psychiatry',                 110),
  ('ANAES', 'Anaesthesiology',            120),
  ('RAD',   'Radiology',                  130),
  ('PATH',  'Pathology',                  140),
  ('EM',    'Emergency Medicine',         150),
  ('PH',    'Public Health',              160),
  ('DENT',  'Dentistry',                  170),
  ('OTHER', 'Other',                      999)
on conflict (code) do nothing;
