-- ============================================================
-- Monthly Supply Request & Inventory Tracking Module
-- Migration: 20260307000000_supply_request_module.sql
-- ============================================================

-- ── 0. EXTEND user_role ENUM ────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'regional_clinical_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 1. ENUM TYPES ──────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.supply_inventory_status CASCADE;
CREATE TYPE public.supply_inventory_status AS ENUM (
  'in_stock', 'low', 'critically_low', 'out_of_stock', 'discontinued'
);

DROP TYPE IF EXISTS public.supply_request_status CASCADE;
CREATE TYPE public.supply_request_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected'
);

DROP TYPE IF EXISTS public.supply_request_item_status CASCADE;
CREATE TYPE public.supply_request_item_status AS ENUM (
  'pending', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected'
);

DROP TYPE IF EXISTS public.supply_request_priority CASCADE;
CREATE TYPE public.supply_request_priority AS ENUM (
  'normal', 'important', 'high', 'urgent', 'critical'
);

DROP TYPE IF EXISTS public.urgent_request_status CASCADE;
CREATE TYPE public.urgent_request_status AS ENUM (
  'submitted', 'acknowledged', 'in_process', 'partially_fulfilled', 'fulfilled', 'denied'
);

DROP TYPE IF EXISTS public.fulfillment_status CASCADE;
CREATE TYPE public.fulfillment_status AS ENUM (
  'pending', 'partial', 'completed', 'backordered', 'cancelled'
);

DROP TYPE IF EXISTS public.inventory_change_type CASCADE;
CREATE TYPE public.inventory_change_type AS ENUM (
  'adjustment', 'supplied', 'used', 'imported'
);

