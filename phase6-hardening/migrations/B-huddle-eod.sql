-- Phase 6 schema-only candidate, subject to QA and per-group release.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Reviewed source repair 002-office-workflow-boundary.sql
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
DROP POLICY IF EXISTS dashboard_huddles_active_office_boundary ON public.huddles;
CREATE POLICY dashboard_huddles_active_office_boundary
ON public.huddles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

DROP POLICY IF EXISTS dashboard_checklist_active_office_boundary ON public.huddle_checklist_items;
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

-- Reviewed source repair 003-eod-audit-coverage.sql
DROP TRIGGER IF EXISTS trg_audit_daily_entries ON public.daily_entries;
CREATE TRIGGER trg_audit_daily_entries
AFTER INSERT OR DELETE OR UPDATE ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 004-eod-insert-boundary.sql
DROP POLICY IF EXISTS dashboard_eod_insert_boundary ON public.daily_entries;
CREATE POLICY dashboard_eod_insert_boundary
ON public.daily_entries AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.dashboard_has_active_profile()
  AND submitted_by = auth.uid()
  AND public.user_can_access_office(office_id)
);

-- Reviewed source repair 005-eod-workflow-integrity.sql
CREATE OR REPLACE FUNCTION public.dashboard_guard_eod_workflow()
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
DROP TRIGGER IF EXISTS trg_dashboard_eod_workflow_guard ON public.daily_entries;
CREATE TRIGGER trg_dashboard_eod_workflow_guard BEFORE INSERT OR UPDATE
ON public.daily_entries FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_eod_workflow();

-- Reviewed source repair 006-eod-history-identity.sql
DROP POLICY IF EXISTS dashboard_eod_history_identity_guard ON public.eod_status_history;
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

-- Reviewed source repair 007-huddle-child-audit-coverage.sql
DROP TRIGGER IF EXISTS trg_audit_huddle_provider_blocks ON public.huddle_provider_blocks;
CREATE TRIGGER trg_audit_huddle_provider_blocks
AFTER INSERT OR DELETE OR UPDATE ON public.huddle_provider_blocks
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_huddle_checklist_items ON public.huddle_checklist_items;
CREATE TRIGGER trg_audit_huddle_checklist_items
AFTER INSERT OR DELETE OR UPDATE ON public.huddle_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 011-huddle-review-permission.sql
CREATE OR REPLACE FUNCTION public.dashboard_guard_huddle_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  can_review boolean;
  review_fields text[] := ARRAY['approved_by', 'approved_at', 'rejection_reason'];
BEGIN
  -- Keep the trusted fixture/import path. Existing restrictive policies still
  -- enforce active accounts and both old/new office scope for authenticated users.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
    AND role::text IN ('super_admin','admin','regional_manager','regional_clinical_manager'))
    INTO can_review;
  IF NOT can_review THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IN ('approved','rejected')
         OR EXISTS(SELECT 1 FROM unnest(review_fields) AS f(name)
                   WHERE COALESCE(to_jsonb(NEW)->>f.name, '') <> '') THEN
        RAISE EXCEPTION 'Huddle review requires a reviewer role' USING ERRCODE='42501';
      END IF;
    ELSE
      IF (NEW.status IS DISTINCT FROM OLD.status AND
          (NEW.status IN ('approved','rejected') OR OLD.status IN ('approved','rejected')))
         OR EXISTS(SELECT 1 FROM unnest(review_fields) AS f(name)
                   WHERE to_jsonb(NEW)->f.name IS DISTINCT FROM to_jsonb(OLD)->f.name) THEN
        RAISE EXCEPTION 'Huddle review requires a reviewer role' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_huddle_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_huddle_review_guard ON public.huddles;
CREATE TRIGGER trg_dashboard_huddle_review_guard BEFORE INSERT OR UPDATE
ON public.huddles FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_huddle_review();

COMMIT;
