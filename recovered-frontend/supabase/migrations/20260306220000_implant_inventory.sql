-- ============================================================
-- Implant Inventory Management Module
-- ============================================================

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.implant_inventory_status CASCADE;
CREATE TYPE public.implant_inventory_status AS ENUM ('in_stock', 'used', 'returned', 'wasted', 'expired');

DROP TYPE IF EXISTS public.implant_audit_action CASCADE;
CREATE TYPE public.implant_audit_action AS ENUM ('created', 'updated', 'deleted', 'restocked', 'used', 'adjusted');

DROP TYPE IF EXISTS public.implant_record_type CASCADE;
CREATE TYPE public.implant_record_type AS ENUM ('inventory', 'usage');

-- 2. MASTER DATA TABLES
CREATE TABLE IF NOT EXISTS public.implant_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.implant_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.implant_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.implant_platform_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.implant_lengths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_mm NUMERIC(6,2),
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.implant_diameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value_mm NUMERIC(6,2),
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MAIN INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.implant_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT,
  company_id UUID REFERENCES public.implant_companies(id) ON DELETE SET NULL,
  company_name TEXT,
  system_id UUID REFERENCES public.implant_systems(id) ON DELETE SET NULL,
  system_name TEXT,
  platform_size_id UUID REFERENCES public.implant_platform_sizes(id) ON DELETE SET NULL,
  platform_size_name TEXT,
  length_id UUID REFERENCES public.implant_lengths(id) ON DELETE SET NULL,
  length_label TEXT,
  diameter_id UUID REFERENCES public.implant_diameters(id) ON DELETE SET NULL,
  diameter_label TEXT,
  sku_reference TEXT,
  lot_number TEXT,
  identification_number TEXT,
  expiration_date DATE,
  quantity_in_stock INTEGER DEFAULT 0,
  minimum_stock_level INTEGER DEFAULT 2,
  item_status public.implant_inventory_status DEFAULT 'in_stock',
  notes TEXT,
  attachment_url TEXT,
  allow_duplicate_override BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. USAGE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.implant_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT,
  implant_inventory_id UUID REFERENCES public.implant_inventory(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_name TEXT,
  patient_name TEXT,
  patient_chart_number TEXT,
  procedure_date DATE,
  staff_assistant_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  staff_assistant_name TEXT,
  tooth_site_number TEXT,
  company_id UUID REFERENCES public.implant_companies(id) ON DELETE SET NULL,
  company_name TEXT,
  system_id UUID REFERENCES public.implant_systems(id) ON DELETE SET NULL,
  system_name TEXT,
  platform_size_id UUID REFERENCES public.implant_platform_sizes(id) ON DELETE SET NULL,
  platform_size_name TEXT,
  length_id UUID REFERENCES public.implant_lengths(id) ON DELETE SET NULL,
  length_label TEXT,
  diameter_id UUID REFERENCES public.implant_diameters(id) ON DELETE SET NULL,
  diameter_label TEXT,
  identification_number TEXT,
  lot_number TEXT,
  procedure_notes TEXT,
  item_status public.implant_inventory_status DEFAULT 'used',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS public.implant_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  record_type public.implant_record_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.implant_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  record_type public.implant_record_type NOT NULL,
  action public.implant_audit_action NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  old_values JSONB,
  new_values JSONB
);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_implant_inventory_office ON public.implant_inventory(office_id);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_company ON public.implant_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_status ON public.implant_inventory(item_status);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_expiration ON public.implant_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_id_number ON public.implant_inventory(identification_number);
CREATE INDEX IF NOT EXISTS idx_implant_usage_office ON public.implant_usage_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_implant_usage_procedure_date ON public.implant_usage_logs(procedure_date);
CREATE INDEX IF NOT EXISTS idx_implant_usage_id_number ON public.implant_usage_logs(identification_number);
CREATE INDEX IF NOT EXISTS idx_implant_audit_record ON public.implant_audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_implant_systems_company ON public.implant_systems(company_id);

-- 8. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_role_for_implants()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(role, 'staff') FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_implant_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_implant_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- 9. AUTO-DEDUCT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.implant_auto_deduct_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.item_status = 'used' AND NEW.implant_inventory_id IS NOT NULL THEN
    UPDATE public.implant_inventory
    SET
      quantity_in_stock = GREATEST(0, quantity_in_stock - 1),
      updated_at = now()
    WHERE id = NEW.implant_inventory_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 10. ENABLE RLS
ALTER TABLE public.implant_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_platform_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_lengths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_diameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_audit_logs ENABLE ROW LEVEL SECURITY;

-- 11. RLS POLICIES - Master Data (read all authenticated, write admin+)
DROP POLICY IF EXISTS "implant_companies_read" ON public.implant_companies;
CREATE POLICY "implant_companies_read" ON public.implant_companies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_companies_write" ON public.implant_companies;
CREATE POLICY "implant_companies_write" ON public.implant_companies
  FOR ALL TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_systems_read" ON public.implant_systems;
CREATE POLICY "implant_systems_read" ON public.implant_systems
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_systems_write" ON public.implant_systems;
CREATE POLICY "implant_systems_write" ON public.implant_systems
  FOR ALL TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_platform_sizes_read" ON public.implant_platform_sizes;
CREATE POLICY "implant_platform_sizes_read" ON public.implant_platform_sizes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_platform_sizes_write" ON public.implant_platform_sizes;
CREATE POLICY "implant_platform_sizes_write" ON public.implant_platform_sizes
  FOR ALL TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_lengths_read" ON public.implant_lengths;
