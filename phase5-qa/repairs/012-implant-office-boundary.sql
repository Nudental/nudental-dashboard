-- PH5-AUTH-011: retain existing implant roles while enforcing account/office scope.
-- Candidate for isolated Dashboard QA only. No inventory records are changed.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Implant boundary requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_implant_inventory_active_office_boundary
ON public.implant_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

CREATE POLICY dashboard_implant_usage_active_office_boundary
ON public.implant_usage_logs AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

-- The recovered AFTER INSERT trigger deducts stock as its owner. The usage row's
-- office alone cannot authorize that related write. Check the linked inventory
-- office as well; authorized multi-office users retain their existing access.
CREATE FUNCTION public.dashboard_guard_implant_usage_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR NEW.implant_inventory_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.dashboard_has_active_profile() OR NOT EXISTS(
    SELECT 1 FROM public.implant_inventory i WHERE i.id=NEW.implant_inventory_id
      AND public.user_can_access_office(i.office_id)
  ) THEN
    RAISE EXCEPTION 'Linked inventory office access denied' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_implant_usage_stock() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dashboard_implant_usage_stock_guard BEFORE INSERT OR UPDATE
ON public.implant_usage_logs FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_implant_usage_stock();
COMMIT;
