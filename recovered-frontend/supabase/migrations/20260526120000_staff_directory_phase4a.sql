-- ============================================================
-- Phase 4A: Staff Directory — Add/Edit + Photo Upload
-- Adds photo fields to staff_directory, creates audit log table,
-- creates private storage bucket staff-directory-photos.
-- Does NOT modify providers, provider_master, user_profiles,
-- payroll tables, Gusto tables, or offices.
-- ============================================================

-- 1. Add photo columns to staff_directory (idempotent)
ALTER TABLE public.staff_directory
  ADD COLUMN IF NOT EXISTS photo_storage_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_uploaded_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create staff_directory_audit_logs table
CREATE TABLE IF NOT EXISTS public.staff_directory_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL,
  action          TEXT NOT NULL,
  changed_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_fields  JSONB DEFAULT NULL,
  notes           TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_dir_audit_staff_id
  ON public.staff_directory_audit_logs(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_dir_audit_changed_at
  ON public.staff_directory_audit_logs(changed_at DESC);

ALTER TABLE public.staff_directory_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit log RLS: managers/admins can read; service role writes
DROP POLICY IF EXISTS "staff_dir_audit_read" ON public.staff_directory_audit_logs;
CREATE POLICY "staff_dir_audit_read"
  ON public.staff_directory_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );

DROP POLICY IF EXISTS "staff_dir_audit_insert" ON public.staff_directory_audit_logs;
CREATE POLICY "staff_dir_audit_insert"
  ON public.staff_directory_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );

-- 3. Storage bucket: staff-directory-photos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-directory-photos',
  'staff-directory-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated managers can upload/read; owners can delete
DROP POLICY IF EXISTS "staff_photos_select" ON storage.objects;
CREATE POLICY "staff_photos_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );

DROP POLICY IF EXISTS "staff_photos_insert" ON storage.objects;
CREATE POLICY "staff_photos_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );

DROP POLICY IF EXISTS "staff_photos_update" ON storage.objects;
CREATE POLICY "staff_photos_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  )
  WITH CHECK (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );

DROP POLICY IF EXISTS "staff_photos_delete" ON storage.objects;
CREATE POLICY "staff_photos_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-directory-photos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
    )
  );
