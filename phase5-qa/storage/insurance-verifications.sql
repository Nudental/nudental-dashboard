-- PH5-QA-STORAGE-002: private PDF persistence for completed synthetic QA verifications.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Insurance PDF storage requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

-- The parent verification and request apply existing active-profile/page/office RLS.
-- The existing UI regenerates PDFs using upsert, so SELECT/INSERT/UPDATE are needed.
CREATE POLICY dashboard_qa_insurance_pdf_access ON storage.objects
FOR ALL TO authenticated USING (
  bucket_id='insurance-verifications'
  AND public.dashboard_has_active_profile()
  AND split_part(name,'/',1)='verifications'
  AND array_length(string_to_array(name,'/'),1)=3
  AND right(name,4)='.pdf'
  AND EXISTS (
    SELECT 1 FROM public.insurance_verifications v
    JOIN public.insurance_verification_requests r ON r.id=v.request_id
    WHERE v.id::text=split_part(objects.name,'/',2) AND v.status='completed'
    AND public.user_can_access_office(r.office_id)
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
      (p.role='super_admin' OR EXISTS (
        SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
        AND rp.permission='workflow.insurance.view' AND rp.enabled=true
      ))
    )
  )
);
COMMIT;
