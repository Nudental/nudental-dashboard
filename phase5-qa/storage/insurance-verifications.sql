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
  AND split_part(name,'/',1)='verifications'
  AND array_length(string_to_array(name,'/'),1)=3
  AND right(name,4)='.pdf'
  AND EXISTS (
    SELECT 1 FROM public.insurance_verifications v
    WHERE v.id::text=split_part(objects.name,'/',2) AND v.status='completed'
  )
);
COMMIT;
