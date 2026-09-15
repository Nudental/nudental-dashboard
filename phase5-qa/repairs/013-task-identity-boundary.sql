-- PH5-AUTH-012: bind task authorship and lifecycle metadata to the QA actor.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Task identity guard requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.dashboard_guard_task_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  stage text;
  previous jsonb;
  incoming jsonb := to_jsonb(NEW);
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid()
       OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
          AND role::text IN ('super_admin','admin','office_manager','regional_manager','regional_clinical_manager'))
       OR NEW.task_status NOT IN ('pending','submitted')
       OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL
       OR NEW.in_progress_at IS NOT NULL OR NEW.in_progress_by IS NOT NULL
       OR NEW.completed_at IS NOT NULL OR NEW.completed_by IS NOT NULL THEN
      RAISE EXCEPTION 'New tasks require their manager creator and an initial state' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Task creator is immutable' USING ERRCODE='42501';
  END IF;
  previous := to_jsonb(OLD);
  FOREACH stage IN ARRAY ARRAY['acknowledged','in_progress','completed'] LOOP
    IF (incoming ->> (stage || '_at')) IS DISTINCT FROM (previous ->> (stage || '_at'))
       OR (incoming ->> (stage || '_by')) IS DISTINCT FROM (previous ->> (stage || '_by')) THEN
      IF (previous ->> (stage || '_at')) IS NOT NULL OR (previous ->> (stage || '_by')) IS NOT NULL THEN
        RAISE EXCEPTION 'Existing task lifecycle metadata is immutable' USING ERRCODE='42501';
      END IF;
      IF NEW.task_status IS DISTINCT FROM stage OR NEW.task_status IS NOT DISTINCT FROM OLD.task_status
         OR (incoming ->> (stage || '_at')) IS NULL
         OR (incoming ->> (stage || '_by')) IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION 'Task lifecycle metadata requires the current actor and matching transition' USING ERRCODE='42501';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_task_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dashboard_task_identity_guard BEFORE INSERT OR UPDATE
ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_task_identity();
COMMIT;
