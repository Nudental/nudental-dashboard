-- PH5-AUDIT-006: inventory deletion bypassed both existing audit surfaces.
-- QA only. Preserve normal create/update logging and existing permissions.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Implant deletion audit requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE TRIGGER trg_audit_implant_inventory_delete
AFTER DELETE ON public.implant_inventory
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
