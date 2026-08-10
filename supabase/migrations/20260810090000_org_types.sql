-- Update 1 follow-up (user 2026-08-10): NGO + Council organization types.
-- 'polyclinic' stays in the enum (values can't be dropped) but is removed
-- from every UI option list.
alter type institution_type add value if not exists 'ngo';
alter type institution_type add value if not exists 'council';
