-- PH5-AUTH-015: the existing Bone/Tissue role helper must reject inactive or
-- unapproved identities for stock and other tables using that same helper.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Bone role repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
CREATE OR REPLACE FUNCTION public.bti_get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT role::text FROM public.user_profiles
  WHERE id=auth.uid() AND public.dashboard_has_active_profile()
  LIMIT 1;
$function$;
COMMIT;
