-- ============================================================
-- V735B: Staff Directory Self Photo Upload
-- Adds a narrow SECURITY DEFINER RPC that allows an authenticated
-- user to update ONLY photo_storage_path and photo_uploaded_at
-- on their own matched staff_directory row (matched by email).
-- Also adds storage RLS policies so staff can upload to
-- staff-directory-photos bucket scoped to their own directory ID.
-- Does NOT grant broad writes. Does NOT touch other fields.
-- Does NOT modify auth/roles/user_profiles/phone verification.
-- ============================================================

-- ============================================================
-- 1. RPC: update_own_staff_directory_photo
--    SECURITY DEFINER — runs as the function owner (postgres/service role)
--    so it can bypass staff_directory_write_admin RLS.
--    Validates that the calling user's email matches the target row.
--    Only updates photo_storage_path and photo_uploaded_at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_own_staff_directory_photo(
  p_staff_directory_id UUID,
  p_photo_storage_path TEXT,
  p_photo_uploaded_at  TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_matched    BOOLEAN := FALSE;
  v_result     JSONB;
BEGIN
  -- Get the authenticated user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the target staff_directory row belongs to this user (email match)
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_directory
    WHERE id = p_staff_directory_id
      AND is_active = TRUE
      AND (
        preferred_email = v_user_email
        OR work_email    = v_user_email
        OR personal_email = v_user_email
      )
  ) INTO v_matched;

  IF NOT v_matched THEN
    RAISE EXCEPTION 'You can only update your own Staff Directory photo';
  END IF;

  -- Update only the photo fields — no other fields touched
  UPDATE public.staff_directory
  SET
    photo_storage_path = p_photo_storage_path,
    photo_uploaded_at  = p_photo_uploaded_at,
    updated_at         = now()
  WHERE id = p_staff_directory_id;

  -- Return the updated row's photo fields for confirmation
  SELECT jsonb_build_object(
    'id',                 id,
    'photo_storage_path', photo_storage_path,
    'photo_uploaded_at',  photo_uploaded_at
  ) INTO v_result
  FROM public.staff_directory
  WHERE id = p_staff_directory_id;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.update_own_staff_directory_photo(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_staff_directory_photo(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- 2. Storage RLS: allow staff to upload their own photo
--    Path must be scoped to their staff_directory.id:
--    {staff_directory_id}/{timestamp}.ext
--    The first path segment must match a staff_directory row
--    whose email matches the authenticated user.
-- ============================================================

-- SELECT: allow authenticated users to read their own directory photo
-- (existing staff_photos_select only allows managers — add self-read)
DROP POLICY IF EXISTS "staff_photos_self_select" ON storage.objects;
CREATE POLICY "staff_photos_self_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1
      FROM public.staff_directory sd
      JOIN auth.users au ON au.id = auth.uid()
      WHERE sd.id::text = (storage.foldername(name))[1]
        AND sd.is_active = TRUE
        AND (
          sd.preferred_email  = au.email
          OR sd.work_email    = au.email
          OR sd.personal_email = au.email
        )
    )
  );

-- INSERT: allow staff to upload to their own directory folder
DROP POLICY IF EXISTS "staff_photos_self_insert" ON storage.objects;
CREATE POLICY "staff_photos_self_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1
      FROM public.staff_directory sd
      JOIN auth.users au ON au.id = auth.uid()
      WHERE sd.id::text = (storage.foldername(name))[1]
        AND sd.is_active = TRUE
        AND (
          sd.preferred_email  = au.email
          OR sd.work_email    = au.email
          OR sd.personal_email = au.email
        )
    )
  );

-- UPDATE: allow staff to update their own directory photo object
DROP POLICY IF EXISTS "staff_photos_self_update" ON storage.objects;
CREATE POLICY "staff_photos_self_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1
      FROM public.staff_directory sd
      JOIN auth.users au ON au.id = auth.uid()
      WHERE sd.id::text = (storage.foldername(name))[1]
        AND sd.is_active = TRUE
        AND (
          sd.preferred_email  = au.email
          OR sd.work_email    = au.email
          OR sd.personal_email = au.email
        )
    )
  )
  WITH CHECK (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1
      FROM public.staff_directory sd
      JOIN auth.users au ON au.id = auth.uid()
      WHERE sd.id::text = (storage.foldername(name))[1]
        AND sd.is_active = TRUE
        AND (
          sd.preferred_email  = au.email
          OR sd.work_email    = au.email
          OR sd.personal_email = au.email
        )
    )
  );

-- DELETE: allow staff to delete their own directory photo object
DROP POLICY IF EXISTS "staff_photos_self_delete" ON storage.objects;
CREATE POLICY "staff_photos_self_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1
      FROM public.staff_directory sd
      JOIN auth.users au ON au.id = auth.uid()
      WHERE sd.id::text = (storage.foldername(name))[1]
        AND sd.is_active = TRUE
        AND (
          sd.preferred_email  = au.email
          OR sd.work_email    = au.email
          OR sd.personal_email = au.email
        )
    )
  );
