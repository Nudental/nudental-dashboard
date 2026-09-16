-- Isolated QA only: preserve the source's authenticated photo reads,
-- self-service writes and Super Admin management, with the QA active gate.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Profile photo storage requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
DROP POLICY IF EXISTS dashboard_qa_profile_photo_owner ON storage.objects;
DROP POLICY IF EXISTS dashboard_qa_profile_photo_read ON storage.objects;
DROP POLICY IF EXISTS dashboard_qa_profile_photo_manage ON storage.objects;
CREATE POLICY dashboard_qa_profile_photo_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='profile-photos' AND public.dashboard_has_active_profile()
);
CREATE POLICY dashboard_qa_profile_photo_manage ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id='profile-photos' AND public.dashboard_has_active_profile()
  AND (public.is_super_admin() OR split_part(name,'/',1)=auth.uid()::text)
)
WITH CHECK (
  bucket_id='profile-photos' AND public.dashboard_has_active_profile()
  AND (public.is_super_admin() OR split_part(name,'/',1)=auth.uid()::text)
);
COMMIT;
