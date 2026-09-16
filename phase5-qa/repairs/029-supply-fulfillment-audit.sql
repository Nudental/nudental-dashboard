-- PH5-AUDIT-008: transactional, actor-bound fulfillment history in isolated QA.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Fulfillment audit repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION dashboard_qa.audit_supply_fulfillment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NEW; END IF;
  INSERT INTO public.supply_audit_logs
    (record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    'supply_fulfillment_log',lower(TG_OP),auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.audit_supply_fulfillment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_fulfillment_audit
AFTER INSERT OR UPDATE OR DELETE ON public.supply_fulfillment_logs
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.audit_supply_fulfillment();

CREATE POLICY dashboard_fulfillment_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'supply_fulfillment_log' OR (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=coalesce(supply_audit_logs.new_values->>'office_id',supply_audit_logs.old_values->>'office_id')
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
));
CREATE POLICY dashboard_fulfillment_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'supply_fulfillment_log');
COMMIT;
