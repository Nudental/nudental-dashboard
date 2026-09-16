-- QA urgent requests: atomic history and private simulated notification intents.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Urgent request simulation requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION dashboard_qa.audit_urgent_supply_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at')=(to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    'urgent_supply_request',lower(TG_OP),auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW)||
      CASE WHEN TG_OP='INSERT' THEN jsonb_build_object('notification_mode','simulated') ELSE '{}'::jsonb END END
  );
  IF TG_OP='INSERT' THEN
    INSERT INTO dashboard_qa.execution_intents(adapter,operation,subject_id)
    VALUES ('supply_email_qa','notification.simulate',NEW.id::text),
           ('supply_sms_qa','notification.simulate',NEW.id::text);
  END IF;
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.audit_urgent_supply_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_urgent_request_audit
AFTER INSERT OR UPDATE OR DELETE ON public.urgent_supply_requests
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.audit_urgent_supply_request();

CREATE POLICY dashboard_urgent_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'urgent_supply_request' OR (
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
CREATE POLICY dashboard_urgent_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'urgent_supply_request');
COMMIT;