-- ── 2. CORE TABLES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supply_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Package',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_subsections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.supply_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  office_id TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id UUID NOT NULL REFERENCES public.supply_subsections(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.supply_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  vendor_id UUID REFERENCES public.supply_vendors(id) ON DELETE SET NULL,
  sku TEXT,
  unit_type TEXT DEFAULT 'Each',
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  office_id TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_items_unique_name_subsection
  ON public.supply_items (subsection_id, lower(trim(name)))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.office_supply_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  item_id UUID REFERENCES public.supply_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  department_id UUID REFERENCES public.supply_departments(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES public.supply_subsections(id) ON DELETE SET NULL,
  brand TEXT,
  vendor_id UUID REFERENCES public.supply_vendors(id) ON DELETE SET NULL,
  sku TEXT,
  unit_type TEXT DEFAULT 'Each',
  quantity_on_hand INTEGER DEFAULT 0,
  minimum_level INTEGER DEFAULT 1,
  maximum_level INTEGER DEFAULT 100,
  reorder_level INTEGER DEFAULT 5,
  critically_low_threshold INTEGER DEFAULT 2,
  last_supplied_date DATE,
  last_supplied_quantity INTEGER,
  expiration_date DATE,
  lot_number TEXT,
  inv_status public.supply_inventory_status DEFAULT 'in_stock',
  notes TEXT,
  last_updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.office_supply_inventory(id) ON DELETE CASCADE,
  office_id TEXT NOT NULL,
  change_type public.inventory_change_type DEFAULT 'adjustment',
  old_qty INTEGER,
  new_qty INTEGER,
  change_qty INTEGER,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_request_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  request_type TEXT DEFAULT 'monthly' CHECK (request_type IN ('monthly', 'urgent')),
  request_month DATE,
  requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  batch_status public.supply_request_status DEFAULT 'draft',
  reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.supply_request_batches(id) ON DELETE CASCADE,
  office_id TEXT NOT NULL,
  department_id UUID REFERENCES public.supply_departments(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES public.supply_subsections(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.supply_items(id) ON DELETE SET NULL,
  custom_item_name TEXT,
  current_qty_on_hand INTEGER DEFAULT 0,
  requested_qty INTEGER NOT NULL DEFAULT 1,
  unit_type TEXT DEFAULT 'Each',
  priority public.supply_request_priority DEFAULT 'normal',
  reason_notes TEXT,
  preferred_vendor TEXT,
  item_status public.supply_request_item_status DEFAULT 'pending',
  approved_qty INTEGER,
  fulfilled_qty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.urgent_supply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  request_date DATE DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES public.supply_departments(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES public.supply_subsections(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.supply_items(id) ON DELETE SET NULL,
  custom_item_name TEXT,
  current_qty_on_hand INTEGER DEFAULT 0,
  requested_qty INTEGER NOT NULL DEFAULT 1,
  unit_type TEXT DEFAULT 'Each',
  priority public.supply_request_priority DEFAULT 'urgent',
  reason TEXT,
  patient_care_impact TEXT,
  needed_by_date DATE,
  notes TEXT,
  urgent_status public.urgent_request_status DEFAULT 'submitted',
  response_time_hours NUMERIC,
  acknowledged_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_fulfillment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  request_type TEXT DEFAULT 'monthly' CHECK (request_type IN ('monthly', 'urgent')),
  batch_id UUID REFERENCES public.supply_request_batches(id) ON DELETE SET NULL,
  urgent_request_id UUID REFERENCES public.urgent_supply_requests(id) ON DELETE SET NULL,
  request_item_id UUID REFERENCES public.supply_request_items(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.supply_departments(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES public.supply_subsections(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.supply_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  qty_requested INTEGER DEFAULT 0,
  qty_approved INTEGER DEFAULT 0,
  qty_supplied INTEGER DEFAULT 0,
  date_supplied DATE,
  supplied_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  delivery_method TEXT,
  vendor_id UUID REFERENCES public.supply_vendors(id) ON DELETE SET NULL,
  tracking_notes TEXT,
  received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  date_received DATE,
  log_fulfillment_status public.fulfillment_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID,
  record_type TEXT,
  action TEXT,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  old_values JSONB,
  new_values JSONB
);

-- ── 3. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_supply_departments_sort ON public.supply_departments(sort_order);
CREATE INDEX IF NOT EXISTS idx_supply_subsections_dept ON public.supply_subsections(department_id);
CREATE INDEX IF NOT EXISTS idx_supply_items_subsection ON public.supply_items(subsection_id);
CREATE INDEX IF NOT EXISTS idx_supply_items_dept ON public.supply_items(department_id);
CREATE INDEX IF NOT EXISTS idx_office_supply_inv_office ON public.office_supply_inventory(office_id);
CREATE INDEX IF NOT EXISTS idx_office_supply_inv_item ON public.office_supply_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_office_supply_inv_status ON public.office_supply_inventory(inv_status);
CREATE INDEX IF NOT EXISTS idx_supply_req_batches_office ON public.supply_request_batches(office_id);
CREATE INDEX IF NOT EXISTS idx_supply_req_batches_month ON public.supply_request_batches(request_month);
CREATE INDEX IF NOT EXISTS idx_supply_req_items_batch ON public.supply_request_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_urgent_requests_office ON public.urgent_supply_requests(office_id);
CREATE INDEX IF NOT EXISTS idx_urgent_requests_status ON public.urgent_supply_requests(urgent_status);
CREATE INDEX IF NOT EXISTS idx_fulfillment_logs_office ON public.supply_fulfillment_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_inv_history_inventory ON public.supply_inventory_history(inventory_id);

-- ── 4. FUNCTIONS ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_supply_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_supply_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role::text IN ('super_admin', 'admin', 'regional_clinical_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.auto_update_inventory_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quantity_on_hand <= 0 THEN
    NEW.inv_status := 'out_of_stock';
  ELSIF NEW.quantity_on_hand <= NEW.critically_low_threshold THEN
    NEW.inv_status := 'critically_low';
  ELSIF NEW.quantity_on_hand <= NEW.reorder_level THEN
    NEW.inv_status := 'low';
  ELSE
    NEW.inv_status := 'in_stock';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.supply_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_subsections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_supply_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_request_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgent_supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_fulfillment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ─────────────────────────────────────────────────────────

-- supply_vendors: authenticated read, admin write
DROP POLICY IF EXISTS "supply_vendors_read" ON public.supply_vendors;
CREATE POLICY "supply_vendors_read" ON public.supply_vendors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_vendors_write" ON public.supply_vendors;
CREATE POLICY "supply_vendors_write" ON public.supply_vendors
  FOR ALL TO authenticated
  USING (public.is_supply_admin_or_above())
  WITH CHECK (public.is_supply_admin_or_above());

-- supply_departments: authenticated read, admin write
DROP POLICY IF EXISTS "supply_departments_read" ON public.supply_departments;
CREATE POLICY "supply_departments_read" ON public.supply_departments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_departments_write" ON public.supply_departments;
CREATE POLICY "supply_departments_write" ON public.supply_departments
  FOR ALL TO authenticated
  USING (public.is_supply_admin_or_above())
  WITH CHECK (public.is_supply_admin_or_above());

-- supply_subsections: authenticated read, admin write
DROP POLICY IF EXISTS "supply_subsections_read" ON public.supply_subsections;
CREATE POLICY "supply_subsections_read" ON public.supply_subsections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_subsections_write" ON public.supply_subsections;
CREATE POLICY "supply_subsections_write" ON public.supply_subsections
  FOR ALL TO authenticated
  USING (public.is_supply_admin_or_above())
  WITH CHECK (public.is_supply_admin_or_above());

-- supply_items: authenticated read, admin write
DROP POLICY IF EXISTS "supply_items_read" ON public.supply_items;
CREATE POLICY "supply_items_read" ON public.supply_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_items_write" ON public.supply_items;
CREATE POLICY "supply_items_write" ON public.supply_items
  FOR ALL TO authenticated
  USING (public.is_supply_admin_or_above())
  WITH CHECK (public.is_supply_admin_or_above());

-- office_supply_inventory: authenticated read all, write own office
DROP POLICY IF EXISTS "office_supply_inv_read" ON public.office_supply_inventory;
CREATE POLICY "office_supply_inv_read" ON public.office_supply_inventory
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "office_supply_inv_write" ON public.office_supply_inventory;
CREATE POLICY "office_supply_inv_write" ON public.office_supply_inventory
  FOR ALL TO authenticated
  USING (last_updated_by = auth.uid() OR public.is_supply_admin_or_above())
  WITH CHECK (true);

-- supply_inventory_history: authenticated read
DROP POLICY IF EXISTS "supply_inv_history_read" ON public.supply_inventory_history;
CREATE POLICY "supply_inv_history_read" ON public.supply_inventory_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_inv_history_insert" ON public.supply_inventory_history;
CREATE POLICY "supply_inv_history_insert" ON public.supply_inventory_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- supply_request_batches: authenticated read/write
DROP POLICY IF EXISTS "supply_req_batches_read" ON public.supply_request_batches;
CREATE POLICY "supply_req_batches_read" ON public.supply_request_batches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_req_batches_write" ON public.supply_request_batches;
CREATE POLICY "supply_req_batches_write" ON public.supply_request_batches
  FOR ALL TO authenticated
  USING (requested_by = auth.uid() OR public.is_supply_admin_or_above())
  WITH CHECK (true);

-- supply_request_items: authenticated read/write
DROP POLICY IF EXISTS "supply_req_items_read" ON public.supply_request_items;
CREATE POLICY "supply_req_items_read" ON public.supply_request_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_req_items_write" ON public.supply_request_items;
CREATE POLICY "supply_req_items_write" ON public.supply_request_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- urgent_supply_requests: authenticated read/write
DROP POLICY IF EXISTS "urgent_requests_read" ON public.urgent_supply_requests;
CREATE POLICY "urgent_requests_read" ON public.urgent_supply_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "urgent_requests_write" ON public.urgent_supply_requests;
CREATE POLICY "urgent_requests_write" ON public.urgent_supply_requests
  FOR ALL TO authenticated
  USING (requested_by = auth.uid() OR public.is_supply_admin_or_above())
  WITH CHECK (true);

-- supply_fulfillment_logs: authenticated read, admin write
DROP POLICY IF EXISTS "fulfillment_logs_read" ON public.supply_fulfillment_logs;
CREATE POLICY "fulfillment_logs_read" ON public.supply_fulfillment_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fulfillment_logs_write" ON public.supply_fulfillment_logs;
CREATE POLICY "fulfillment_logs_write" ON public.supply_fulfillment_logs
  FOR ALL TO authenticated
  USING (public.is_supply_admin_or_above())
  WITH CHECK (public.is_supply_admin_or_above());

-- supply_audit_logs: authenticated read, insert
DROP POLICY IF EXISTS "supply_audit_logs_read" ON public.supply_audit_logs;
CREATE POLICY "supply_audit_logs_read" ON public.supply_audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supply_audit_logs_insert" ON public.supply_audit_logs;
CREATE POLICY "supply_audit_logs_insert" ON public.supply_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 7. TRIGGERS ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_auto_update_inventory_status ON public.office_supply_inventory;
CREATE TRIGGER trg_auto_update_inventory_status
  BEFORE INSERT OR UPDATE ON public.office_supply_inventory
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_inventory_status();

-- ── 8. SEED DATA ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  dept_general UUID;
  dept_hygiene UUID;
  dept_restorative UUID;
  dept_crown UUID;
  dept_endo UUID;
  dept_oral_surgery UUID;
  dept_implants UUID;
  dept_ortho UUID;
  dept_pedo UUID;
  dept_perio UUID;
  dept_sedation UUID;
  dept_sterilization UUID;
  dept_front_desk UUID;
  dept_lab UUID;
  dept_digital UUID;
  dept_housekeeping UUID;
  sub_id UUID;
BEGIN

  -- Insert departments
  INSERT INTO public.supply_departments (id, name, description, icon, sort_order, is_active)
  VALUES
    (gen_random_uuid(), 'General Clinical Consumables', 'PPE, barriers, and everyday clinical supplies', 'Package', 1, true),
    (gen_random_uuid(), 'Hygiene', 'Prophylaxis, scaling, and preventive care supplies', 'Activity', 2, true),
    (gen_random_uuid(), 'Restorative / Operative', 'Composite, bonding, and restorative materials', 'Layers', 3, true),
    (gen_random_uuid(), 'Crown & Bridge / Prosthodontics', 'Impression materials, temporaries, and prosthetic supplies', 'Circle', 4, true),
    (gen_random_uuid(), 'Endodontics', 'Files, obturation, and irrigation supplies', 'Zap', 5, true),
    (gen_random_uuid(), 'Oral Surgery', 'Surgical instruments, sutures, and grafting materials', 'Scissors', 6, true),
    (gen_random_uuid(), 'Implants', 'Implant fixtures, abutments, and surgical guides', 'Syringe', 7, true),
    (gen_random_uuid(), 'Orthodontics', 'Brackets, wires, and orthodontic accessories', 'GitBranch', 8, true),
    (gen_random_uuid(), 'Pediatric Dentistry', 'Pediatric-specific supplies and stainless steel crowns', 'Star', 9, true),
    (gen_random_uuid(), 'Periodontics', 'Periodontal instruments and surgical supplies', 'Leaf', 10, true),
    (gen_random_uuid(), 'Sedation / Medical Emergency / Anesthesia', 'Nitrous, oxygen, IV supplies, and emergency kit', 'Heart', 11, true),
    (gen_random_uuid(), 'Sterilization', 'Sterilization pouches, indicators, and autoclave supplies', 'Shield', 12, true),
    (gen_random_uuid(), 'Front Desk / Patient Care', 'Administrative and patient-facing supplies', 'Clipboard', 13, true),
    (gen_random_uuid(), 'Lab / In-House Appliances', 'Model stone, acrylic, and lab materials', 'FlaskConical', 14, true),
    (gen_random_uuid(), 'Digital / Imaging', 'Sensor barriers, scanner sleeves, and 3D printing supplies', 'Monitor', 15, true),
    (gen_random_uuid(), 'Housekeeping / Facility', 'Cleaning, janitorial, and facility maintenance supplies', 'Home', 16, true)
  ON CONFLICT (id) DO NOTHING;

  -- Get department IDs
  SELECT id INTO dept_general FROM public.supply_departments WHERE name = 'General Clinical Consumables' LIMIT 1;
  SELECT id INTO dept_hygiene FROM public.supply_departments WHERE name = 'Hygiene' LIMIT 1;
  SELECT id INTO dept_restorative FROM public.supply_departments WHERE name = 'Restorative / Operative' LIMIT 1;
  SELECT id INTO dept_crown FROM public.supply_departments WHERE name = 'Crown & Bridge / Prosthodontics' LIMIT 1;
  SELECT id INTO dept_endo FROM public.supply_departments WHERE name = 'Endodontics' LIMIT 1;
  SELECT id INTO dept_oral_surgery FROM public.supply_departments WHERE name = 'Oral Surgery' LIMIT 1;
  SELECT id INTO dept_implants FROM public.supply_departments WHERE name = 'Implants' LIMIT 1;
  SELECT id INTO dept_ortho FROM public.supply_departments WHERE name = 'Orthodontics' LIMIT 1;
  SELECT id INTO dept_pedo FROM public.supply_departments WHERE name = 'Pediatric Dentistry' LIMIT 1;
  SELECT id INTO dept_perio FROM public.supply_departments WHERE name = 'Periodontics' LIMIT 1;
  SELECT id INTO dept_sedation FROM public.supply_departments WHERE name = 'Sedation / Medical Emergency / Anesthesia' LIMIT 1;
  SELECT id INTO dept_sterilization FROM public.supply_departments WHERE name = 'Sterilization' LIMIT 1;
  SELECT id INTO dept_front_desk FROM public.supply_departments WHERE name = 'Front Desk / Patient Care' LIMIT 1;
  SELECT id INTO dept_lab FROM public.supply_departments WHERE name = 'Lab / In-House Appliances' LIMIT 1;
  SELECT id INTO dept_digital FROM public.supply_departments WHERE name = 'Digital / Imaging' LIMIT 1;
  SELECT id INTO dept_housekeeping FROM public.supply_departments WHERE name = 'Housekeeping / Facility' LIMIT 1;

  -- ── General Clinical Consumables subsections + items ──
  IF dept_general IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_general, 'Patient Protection', true),
      (gen_random_uuid(), dept_general, 'PPE', true),
      (gen_random_uuid(), dept_general, 'Barriers & Covers', true),
      (gen_random_uuid(), dept_general, 'Cotton & Gauze', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_general AND name = 'Patient Protection' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_general, 'Patient Bibs', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Bib Clips', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_general, 'Saliva Ejectors', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'HVE Tips', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Air/Water Syringe Tips', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Disposable Dappen Dishes', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_general, 'Articulating Paper', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Mixing Pads', 'Pack', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_general AND name = 'PPE' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_general, 'Exam Gloves (S)', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Exam Gloves (M)', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Exam Gloves (L)', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Surgical Masks', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Face Shields', 'Each', true),
        (gen_random_uuid(), sub_id, dept_general, 'Safety Glasses', 'Each', true),
        (gen_random_uuid(), sub_id, dept_general, 'Disposable Gowns', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Bouffant Caps', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_general AND name = 'Cotton & Gauze' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_general, 'Cotton Rolls', 'Bag', true),
        (gen_random_uuid(), sub_id, dept_general, '2x2 Gauze', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, '4x4 Gauze', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Cotton Tip Applicators', 'Box', true),
        (gen_random_uuid(), sub_id, dept_general, 'Microbrushes', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Hygiene subsections + items ──
  IF dept_hygiene IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_hygiene, 'Prophylaxis', true),
      (gen_random_uuid(), dept_hygiene, 'Scaling & Instruments', true),
      (gen_random_uuid(), dept_hygiene, 'Preventive Materials', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_hygiene AND name = 'Prophylaxis' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_hygiene, 'Prophy Paste', 'Box', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Disposable Prophy Angles', 'Box', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Prophy Brushes', 'Box', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Fluoride Varnish', 'Box', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Sealant Material', 'Kit', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Air Polishing Powder', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Desensitizer', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Chlorhexidine Rinse', 'Bottle', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_hygiene AND name = 'Scaling & Instruments' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_hygiene, 'Ultrasonic Scaler Tips', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Piezo Tips', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Curettes', 'Each', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Periodontal Probes', 'Each', true),
        (gen_random_uuid(), sub_id, dept_hygiene, 'Explorers', 'Each', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Restorative subsections + items ──
  IF dept_restorative IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_restorative, 'Composites & Cements', true),
      (gen_random_uuid(), dept_restorative, 'Burs & Finishing', true),
      (gen_random_uuid(), dept_restorative, 'Matrix & Wedges', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_restorative AND name = 'Composites & Cements' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_restorative, 'Composite', 'Syringe', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Flowable Composite', 'Syringe', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Bulk Fill Composite', 'Syringe', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Bonding Agent', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Etchant', 'Syringe', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Temporary Cement', 'Tube', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Permanent Cement', 'Kit', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Glass Ionomer', 'Kit', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_restorative AND name = 'Burs & Finishing' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_restorative, 'Diamond Burs', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Carbide Burs', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Finishing Burs', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Polishing Discs', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_restorative, 'Finishing Strips', 'Pack', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Endodontics subsections + items ──
  IF dept_endo IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_endo, 'Files & Instruments', true),
      (gen_random_uuid(), dept_endo, 'Obturation', true),
      (gen_random_uuid(), dept_endo, 'Irrigation', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_endo AND name = 'Files & Instruments' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_endo, 'K-Files', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'H-Files', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Rotary Files', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Reciprocating Files', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Gates Glidden Drills', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Rubber Dam Clamps', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Rubber Dams', 'Box', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Paper Points', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_endo AND name = 'Obturation' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_endo, 'Gutta Percha', 'Box', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Endo Sealer', 'Kit', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Calcium Hydroxide', 'Syringe', true),
        (gen_random_uuid(), sub_id, dept_endo, 'MTA / Bioceramic Material', 'Kit', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Fiber Posts', 'Pack', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_endo AND name = 'Irrigation' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_endo, 'Sodium Hypochlorite', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_endo, 'EDTA', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Irrigation Syringes', 'Box', true),
        (gen_random_uuid(), sub_id, dept_endo, 'Irrigation Needles', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Oral Surgery subsections + items ──
  IF dept_oral_surgery IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_oral_surgery, 'Surgical Supplies', true),
      (gen_random_uuid(), dept_oral_surgery, 'Bone Grafting Materials', true),
      (gen_random_uuid(), dept_oral_surgery, 'Sutures & Hemostasis', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_oral_surgery AND name = 'Surgical Supplies' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sterile Gauze', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Surgical Blades', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sterile Saline', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Surgical Burs', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Collagen Plugs', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Hemostatic Agents', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Ice Packs', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sterile Syringes', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_oral_surgery AND name = 'Bone Grafting Materials' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Bone Graft Material', 'Kit', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Membranes', 'Each', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'PRF Tubes', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Butterfly Needles', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_oral_surgery AND name = 'Sutures & Hemostasis' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sutures 3-0', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sutures 4-0', 'Box', true),
        (gen_random_uuid(), sub_id, dept_oral_surgery, 'Sutures 5-0', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Sterilization subsections + items ──
  IF dept_sterilization IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_sterilization, 'Sterilization Supplies', true),
      (gen_random_uuid(), dept_sterilization, 'Indicators & Testing', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_sterilization AND name = 'Sterilization Supplies' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_sterilization, 'Sterilization Pouches', 'Box', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Sterilization Wrap', 'Roll', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Instrument Detergent', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Enzymatic Cleaner', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Ultrasonic Solution', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Distilled Water', 'Gallon', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Autoclave Cleaner', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Instrument Milk', 'Bottle', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_sterilization AND name = 'Indicators & Testing' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_sterilization, 'Chemical Indicators', 'Box', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Biological Tests', 'Box', true),
        (gen_random_uuid(), sub_id, dept_sterilization, 'Indicator Tape', 'Roll', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Front Desk subsections + items ──
  IF dept_front_desk IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_front_desk, 'Office Supplies', true),
      (gen_random_uuid(), dept_front_desk, 'Patient Materials', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_front_desk AND name = 'Office Supplies' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_front_desk, 'Printer Paper', 'Ream', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Toner', 'Each', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Pens', 'Box', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Sticky Notes', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Receipt Paper', 'Roll', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Appointment Cards', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Business Cards', 'Pack', true),
        (gen_random_uuid(), sub_id, dept_front_desk, 'Clipboards', 'Each', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Implants subsections + items ──
  IF dept_implants IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_implants, 'Implant Components', true),
      (gen_random_uuid(), dept_implants, 'Surgical Guides & Accessories', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_implants AND name = 'Implant Components' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_implants, 'Healing Abutments', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Cover Screws', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Impression Copings', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Scan Bodies', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Abutment Screws', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Titanium Bases', 'Each', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Teflon Tape', 'Roll', true),
        (gen_random_uuid(), sub_id, dept_implants, 'Screw Access Filling Material', 'Kit', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Digital / Imaging subsections + items ──
  IF dept_digital IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_digital, 'Sensor & Scanner Supplies', true),
      (gen_random_uuid(), dept_digital, '3D Printing Supplies', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_digital AND name = 'Sensor & Scanner Supplies' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_digital, 'X-Ray Sensor Barriers', 'Box', true),
        (gen_random_uuid(), sub_id, dept_digital, 'PSP Barriers', 'Box', true),
        (gen_random_uuid(), sub_id, dept_digital, 'Intraoral Scanner Sleeves', 'Box', true),
        (gen_random_uuid(), sub_id, dept_digital, 'Camera Sleeves', 'Box', true),
        (gen_random_uuid(), sub_id, dept_digital, 'Photo Retractors', 'Each', true),
        (gen_random_uuid(), sub_id, dept_digital, 'Photography Mirrors', 'Each', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- ── Housekeeping subsections + items ──
  IF dept_housekeeping IS NOT NULL THEN
    INSERT INTO public.supply_subsections (id, department_id, name, is_active)
    VALUES
      (gen_random_uuid(), dept_housekeeping, 'Cleaning Supplies', true),
      (gen_random_uuid(), dept_housekeeping, 'Waste Management', true)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_housekeeping AND name = 'Cleaning Supplies' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Paper Towels', 'Case', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Hand Soap', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Glass Cleaner', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Mop Heads', 'Each', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Laundry Detergent', 'Bottle', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Dish Soap', 'Bottle', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO sub_id FROM public.supply_subsections WHERE department_id = dept_housekeeping AND name = 'Waste Management' LIMIT 1;
    IF sub_id IS NOT NULL THEN
      INSERT INTO public.supply_items (id, subsection_id, department_id, name, unit_type, is_active)
      VALUES
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Trash Bags', 'Box', true),
        (gen_random_uuid(), sub_id, dept_housekeeping, 'Red Biohazard Bags', 'Box', true)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
