-- Keep service-category goal reads within the existing office assignments.
-- QA only; no role grants, goal values or production policies are changed.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Service goal boundary requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
CREATE POLICY dashboard_service_goals_active_office_read_boundary
ON public.service_category_goals AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));
COMMIT;
