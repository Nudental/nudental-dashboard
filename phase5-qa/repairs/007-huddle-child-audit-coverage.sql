-- PH5-HUDDLE-005: reuse the existing audit function for Huddle child writes.
-- Isolated Dashboard QA only. Existing rows/history are not changed or backfilled.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Huddle audit candidate requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE TRIGGER trg_audit_huddle_provider_blocks
AFTER INSERT OR DELETE OR UPDATE ON public.huddle_provider_blocks
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_huddle_checklist_items
AFTER INSERT OR DELETE OR UPDATE ON public.huddle_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
