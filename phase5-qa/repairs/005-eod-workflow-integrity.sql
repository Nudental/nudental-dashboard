-- PH5-AUTH-006: enforce the existing EOD approval roles below the UI.
-- Isolated Dashboard QA only; existing policies and production are untouched.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'EOD workflow integrity requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.dashboard_guard_eod_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  can_approve boolean;
  approval_fields text[] := ARRAY[
    'approved_by','approved_at','approver_name','approval_note',
    'rejection_reason','rejected_by','rejected_at','rejection_by_name',
    'previous_status','status_changed_by','status_changed_at','status_changed_by_name',
    'edited_by','edited_at','edited_by_name','edit_reason',
    'reapproval_note','reapproved_by','reapproved_at','reapproved_by_name'
  ];
BEGIN
  -- Preserve the existing trusted import/fixture path. Browser/API requests use
  -- the authenticated role and must satisfy the account and office boundaries.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF NOT public.dashboard_has_active_profile()
     OR NOT COALESCE(public.user_can_access_office(NEW.office_id), false) THEN
    RAISE EXCEPTION 'EOD account or office access denied' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NOT COALESCE(public.user_can_access_office(OLD.office_id), false) THEN
    RAISE EXCEPTION 'EOD account or office access denied' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
    AND role::text IN ('super_admin','admin','regional_manager','regional_clinical_manager'))
    INTO can_approve;
  IF NOT can_approve THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.status, 'pending') NOT IN ('draft','pending','pending_review')
         OR EXISTS(SELECT 1 FROM unnest(approval_fields) AS f(name)
                   WHERE COALESCE(to_jsonb(NEW)->>f.name, '') <> '') THEN
        RAISE EXCEPTION 'EOD approval fields require an approval role' USING ERRCODE='42501';
      END IF;
    ELSE
      IF NEW.status IS DISTINCT FROM OLD.status
         OR OLD.status IN ('approved','pending_reapproval','rejected_after_approval')
         OR EXISTS(SELECT 1 FROM unnest(approval_fields) AS f(name)
                   WHERE to_jsonb(NEW)->f.name IS DISTINCT FROM to_jsonb(OLD)->f.name) THEN
        RAISE EXCEPTION 'EOD approval fields require an approval role' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_eod_workflow() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dashboard_eod_workflow_guard BEFORE INSERT OR UPDATE
ON public.daily_entries FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_eod_workflow();
COMMIT;
