-- Restrict urgent requests to the existing active-account, page and office scope.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Urgent request boundary requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
CREATE POLICY dashboard_urgent_request_access_boundary
ON public.urgent_supply_requests AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=urgent_supply_requests.office_id AND public.user_can_access_office(o.id)
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