CREATE POLICY "implant_lengths_read" ON public.implant_lengths
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_lengths_write" ON public.implant_lengths;
CREATE POLICY "implant_lengths_write" ON public.implant_lengths
  FOR ALL TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_diameters_read" ON public.implant_diameters;
CREATE POLICY "implant_diameters_read" ON public.implant_diameters
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_diameters_write" ON public.implant_diameters;
CREATE POLICY "implant_diameters_write" ON public.implant_diameters
  FOR ALL TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

-- RLS POLICIES - Inventory
DROP POLICY IF EXISTS "implant_inventory_read" ON public.implant_inventory;
CREATE POLICY "implant_inventory_read" ON public.implant_inventory
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_inventory_insert" ON public.implant_inventory;
CREATE POLICY "implant_inventory_insert" ON public.implant_inventory
  FOR INSERT TO authenticated
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_inventory_update" ON public.implant_inventory;
CREATE POLICY "implant_inventory_update" ON public.implant_inventory
  FOR UPDATE TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_inventory_delete" ON public.implant_inventory;
CREATE POLICY "implant_inventory_delete" ON public.implant_inventory
  FOR DELETE TO authenticated
  USING (public.is_implant_super_admin());

-- RLS POLICIES - Usage Logs
DROP POLICY IF EXISTS "implant_usage_read" ON public.implant_usage_logs;
CREATE POLICY "implant_usage_read" ON public.implant_usage_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_usage_insert" ON public.implant_usage_logs;
CREATE POLICY "implant_usage_insert" ON public.implant_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "implant_usage_update" ON public.implant_usage_logs;
CREATE POLICY "implant_usage_update" ON public.implant_usage_logs
  FOR UPDATE TO authenticated
  USING (public.is_implant_admin_or_above())
  WITH CHECK (public.is_implant_admin_or_above());

DROP POLICY IF EXISTS "implant_usage_delete" ON public.implant_usage_logs;
CREATE POLICY "implant_usage_delete" ON public.implant_usage_logs
  FOR DELETE TO authenticated
  USING (public.is_implant_super_admin());

-- RLS POLICIES - Attachments
DROP POLICY IF EXISTS "implant_attachments_all" ON public.implant_attachments;
CREATE POLICY "implant_attachments_all" ON public.implant_attachments
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS POLICIES - Audit Logs
DROP POLICY IF EXISTS "implant_audit_read" ON public.implant_audit_logs;
CREATE POLICY "implant_audit_read" ON public.implant_audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "implant_audit_insert" ON public.implant_audit_logs;
CREATE POLICY "implant_audit_insert" ON public.implant_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 12. TRIGGERS
DROP TRIGGER IF EXISTS implant_auto_deduct_trigger ON public.implant_usage_logs;
CREATE TRIGGER implant_auto_deduct_trigger
  AFTER INSERT ON public.implant_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.implant_auto_deduct_stock();

-- 13. SEED MASTER DATA
DO $$
DECLARE
  existing_user_id UUID;
  company1_id UUID := gen_random_uuid();
  company2_id UUID := gen_random_uuid();
  company3_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.implant_companies (id, name, is_active, created_by)
  VALUES
    (company1_id, 'Nobel Biocare', true, existing_user_id),
    (company2_id, 'Straumann', true, existing_user_id),
    (company3_id, 'Zimmer Biomet', true, existing_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.implant_systems (id, company_id, name, is_active, created_by)
  VALUES
    (gen_random_uuid(), company1_id, 'NobelActive', true, existing_user_id),
    (gen_random_uuid(), company1_id, 'NobelParallel CC', true, existing_user_id),
    (gen_random_uuid(), company2_id, 'BLT', true, existing_user_id),
    (gen_random_uuid(), company2_id, 'SLActive', true, existing_user_id),
    (gen_random_uuid(), company3_id, 'Tapered Screw-Vent', true, existing_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.implant_platform_sizes (id, name, is_active, created_by)
  VALUES
    (gen_random_uuid(), 'NP (Narrow Platform)', true, existing_user_id),
    (gen_random_uuid(), 'RP (Regular Platform)', true, existing_user_id),
    (gen_random_uuid(), 'WP (Wide Platform)', true, existing_user_id),
    (gen_random_uuid(), 'SP (Standard Platform)', true, existing_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.implant_lengths (id, value_mm, label, is_active, created_by)
  VALUES
    (gen_random_uuid(), 8.0, '8mm', true, existing_user_id),
    (gen_random_uuid(), 10.0, '10mm', true, existing_user_id),
    (gen_random_uuid(), 11.5, '11.5mm', true, existing_user_id),
    (gen_random_uuid(), 13.0, '13mm', true, existing_user_id),
    (gen_random_uuid(), 15.0, '15mm', true, existing_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.implant_diameters (id, value_mm, label, is_active, created_by)
  VALUES
    (gen_random_uuid(), 3.3, '3.3mm', true, existing_user_id),
    (gen_random_uuid(), 3.75, '3.75mm', true, existing_user_id),
    (gen_random_uuid(), 4.0, '4.0mm', true, existing_user_id),
    (gen_random_uuid(), 4.3, '4.3mm', true, existing_user_id),
    (gen_random_uuid(), 5.0, '5.0mm', true, existing_user_id)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
