-- Migration: V733C — Profile Photos self-upload RLS policy
-- Allows authenticated users to INSERT/UPDATE/DELETE only their own objects
-- in the profile-photos bucket (path must start with their own auth.uid()).
-- Super admin policy and authenticated read policy remain unchanged.

-- Self-upload: authenticated users can INSERT their own folder only
DROP POLICY IF EXISTS "authenticated_self_upload_profile_photos" ON storage.objects;
CREATE POLICY "authenticated_self_upload_profile_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Self-update: authenticated users can UPDATE their own folder only
DROP POLICY IF EXISTS "authenticated_self_update_profile_photos" ON storage.objects;
CREATE POLICY "authenticated_self_update_profile_photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Self-delete: authenticated users can DELETE their own folder only
DROP POLICY IF EXISTS "authenticated_self_delete_profile_photos" ON storage.objects;
CREATE POLICY "authenticated_self_delete_profile_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
