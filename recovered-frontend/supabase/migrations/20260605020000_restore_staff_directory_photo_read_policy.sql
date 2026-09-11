-- ============================================================
-- V735C: Restore Staff Directory Photo Read Policy
-- Replaces the restrictive staff_photos_self_select policy
-- (added in V735B) with an authenticated-read policy that
-- allows any authenticated dashboard user to view photos for
-- active staff_directory rows.
--
-- Problem: V735B's staff_photos_self_select only allowed a user
-- to read their own photo folder, breaking Resources → Directory
-- which needs to generate signed URLs for ALL active staff photos.
--
-- Fix: Replace with a broader SELECT policy scoped to active
-- staff_directory rows. Supports both path formats:
--   New: {staffDirectoryId}/{timestamp}.ext
--   Old: staff/{staffDirectoryId}/{timestamp}.ext
--
-- INSERT / UPDATE / DELETE policies from V735B are unchanged.
-- Bucket remains private. Signed URLs only. No public exposure.
-- ============================================================

-- Drop the restrictive self-only SELECT policy from V735B
DROP POLICY IF EXISTS "staff_photos_self_select" ON storage.objects;

-- Add authenticated read access for any active staff_directory photo.
-- Supports both path formats:
--   New format: {staff_directory.id}/{filename}
--     → (storage.foldername(name))[1] = staff_directory.id::text
--   Old format: staff/{staff_directory.id}/{filename}
--     → (storage.foldername(name))[1] = 'staff'
--     → (storage.foldername(name))[2] = staff_directory.id::text
CREATE POLICY "staff_photos_authenticated_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND (
      -- New path format: {staffDirectoryId}/filename.ext
      EXISTS (
        SELECT 1
        FROM public.staff_directory sd
        WHERE sd.id::text = (storage.foldername(name))[1]
          AND sd.is_active = TRUE
      )
      OR
      -- Old path format: staff/{staffDirectoryId}/filename.ext
      EXISTS (
        SELECT 1
        FROM public.staff_directory sd
        WHERE (storage.foldername(name))[1] = 'staff'
          AND sd.id::text = (storage.foldername(name))[2]
          AND sd.is_active = TRUE
      )
    )
  );
