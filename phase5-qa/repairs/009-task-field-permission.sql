-- PH5-AUTH-009: preserve the UI's manager-only task editing boundary in QA.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Task field permission requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.dashboard_guard_task_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  lifecycle_fields text[] := ARRAY[
    'task_status','updated_at','acknowledged_at','acknowledged_by',
    'in_progress_at','in_progress_by','completed_at','completed_by'
  ];
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
      AND role::text IN ('super_admin','admin','office_manager','regional_manager','regional_clinical_manager'))
     AND (to_jsonb(NEW) - lifecycle_fields) IS DISTINCT FROM (to_jsonb(OLD) - lifecycle_fields) THEN
    RAISE EXCEPTION 'Task field edits require a task manager role' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_task_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dashboard_task_field_guard BEFORE UPDATE
ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_task_fields();
COMMIT;
