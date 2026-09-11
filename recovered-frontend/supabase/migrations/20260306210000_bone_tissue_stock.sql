-- ============================================================
-- Bone & Tissue Stock Management
-- ============================================================

-- 1. Add stock_count and restock_history to existing inventory table
ALTER TABLE public.bone_tissue_inventory
ADD COLUMN IF NOT EXISTS stock_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS restock_history JSONB DEFAULT '[]'::JSONB;

-- 2. Create bone_tissue_stock table for per-product stock tracking
CREATE TABLE IF NOT EXISTS public.bone_tissue_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL DEFAULT '',
    identification_number TEXT NOT NULL DEFAULT '',
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    office_name TEXT NOT NULL DEFAULT '',
    current_stock INTEGER NOT NULL DEFAULT 0,
    restock_threshold INTEGER NOT NULL DEFAULT 2,
    last_restocked_at TIMESTAMPTZ,
    last_restocked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    last_restocked_by_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_bts_office_id ON public.bone_tissue_stock(office_id);
CREATE INDEX IF NOT EXISTS idx_bts_identification_number ON public.bone_tissue_stock(identification_number);
CREATE INDEX IF NOT EXISTS idx_bts_current_stock ON public.bone_tissue_stock(current_stock);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bts_product_office ON public.bone_tissue_stock(identification_number, office_id);

-- 4. Enable RLS
ALTER TABLE public.bone_tissue_stock ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for bone_tissue_stock
DROP POLICY IF EXISTS "bts_super_admin_all" ON public.bone_tissue_stock;
CREATE POLICY "bts_super_admin_all"
ON public.bone_tissue_stock
FOR ALL
TO authenticated
USING (public.bti_get_user_role() = 'super_admin')
WITH CHECK (public.bti_get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "bts_admin_all" ON public.bone_tissue_stock;
CREATE POLICY "bts_admin_all"
ON public.bone_tissue_stock
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

DROP POLICY IF EXISTS "bts_staff_select" ON public.bone_tissue_stock;
CREATE POLICY "bts_staff_select"
ON public.bone_tissue_stock
FOR SELECT
TO authenticated
USING (
  public.bti_get_user_role() IN ('staff', 'office_manager')
  AND (office_id = ANY(public.bti_user_office_ids()) OR office_id IS NULL)
);

-- 6. Trigger: auto-deduct stock when item_status set to 'Used'
CREATE OR REPLACE FUNCTION public.bti_auto_deduct_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Only deduct when status changes TO 'Used'
  IF (TG_OP = 'INSERT' AND NEW.item_status = 'Used') OR
     (TG_OP = 'UPDATE' AND NEW.item_status = 'Used' AND (OLD.item_status IS DISTINCT FROM 'Used')) THEN

    IF NEW.identification_number IS NOT NULL AND NEW.identification_number != '' THEN
      -- Get current stock
      SELECT current_stock INTO v_current_stock
      FROM public.bone_tissue_stock
      WHERE identification_number = NEW.identification_number
        AND (office_id = NEW.office_id OR (office_id IS NULL AND NEW.office_id IS NULL))
      LIMIT 1;

      IF v_current_stock IS NOT NULL AND v_current_stock > 0 THEN
        UPDATE public.bone_tissue_stock
        SET current_stock = GREATEST(0, current_stock - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE identification_number = NEW.identification_number
          AND (office_id = NEW.office_id OR (office_id IS NULL AND NEW.office_id IS NULL));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS bti_stock_deduct_trigger ON public.bone_tissue_inventory;
CREATE TRIGGER bti_stock_deduct_trigger
AFTER INSERT OR UPDATE ON public.bone_tissue_inventory
FOR EACH ROW EXECUTE FUNCTION public.bti_auto_deduct_stock();
