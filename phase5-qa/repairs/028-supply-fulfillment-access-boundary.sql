-- PH5-AUTH-017: fulfillment data follows its existing Clinical Supply page.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Fulfillment access repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_fulfillment_access_boundary
ON public.supply_fulfillment_logs AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=supply_fulfillment_logs.office_id AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
);
COMMIT;
