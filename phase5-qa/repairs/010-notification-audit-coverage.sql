-- PH5-NOTIF-002: preserve existing audit semantics for notification writes in QA.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Notification audit coverage requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE TRIGGER trg_audit_notifications AFTER INSERT OR UPDATE OR DELETE
ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
