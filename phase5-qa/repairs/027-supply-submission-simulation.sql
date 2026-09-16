-- QA-only submission: durable audit and notification intents, never provider IO.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Supply submission simulation requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.dashboard_qa_supply_submission_intents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
BEGIN
  INSERT INTO dashboard_qa.execution_intents(adapter,operation,subject_id)
  VALUES ('supply_email_qa','notification.simulate',NEW.id::text),
         ('supply_sms_qa','notification.simulate',NEW.id::text);
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_qa_supply_submission_intents() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_supply_submission_intents
AFTER UPDATE ON public.supply_request_batches FOR EACH ROW
WHEN (OLD.batch_status='draft' AND NEW.batch_status='submitted')
EXECUTE FUNCTION public.dashboard_qa_supply_submission_intents();

CREATE FUNCTION public.submit_supply_request_qa(p_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_before public.supply_request_batches%ROWTYPE;
  v_saved public.supply_request_batches%ROWTYPE;
  v_permission text;
BEGIN
  IF v_actor IS NULL OR NOT public.dashboard_has_active_profile() THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_before FROM public.supply_request_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND OR (v_before.requested_by IS DISTINCT FROM v_actor
      AND NOT public.is_supply_admin_or_above()) THEN
    RAISE EXCEPTION 'Request not available for submission' USING ERRCODE='42501';
  END IF;
  v_permission := CASE WHEN v_before.department_category='Front Desk'
    THEN 'request:front_desk_order' ELSE 'request:back_staff_order' END;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=v_actor AND
    (p.role='super_admin' OR coalesce((
      SELECT rp.enabled FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission=v_permission
    ), p.role='admin'))
  ) THEN
    RAISE EXCEPTION 'Supply request permission required' USING ERRCODE='42501';
  END IF;
  IF v_before.batch_status='submitted' THEN RETURN to_jsonb(v_before); END IF;
  IF v_before.batch_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only a draft can be submitted' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.supply_request_items WHERE batch_id=p_batch_id) THEN
    RAISE EXCEPTION 'Add at least one item before submitting' USING ERRCODE='22023';
  END IF;
  UPDATE public.supply_request_batches
  SET batch_status='submitted',submitted_at=now(),updated_at=now()
  WHERE id=p_batch_id RETURNING * INTO v_saved;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (p_batch_id,'supply_request_batch','status_submitted',v_actor,to_jsonb(v_before),
    to_jsonb(v_saved)||jsonb_build_object('notification_mode','simulated'));
  RETURN to_jsonb(v_saved);
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_supply_request_qa(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_supply_request_qa(uuid) TO authenticated;
COMMIT;
