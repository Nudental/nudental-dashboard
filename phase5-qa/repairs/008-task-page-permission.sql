-- PH5-AUTH-008: enforce the existing task-page permission on direct table access.
-- QA only. Existing role grants and office/assignee restrictions are unchanged.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Task permission candidate requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_tasks_page_permission
ON public.action_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
  (p.role='super_admin' OR EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role=p.role::text AND rp.permission='workflow.tasks.view' AND rp.enabled=true
  ))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
  (p.role='super_admin' OR EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role=p.role::text AND rp.permission='workflow.tasks.view' AND rp.enabled=true
  ))
));
COMMIT;
