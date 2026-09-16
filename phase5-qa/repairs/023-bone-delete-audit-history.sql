-- PH5-AUDIT-007: AFTER DELETE writes an audit row for the removed record.
-- Keep its historical record ID and existing audits instead of enforcing a
-- live-parent foreign key whose cascade conflicts with that audit trigger.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Bone deletion audit repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
ALTER TABLE public.bone_tissue_audit_log
  DROP CONSTRAINT bone_tissue_audit_log_record_id_fkey;
COMMIT;
