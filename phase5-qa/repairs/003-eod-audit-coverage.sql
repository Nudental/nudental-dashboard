-- PH5-AUDIT-001: reuse the existing row-audit function for EOD writes.
-- Isolated Dashboard QA only. No existing records are changed or backfilled.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'EOD audit candidate requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE TRIGGER trg_audit_daily_entries
AFTER INSERT OR DELETE OR UPDATE ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
