-- PH5-AUTH-016: enforce existing account/office/section access on supply requests.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Supply request access repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_supply_batch_access_boundary
ON public.supply_request_batches AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=supply_request_batches.office_id AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission=CASE WHEN supply_request_batches.department_category='Front Desk'
        THEN 'resources.inventory.front_desk.view'
        ELSE 'resources.inventory.monthly_supply.view' END
      AND rp.enabled=true
    ))
  )
);

CREATE POLICY dashboard_supply_item_parent_boundary
ON public.supply_request_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_request_items.batch_id
));
COMMIT;
