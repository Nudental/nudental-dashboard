-- PH5-AUTH-019: the history table's service policy was incorrectly public.
-- Match the existing read-only history UI plus its explicit Mark Closed roles.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Front Desk order access repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
ALTER POLICY fdao_service_policy ON public.front_desk_amazon_orders TO service_role;
ALTER POLICY fdao_select_policy ON public.front_desk_amazon_orders TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o WHERE o.name=front_desk_amazon_orders.office_location::text
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
CREATE POLICY dashboard_front_desk_order_update
ON public.front_desk_amazon_orders FOR UPDATE TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o WHERE o.name=front_desk_amazon_orders.office_location::text
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND p.role IN ('super_admin','admin','office_manager','regional_clinical_manager')
    AND (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true
    ))
  )
);
COMMIT;
