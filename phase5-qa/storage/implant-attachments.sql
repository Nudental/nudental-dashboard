-- QA-only private storage rules; existing inventory roles/office scope apply.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Implant storage requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE POLICY dashboard_qa_implant_files_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='implant-attachments' AND public.dashboard_has_active_profile()
  AND public.is_implant_admin_or_above()
  AND split_part(name,'/',1)=auth.uid()::text
);
CREATE POLICY dashboard_qa_implant_files_select ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id='implant-attachments' AND public.dashboard_has_active_profile()
  AND ((public.is_implant_admin_or_above() AND split_part(name,'/',1)=auth.uid()::text)
    OR EXISTS(SELECT 1 FROM public.implant_inventory i
      WHERE i.attachment_url=objects.name AND public.user_can_access_office(i.office_id)))
);
CREATE POLICY dashboard_qa_implant_files_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id='implant-attachments' AND public.dashboard_has_active_profile()
  AND public.is_implant_admin_or_above()
  AND split_part(name,'/',1)=auth.uid()::text
);
COMMIT;
