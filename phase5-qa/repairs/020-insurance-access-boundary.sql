-- PH5-AUTH-013: enforce the existing insurance page and office scope on API access.
-- QA only. No role grants, external execution, or existing records are changed.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Insurance access boundary requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

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
CREATE POLICY dashboard_insurance_verification_access_boundary
ON public.insurance_verifications AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insurance_verification_requests r
  WHERE r.id=insurance_verifications.request_id
));

CREATE POLICY dashboard_insurance_audit_access_boundary
ON public.insurance_verification_audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.insurance_verification_requests r
  WHERE r.id=insurance_verification_audit_log.request_id
));
COMMIT;
