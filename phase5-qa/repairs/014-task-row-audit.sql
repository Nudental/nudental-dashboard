-- PH5-AUDIT-004: task writes must reach the existing database row audit.
-- QA only; existing semantic workflow logs remain separate and unchanged.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Task row audit requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE TRIGGER trg_audit_action_items
AFTER INSERT OR UPDATE OR DELETE ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
