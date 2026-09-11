-- ============================================================
-- Bone and Tissue Inventory Module
-- ============================================================

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.bti_item_type CASCADE;
CREATE TYPE public.bti_item_type AS ENUM ('Bone', 'Tissue', 'Membrane', 'PRF', 'Other');

DROP TYPE IF EXISTS public.bti_item_status CASCADE;
CREATE TYPE public.bti_item_status AS ENUM ('In Stock', 'Used', 'Wasted', 'Returned');

-- 2. MAIN INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.bone_tissue_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    office_name TEXT NOT NULL DEFAULT '',
    provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL DEFAULT '',
    patient_name TEXT NOT NULL DEFAULT '',
    procedure_date DATE NOT NULL,
    bone_tissue_type public.bti_item_type NOT NULL DEFAULT 'Bone'::public.bti_item_type,
    product_name TEXT NOT NULL DEFAULT '',
    identification_number TEXT NOT NULL DEFAULT '',
    lot_number TEXT NOT NULL DEFAULT '',
    expiration_date DATE,
    quantity_used NUMERIC NOT NULL DEFAULT 1,
    staff_assistant_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    staff_assistant_name TEXT NOT NULL DEFAULT '',
    procedure_notes TEXT DEFAULT '',
    attachment_url TEXT DEFAULT '',
    item_status public.bti_item_status NOT NULL DEFAULT 'In Stock'::public.bti_item_status,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.bone_tissue_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES public.bone_tissue_inventory(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT '',
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB
);

-- 4. STORAGE BUCKET for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bone-tissue-attachments',
    'bone-tissue-attachments',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_bti_office_id ON public.bone_tissue_inventory(office_id);
CREATE INDEX IF NOT EXISTS idx_bti_provider_id ON public.bone_tissue_inventory(provider_id);
CREATE INDEX IF NOT EXISTS idx_bti_procedure_date ON public.bone_tissue_inventory(procedure_date);
CREATE INDEX IF NOT EXISTS idx_bti_item_status ON public.bone_tissue_inventory(item_status);
CREATE INDEX IF NOT EXISTS idx_bti_identification_number ON public.bone_tissue_inventory(identification_number);
CREATE INDEX IF NOT EXISTS idx_bti_expiration_date ON public.bone_tissue_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_btal_record_id ON public.bone_tissue_audit_log(record_id);

-- 6. HELPER FUNCTIONS (BEFORE RLS POLICIES)
CREATE OR REPLACE FUNCTION public.bti_get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.bti_user_office_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY(
    SELECT DISTINCT uoa.office_id
    FROM public.user_office_assignments uoa
    WHERE uoa.user_id = auth.uid()
    UNION
    SELECT up.office_id
    FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.office_id IS NOT NULL
  );
$$;

-- 7. ENABLE RLS
ALTER TABLE public.bone_tissue_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bone_tissue_audit_log ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES - bone_tissue_inventory
DROP POLICY IF EXISTS "bti_super_admin_all" ON public.bone_tissue_inventory;
CREATE POLICY "bti_super_admin_all"
ON public.bone_tissue_inventory
FOR ALL
TO authenticated
USING (public.bti_get_user_role() = 'super_admin')
WITH CHECK (public.bti_get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "bti_admin_office_access" ON public.bone_tissue_inventory;
CREATE POLICY "bti_admin_office_access"
ON public.bone_tissue_inventory
FOR ALL
TO authenticated
USING (
  public.bti_get_user_role() = 'admin'
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
)
WITH CHECK (
  public.bti_get_user_role() = 'admin'
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

DROP POLICY IF EXISTS "bti_staff_select" ON public.bone_tissue_inventory;
CREATE POLICY "bti_staff_select"
ON public.bone_tissue_inventory
FOR SELECT
TO authenticated
USING (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

DROP POLICY IF EXISTS "bti_staff_insert" ON public.bone_tissue_inventory;
CREATE POLICY "bti_staff_insert"
ON public.bone_tissue_inventory
FOR INSERT
TO authenticated
WITH CHECK (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

DROP POLICY IF EXISTS "bti_staff_update" ON public.bone_tissue_inventory;
CREATE POLICY "bti_staff_update"
ON public.bone_tissue_inventory
FOR UPDATE
TO authenticated
USING (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
)
WITH CHECK (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

-- 9. RLS POLICIES - bone_tissue_audit_log
DROP POLICY IF EXISTS "btal_super_admin_all" ON public.bone_tissue_audit_log;
CREATE POLICY "btal_super_admin_all"
ON public.bone_tissue_audit_log
FOR ALL
TO authenticated
USING (public.bti_get_user_role() = 'super_admin')
WITH CHECK (public.bti_get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "btal_others_select" ON public.bone_tissue_audit_log;
CREATE POLICY "btal_others_select"
ON public.bone_tissue_audit_log
FOR SELECT
TO authenticated
USING (public.bti_get_user_role() IN ('admin', 'staff', 'office_manager'));

DROP POLICY IF EXISTS "btal_others_insert" ON public.bone_tissue_audit_log;
CREATE POLICY "btal_others_insert"
ON public.bone_tissue_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.bti_get_user_role() IN ('admin', 'staff', 'office_manager'));

-- 10. STORAGE RLS POLICIES
DROP POLICY IF EXISTS "bti_attachments_upload" ON storage.objects;
CREATE POLICY "bti_attachments_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bone-tissue-attachments');

DROP POLICY IF EXISTS "bti_attachments_select" ON storage.objects;
CREATE POLICY "bti_attachments_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'bone-tissue-attachments');

DROP POLICY IF EXISTS "bti_attachments_delete" ON storage.objects;
CREATE POLICY "bti_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'bone-tissue-attachments' AND owner = auth.uid());

-- 11. AUDIT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.bti_audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_action TEXT;
  v_changed_by UUID;
  v_changed_by_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_changed_by := NEW.created_by;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_changed_by := NEW.updated_by;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_changed_by := OLD.created_by;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_changed_by_name
  FROM public.user_profiles
  WHERE id = v_changed_by
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (OLD.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (NEW.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), NULL, to_jsonb(NEW));
  ELSE
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (NEW.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), to_jsonb(OLD), to_jsonb(NEW));
  END IF;

  RETURN NEW;
END;
$func$;

-- 12. TRIGGERS
DROP TRIGGER IF EXISTS bti_audit_trigger ON public.bone_tissue_inventory;
CREATE TRIGGER bti_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bone_tissue_inventory
FOR EACH ROW EXECUTE FUNCTION public.bti_audit_trigger_fn();
