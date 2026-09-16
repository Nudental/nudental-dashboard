-- The approved QA rule: Regional Manager/Admin only; never self-review.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Front Desk review repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

-- The existing restrictive account/page/office policy remains mandatory.
CREATE POLICY dashboard_front_desk_reviewer_update
ON public.supply_request_batches FOR UPDATE TO authenticated
USING (department_category='Front Desk' AND EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND p.role IN ('super_admin','admin','regional_manager')
));

CREATE FUNCTION dashboard_qa.guard_front_desk_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_review_changed boolean;
BEGIN
  -- Maintenance/import operations retain their existing service-only boundary.
  IF v_actor IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.department_category='Front Desk' AND (
      NEW.requested_by IS DISTINCT FROM v_actor OR NEW.batch_status IS DISTINCT FROM 'draft'
      OR NEW.reviewer_id IS NOT NULL OR nullif(btrim(NEW.reviewer_notes),'') IS NOT NULL
    ) THEN RAISE EXCEPTION 'Create your own draft before submission' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.department_category IS DISTINCT FROM 'Front Desk'
     AND NEW.department_category IS DISTINCT FROM 'Front Desk' THEN RETURN NEW; END IF;
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.department_category IS DISTINCT FROM OLD.department_category THEN
    RAISE EXCEPTION 'Request owner and category cannot be changed' USING ERRCODE='42501';
  END IF;
  -- Receipt fulfillment keeps its existing writer/transaction rules.
  IF OLD.batch_status IN ('approved','partially_fulfilled')
     AND NEW.batch_status IN ('partially_fulfilled','fulfilled')
     AND NEW.reviewer_id IS NOT DISTINCT FROM OLD.reviewer_id
     AND NEW.reviewer_notes IS NOT DISTINCT FROM OLD.reviewer_notes THEN RETURN NEW; END IF;
  v_review_changed := NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
    OR NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes
    OR (NEW.batch_status IS DISTINCT FROM OLD.batch_status
      AND NOT (OLD.batch_status='draft' AND NEW.batch_status='submitted'));
  IF NOT v_review_changed THEN RETURN NEW; END IF;
  IF NOT public.dashboard_has_active_profile() OR OLD.requested_by IS NOT DISTINCT FROM v_actor
     OR NOT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=v_actor
       AND p.role IN ('super_admin','admin','regional_manager')) THEN
    RAISE EXCEPTION 'Regional Manager/Admin review required; self-review is not allowed' USING ERRCODE='42501';
  END IF;
  IF NEW.reviewer_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Reviewer must be the signed-in account' USING ERRCODE='42501';
  END IF;
  IF NEW.batch_status IS DISTINCT FROM OLD.batch_status AND NOT (
    OLD.batch_status IN ('submitted','under_review') AND NEW.batch_status IN ('under_review','approved','rejected')
  ) THEN RAISE EXCEPTION 'Request state no longer permits this action' USING ERRCODE='22023'; END IF;
  IF NEW.batch_status='rejected' AND nullif(btrim(NEW.reviewer_notes),'') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (NEW.id,'supply_request_batch','status_'||NEW.batch_status::text,v_actor,
    to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.guard_front_desk_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_front_desk_review_guard
BEFORE INSERT OR UPDATE ON public.supply_request_batches
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.guard_front_desk_review();
COMMIT;
