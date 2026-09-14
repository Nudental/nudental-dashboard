-- QA-only candidate PH5-AUTH-004. Existing permissive policies remain preserved.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Office workflow candidate requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE OR REPLACE FUNCTION public.dashboard_has_active_profile()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id=auth.uid() AND is_active=true AND is_approved=true AND status='Active'
  );
$function$;

-- A restrictive boundary combines with, rather than competes with, the existing
-- permissive policies. Existing task assignee and role restrictions still apply.
CREATE POLICY dashboard_huddles_active_office_boundary
ON public.huddles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

CREATE POLICY dashboard_tasks_active_office_boundary
ON public.action_items AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

CREATE POLICY dashboard_checklist_active_office_boundary
ON public.huddle_checklist_items AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND EXISTS(
  SELECT 1 FROM public.huddles h
  WHERE h.id=huddle_checklist_items.huddle_id AND public.user_can_access_office(h.office_id)
))
WITH CHECK (public.dashboard_has_active_profile() AND EXISTS(
  SELECT 1 FROM public.huddles h
  WHERE h.id=huddle_checklist_items.huddle_id AND public.user_can_access_office(h.office_id)
));
COMMIT;
