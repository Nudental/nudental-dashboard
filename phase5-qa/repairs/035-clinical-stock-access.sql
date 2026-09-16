-- PH5-AUTH-020: restrict clinical stock/history to existing active page/office access.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Clinical stock access repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_clinical_stock_access_boundary
ON public.office_supply_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=office_supply_inventory.office_id AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
)
WITH CHECK (
  last_updated_by=auth.uid()
  AND public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=office_supply_inventory.office_id AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
);

CREATE POLICY dashboard_clinical_history_access_boundary
ON public.supply_inventory_history AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=supply_inventory_history.office_id AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
)
WITH CHECK (
  changed_by=auth.uid()
  AND public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=supply_inventory_history.office_id AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.office_supply_inventory i
    WHERE i.id=supply_inventory_history.inventory_id AND i.office_id=supply_inventory_history.office_id)
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
);
COMMIT;
