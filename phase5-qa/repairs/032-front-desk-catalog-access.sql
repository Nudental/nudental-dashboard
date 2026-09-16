-- PH5-AUTH-018: catalog access must honor existing account, office and page grants.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Front Desk catalog access repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
CREATE POLICY dashboard_front_desk_catalog_access_boundary
ON public.front_desk_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=front_desk_inventory.office_location::text
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true
    ))
  )
);
COMMIT;
