-- PH5-AUDIT-005: inventory lookup writes were absent from the existing row audit.
-- QA only. Reuse the established audit function; no rows or policies change.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Implant lookup audit requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE TRIGGER trg_audit_implant_companies
AFTER INSERT OR UPDATE OR DELETE ON public.implant_companies
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_implant_systems
AFTER INSERT OR UPDATE OR DELETE ON public.implant_systems
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_implant_platform_sizes
AFTER INSERT OR UPDATE OR DELETE ON public.implant_platform_sizes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_implant_lengths
AFTER INSERT OR UPDATE OR DELETE ON public.implant_lengths
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER trg_audit_implant_diameters
AFTER INSERT OR UPDATE OR DELETE ON public.implant_diameters
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
COMMIT;
