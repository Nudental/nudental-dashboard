-- Migration: Extended user profile fields + audit log change_summary + profile-photos storage bucket

-- 1. Add new columns to user_profiles
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS work_email TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS profile_photo_url TEXT DEFAULT '';

-- 2. Add change_summary to audit_logs
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS change_summary TEXT DEFAULT '';

-- 3. Create profile-photos storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    false,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS for profile-photos bucket
DROP POLICY IF EXISTS "super_admin_manage_profile_photos" ON storage.objects;
CREATE POLICY "super_admin_manage_profile_photos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'profile-photos' AND public.is_super_admin())
WITH CHECK (bucket_id = 'profile-photos' AND public.is_super_admin());

DROP POLICY IF EXISTS "authenticated_read_profile_photos" ON storage.objects;
CREATE POLICY "authenticated_read_profile_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');
