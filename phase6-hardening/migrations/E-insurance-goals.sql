-- Phase 6 schema-only candidate, subject to QA and per-group release.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Reviewed source repair 019-office-goal-read-boundary.sql
DROP POLICY IF EXISTS dashboard_office_goals_active_office_read_boundary ON public.office_goals;
CREATE POLICY dashboard_office_goals_active_office_read_boundary
ON public.office_goals AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

-- Reviewed source repair 020-insurance-access-boundary.sql
DROP POLICY IF EXISTS dashboard_insurance_request_access_boundary ON public.insurance_verification_requests;
CREATE POLICY dashboard_insurance_request_access_boundary
ON public.insurance_verification_requests AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile() AND public.user_can_access_office(office_id)
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='workflow.insurance.view' AND rp.enabled=true
    ))
  )
);

-- A policy's USING expression is also its WITH CHECK when the latter is omitted.
-- Child-table access must follow the request's RLS rather than trust a caller's ID.
DROP POLICY IF EXISTS dashboard_insurance_verification_access_boundary ON public.insurance_verifications;
CREATE POLICY dashboard_insurance_verification_access_boundary
ON public.insurance_verifications AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insurance_verification_requests r
  WHERE r.id=insurance_verifications.request_id
));

DROP POLICY IF EXISTS dashboard_insurance_audit_access_boundary ON public.insurance_verification_audit_log;
CREATE POLICY dashboard_insurance_audit_access_boundary
ON public.insurance_verification_audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insurance_verification_requests r
  WHERE r.id=insurance_verification_audit_log.request_id
));

-- Reviewed source repair 041-insurance-completed-form-lock.sql
-- Enforce the existing completed-form lock below the browser/service layer.
CREATE OR REPLACE FUNCTION public.dashboard_guard_completed_insurance_form()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog
AS $fn$
DECLARE
  tracking_columns text[]:=ARRAY[
    'updated_at','pdf_storage_path','pdf_generated_at','pdf_checksum_sha256',
    'office_emailed_at','office_email_to','chart_upload_method','chart_upload_status',
    'dentrix_document_upload_status','dentrix_document_id','dentrix_patient_id',
    'dentrix_document_uploaded_at','dentrix_document_uploaded_by','dentrix_document_upload_error',
    'dentrix_document_filename','dentrix_document_mime_type','dentrix_document_size_bytes',
    'manual_chart_uploaded_at','manual_chart_uploaded_by','manual_chart_upload_note',
    'chart_uploaded_at','chart_uploaded_by_user_id','chart_upload_error'
  ];
BEGIN
  IF OLD.status='completed'
     AND (to_jsonb(NEW)-tracking_columns) IS DISTINCT FROM (to_jsonb(OLD)-tracking_columns) THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='This verification is completed and locked. Form contents cannot be changed.';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_guard_completed_insurance_form() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_completed_insurance_form_lock ON public.insurance_verifications;
CREATE TRIGGER trg_dashboard_completed_insurance_form_lock
BEFORE UPDATE ON public.insurance_verifications
FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_completed_insurance_form();

-- Reviewed source repair 042-service-goal-read-boundary.sql
-- Keep service-category goal reads within the existing office assignments.
DROP POLICY IF EXISTS dashboard_service_goals_active_office_read_boundary ON public.service_category_goals;
CREATE POLICY dashboard_service_goals_active_office_read_boundary
ON public.service_category_goals AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

COMMIT;
