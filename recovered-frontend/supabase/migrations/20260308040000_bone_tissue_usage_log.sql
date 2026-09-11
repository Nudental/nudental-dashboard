-- ============================================================
-- Bone & Tissue Usage Log
-- Tracks every scan-to-consume event for lot traceability
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bone_tissue_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    office_name TEXT NOT NULL DEFAULT '',
    provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL DEFAULT '',
    staff_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL DEFAULT '',
    patient_name TEXT NOT NULL DEFAULT '',
    patient_chart_number TEXT NOT NULL DEFAULT '',
    procedure_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bone_tissue_type TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    identification_number TEXT NOT NULL DEFAULT '',
    lot_number TEXT NOT NULL DEFAULT '',
    expiration_date DATE,
    quantity_used INTEGER NOT NULL DEFAULT 1,
    scan_method TEXT NOT NULL DEFAULT 'manual',
    notes TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_btul_office_id ON public.bone_tissue_usage_log(office_id);
CREATE INDEX IF NOT EXISTS idx_btul_procedure_date ON public.bone_tissue_usage_log(procedure_date);
CREATE INDEX IF NOT EXISTS idx_btul_lot_number ON public.bone_tissue_usage_log(lot_number);
CREATE INDEX IF NOT EXISTS idx_btul_identification_number ON public.bone_tissue_usage_log(identification_number);
CREATE INDEX IF NOT EXISTS idx_btul_created_at ON public.bone_tissue_usage_log(created_at);

-- Enable RLS
ALTER TABLE public.bone_tissue_usage_log ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
DROP POLICY IF EXISTS "btul_super_admin_all" ON public.bone_tissue_usage_log;
CREATE POLICY "btul_super_admin_all"
ON public.bone_tissue_usage_log
FOR ALL
TO authenticated
USING (public.bti_get_user_role() = 'super_admin')
WITH CHECK (public.bti_get_user_role() = 'super_admin');

-- Admin: scoped to their offices
DROP POLICY IF EXISTS "btul_admin_all" ON public.bone_tissue_usage_log;
CREATE POLICY "btul_admin_all"
ON public.bone_tissue_usage_log
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

-- Staff / office_manager: select + insert for their offices
DROP POLICY IF EXISTS "btul_staff_select" ON public.bone_tissue_usage_log;
CREATE POLICY "btul_staff_select"
ON public.bone_tissue_usage_log
FOR SELECT
TO authenticated
USING (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

DROP POLICY IF EXISTS "btul_staff_insert" ON public.bone_tissue_usage_log;
CREATE POLICY "btul_staff_insert"
ON public.bone_tissue_usage_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

-- Also add lot_number column to bone_tissue_stock if missing
ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS lot_number TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bts_lot_number ON public.bone_tissue_stock(lot_number);
