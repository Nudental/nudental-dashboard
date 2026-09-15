-- PH5-AUTH-012: constrain broad legacy goal reads to the existing office boundary.
-- QA only; existing roles, writes, and goal values remain unchanged.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Goal read boundary requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_office_goals_active_office_read_boundary
ON public.office_goals AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));
COMMIT;
