-- PH5-AUTH-005: prevent permissive INSERT rules from bypassing EOD identity/scope.
-- Isolated Dashboard QA only. Reuses the reviewed 002 active-profile helper.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'EOD insert boundary requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_eod_insert_boundary
ON public.daily_entries AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.dashboard_has_active_profile()
  AND submitted_by = auth.uid()
  AND public.user_can_access_office(office_id)
);
COMMIT;
