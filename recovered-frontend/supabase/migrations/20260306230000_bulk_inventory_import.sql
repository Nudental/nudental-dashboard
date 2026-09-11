-- Bulk Inventory Import Tables
-- inventory_import_batches, inventory_import_rows, inventory_movements
-- Also adds batch_id FK columns to existing inventory tables

-- ── Types ─────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.import_type_enum CASCADE;
CREATE TYPE public.import_type_enum AS ENUM ('bone_tissue', 'implant');

DROP TYPE IF EXISTS public.import_source_enum CASCADE;
CREATE TYPE public.import_source_enum AS ENUM ('csv', 'excel', 'manual_grid', 'paste');

DROP TYPE IF EXISTS public.import_batch_status_enum CASCADE;
CREATE TYPE public.import_batch_status_enum AS ENUM ('pending', 'completed', 'partial', 'failed');

DROP TYPE IF EXISTS public.import_row_status_enum CASCADE;
CREATE TYPE public.import_row_status_enum AS ENUM ('valid', 'warning', 'error', 'skipped');

DROP TYPE IF EXISTS public.inventory_movement_type_enum CASCADE;
CREATE TYPE public.inventory_movement_type_enum AS ENUM ('imported', 'adjusted', 'used', 'returned', 'wasted', 'deleted');

-- ── inventory_import_batches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type public.import_type_enum NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT NOT NULL DEFAULT '',
  imported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  imported_by_name TEXT NOT NULL DEFAULT '',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source public.import_source_enum NOT NULL DEFAULT 'csv',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  warning_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  batch_status public.import_batch_status_enum NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── inventory_import_rows ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.inventory_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}',
  parsed_data JSONB NOT NULL DEFAULT '{}',
  validation_status public.import_row_status_enum NOT NULL DEFAULT 'valid',
  validation_messages JSONB NOT NULL DEFAULT '[]',
  record_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── inventory_movements ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  record_type public.import_type_enum NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT NOT NULL DEFAULT '',
  movement_type public.inventory_movement_type_enum NOT NULL DEFAULT 'imported',
  quantity_change INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT NOT NULL DEFAULT '',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID REFERENCES public.inventory_import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Add batch_id to existing inventory tables ─────────────────────────────
ALTER TABLE public.bone_tissue_inventory
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.inventory_import_batches(id) ON DELETE SET NULL;

ALTER TABLE public.implant_inventory
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.inventory_import_batches(id) ON DELETE SET NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_import_batches_office_id ON public.inventory_import_batches(office_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_imported_by ON public.inventory_import_batches(imported_by);
CREATE INDEX IF NOT EXISTS idx_import_batches_import_type ON public.inventory_import_batches(import_type);
CREATE INDEX IF NOT EXISTS idx_import_batches_imported_at ON public.inventory_import_batches(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch_id ON public.inventory_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_validation_status ON public.inventory_import_rows(validation_status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_record_id ON public.inventory_movements(record_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_office_id ON public.inventory_movements(office_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch_id ON public.inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_bt_inventory_import_batch_id ON public.bone_tissue_inventory(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_import_batch_id ON public.implant_inventory(import_batch_id);

-- ── Helper functions ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role_for_import()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(role::TEXT, 'staff')
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_can_import_to_office(p_office_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role = 'super_admin'
      OR up.office_id = p_office_id
      OR EXISTS (
        SELECT 1 FROM public.user_office_assignments uoa
        WHERE uoa.user_id = auth.uid()
        AND (uoa.office_id = p_office_id OR uoa.all_offices = true)
      )
    )
  );
$$;

-- ── Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: inventory_import_batches ────────────────────────────────
DROP POLICY IF EXISTS "import_batches_select" ON public.inventory_import_batches;
CREATE POLICY "import_batches_select"
  ON public.inventory_import_batches FOR SELECT
  TO authenticated
  USING (
    public.get_user_role_for_import() = 'super_admin'
    OR public.user_can_import_to_office(office_id)
  );

DROP POLICY IF EXISTS "import_batches_insert" ON public.inventory_import_batches;
CREATE POLICY "import_batches_insert"
  ON public.inventory_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role_for_import() = 'super_admin'
    OR public.user_can_import_to_office(office_id)
  );

DROP POLICY IF EXISTS "import_batches_update" ON public.inventory_import_batches;
CREATE POLICY "import_batches_update"
  ON public.inventory_import_batches FOR UPDATE
  TO authenticated
  USING (imported_by = auth.uid() OR public.get_user_role_for_import() IN ('super_admin', 'admin'))
  WITH CHECK (imported_by = auth.uid() OR public.get_user_role_for_import() IN ('super_admin', 'admin'));

-- ── RLS Policies: inventory_import_rows ──────────────────────────────────
DROP POLICY IF EXISTS "import_rows_select" ON public.inventory_import_rows;
CREATE POLICY "import_rows_select"
  ON public.inventory_import_rows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_import_batches b
      WHERE b.id = batch_id
      AND (
        public.get_user_role_for_import() = 'super_admin'
        OR public.user_can_import_to_office(b.office_id)
      )
    )
  );

DROP POLICY IF EXISTS "import_rows_insert" ON public.inventory_import_rows;
CREATE POLICY "import_rows_insert"
  ON public.inventory_import_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_import_batches b
      WHERE b.id = batch_id
      AND (
        public.get_user_role_for_import() = 'super_admin'
        OR public.user_can_import_to_office(b.office_id)
      )
    )
  );

-- ── RLS Policies: inventory_movements ────────────────────────────────────
DROP POLICY IF EXISTS "inventory_movements_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select"
  ON public.inventory_movements FOR SELECT
  TO authenticated
  USING (
    public.get_user_role_for_import() = 'super_admin'
    OR public.user_can_import_to_office(office_id)
  );

DROP POLICY IF EXISTS "inventory_movements_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_insert"
  ON public.inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role_for_import() = 'super_admin'
    OR public.user_can_import_to_office(office_id)
  );
