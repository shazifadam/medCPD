-- ============================================================================
-- 0016 — repair double-encoded jsonb. postgres-js sends string params typed
-- as json, so `${JSON.stringify(x)}::jsonb` stored a jsonb STRING (the P3
-- "jsonb comes back as a string" gotcha was this, not driver behavior).
-- App code now passes sql.json(...); this re-parses the rows written before
-- the fix. Only cpd_entries.calc_inputs was app-written this way
-- (certificates.payload shipped after the fix; audit_log is trigger-written).
-- ============================================================================

update cpd_entries
set calc_inputs = (calc_inputs #>> '{}')::jsonb
where jsonb_typeof(calc_inputs) = 'string';
