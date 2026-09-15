-- PH5-AUTH-007: protect the existing EOD history writer identity and office scope.
-- Isolated Dashboard QA only; retain existing policies, history and trusted writers.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'EOD history identity guard requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_eod_history_identity_guard
ON public.eod_status_history AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.dashboard_has_active_profile()
  AND changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role::text IN ('super_admin','admin','regional_manager','regional_clinical_manager')
      AND eod_status_history.changer_role = actor.role::text
      AND eod_status_history.changer_name = COALESCE(NULLIF(actor.full_name, ''), NULLIF(actor.email, ''), 'Unknown')
  )
  AND EXISTS (
    SELECT 1 FROM public.daily_entries entry
    WHERE entry.id = eod_status_history.entry_id
      AND public.user_can_access_office(entry.office_id)
  )
);
COMMIT;
