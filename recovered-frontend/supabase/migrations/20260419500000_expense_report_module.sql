-- ============================================================
-- EXPENSE REPORT MODULE — CENTRALIZED EXPENSE INTELLIGENCE LAYER
-- Migration: 20260419500000_expense_report_module.sql
-- ============================================================
-- Creates the normalized expense schema that becomes the single
-- source of truth for all expense reporting across the dashboard.
-- Does NOT modify any existing tables (daily_entries, gusto_*, payroll_*).
-- ============================================================

-- ── 1. ENUM TYPES ────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.expense_source_type CASCADE;
CREATE TYPE public.expense_source_type AS ENUM (
  'manual',
  'gusto',
  'payroll',
  'quickbooks',
  'amex_api',
  'amex_statement_import',
  'utility_import',
  'insurance_import',
  'recurring',
  'other'
);

DROP TYPE IF EXISTS public.expense_payment_source CASCADE;
CREATE TYPE public.expense_payment_source AS ENUM (
  'amex',
  'gusto',
  'manual',
  'quickbooks',
  'recurring',
  'other'
);

DROP TYPE IF EXISTS public.expense_status CASCADE;
CREATE TYPE public.expense_status AS ENUM (
  'draft',
  'posted',
  'archived'
);

DROP TYPE IF EXISTS public.expense_allocation_method CASCADE;
CREATE TYPE public.expense_allocation_method AS ENUM (
  'direct_to_office',
  'direct_to_office_and_department',
  'split_evenly',
  'percentage_allocation',
  'production_based',
  'collections_based',
  'custom'
);

DROP TYPE IF EXISTS public.import_status_type CASCADE;
CREATE TYPE public.import_status_type AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'partial'
);

-- ── 2. CORE TABLES ───────────────────────────────────────────────────────────

-- Expense Categories (extensible, hierarchical)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_name ON public.expense_categories(name);

-- Expense Vendors
CREATE TABLE IF NOT EXISTS public.expense_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  default_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  default_department_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_vendors_name ON public.expense_vendors(vendor_name);

-- Expense Departments (office-scoped or global)
CREATE TABLE IF NOT EXISTS public.expense_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  parent_department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_departments_office ON public.expense_departments(office_id);

-- AmEx Raw Transactions (staging table — never used directly for UI totals)
CREATE TABLE IF NOT EXISTS public.amex_raw_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID,
  cardholder_name TEXT,
  cardholder_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cardholder_role TEXT,
  cardholder_default_office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  cardholder_default_department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  card_last4 TEXT,
  merchant_name TEXT,
  transaction_date DATE,
  posted_date DATE,
  statement_period_start DATE,
  statement_period_end DATE,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  reference_number TEXT,
  source_type TEXT DEFAULT 'amex_statement_import',
  raw_data JSONB,
  is_duplicate BOOLEAN DEFAULT false,
  needs_review BOOLEAN DEFAULT false,
  review_reason TEXT,
  normalized_expense_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amex_raw_posted_date ON public.amex_raw_transactions(posted_date);
CREATE INDEX IF NOT EXISTS idx_amex_raw_cardholder ON public.amex_raw_transactions(cardholder_name);
CREATE INDEX IF NOT EXISTS idx_amex_raw_batch ON public.amex_raw_transactions(import_batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_amex_raw_reference ON public.amex_raw_transactions(reference_number) WHERE reference_number IS NOT NULL;

-- Expense Import Batches
CREATE TABLE IF NOT EXISTS public.expense_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.expense_source_type NOT NULL,
  import_filename TEXT,
  statement_month TEXT,
  imported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  import_status public.import_status_type DEFAULT 'pending',
  imported_at TIMESTAMPTZ DEFAULT now(),
  total_rows INTEGER DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  rejected_rows INTEGER DEFAULT 0,
  notes TEXT,
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_import_batches_source ON public.expense_import_batches(source_type);
CREATE INDEX IF NOT EXISTS idx_expense_import_batches_status ON public.expense_import_batches(import_status);

-- Main Expenses Table (normalized layer)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT,
  department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  department_name TEXT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  subcategory_name TEXT,
  vendor_id UUID REFERENCES public.expense_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT,
  source_type public.expense_source_type NOT NULL DEFAULT 'manual',
  payment_source public.expense_payment_source NOT NULL DEFAULT 'manual',
  source_reference_id TEXT,
  source_table TEXT,
  source_tab TEXT,
  import_batch_id UUID REFERENCES public.expense_import_batches(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL,
  posted_date DATE,
  service_period_start DATE,
  service_period_end DATE,
  statement_period_start DATE,
  statement_period_end DATE,
  amount NUMERIC(12,2) NOT NULL,
  cardholder_name TEXT,
  cardholder_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cardholder_role TEXT,
  cardholder_default_office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  cardholder_default_department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  card_last4 TEXT,
  merchant_name TEXT,
  allocation_method public.expense_allocation_method DEFAULT 'direct_to_office',
  allocation_metadata JSONB,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  expense_status public.expense_status DEFAULT 'posted',
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_office ON public.expenses(office_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_source_type ON public.expenses(source_type);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cardholder ON public.expenses(cardholder_name);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(expense_status);
CREATE INDEX IF NOT EXISTS idx_expenses_batch ON public.expenses(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_source_ref ON public.expenses(source_reference_id) WHERE source_reference_id IS NOT NULL;
-- Idempotency index: prevent duplicate imports from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_source_dedup 
  ON public.expenses(source_type, source_reference_id) 
  WHERE source_reference_id IS NOT NULL;

-- Expense Allocations (split across offices/departments)
CREATE TABLE IF NOT EXISTS public.expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name TEXT,
  department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  department_name TEXT,
  allocated_amount NUMERIC(12,2) NOT NULL,
  allocation_percent NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_expense ON public.expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_office ON public.expense_allocations(office_id);

-- Expense Source Mappings (field-level mapping config for imports)
CREATE TABLE IF NOT EXISTS public.expense_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transform_rule TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_source_mappings_unique 
  ON public.expense_source_mappings(source_system, source_field, target_field);

-- Recurring Expense Templates
CREATE TABLE IF NOT EXISTS public.recurring_expense_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.expense_departments(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  vendor_name TEXT,
  amount NUMERIC(12,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly',
  day_of_month INTEGER DEFAULT 1,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AmEx Sync Logs (API connector audit)
CREATE TABLE IF NOT EXISTS public.amex_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'api',
  triggered_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  records_fetched INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details JSONB,
  notes TEXT
);

-- ── 3. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_expenses_date_office ON public.expenses(expense_date, office_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_source ON public.expenses(payment_source);
CREATE INDEX IF NOT EXISTS idx_expenses_merchant ON public.expenses(merchant_name);

-- ── 4. HELPER FUNCTIONS ──────────────────────────────────────────────────────

-- Role check helper (reuse pattern from existing codebase)
CREATE OR REPLACE FUNCTION public.is_super_admin_expense()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above_expense()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager')
  )
$$;

-- Validate allocation totals reconcile to expense amount
CREATE OR REPLACE FUNCTION public.validate_expense_allocation_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense_amount NUMERIC(12,2);
  v_alloc_total NUMERIC(12,2);
BEGIN
  SELECT amount INTO v_expense_amount FROM public.expenses WHERE id = NEW.expense_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_alloc_total
    FROM public.expense_allocations WHERE expense_id = NEW.expense_id;
  IF v_alloc_total > v_expense_amount * 1.001 THEN
    RAISE EXCEPTION 'Allocation total (%) exceeds expense amount (%)', v_alloc_total, v_expense_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_expense_allocation ON public.expense_allocations;
CREATE TRIGGER trg_validate_expense_allocation
  AFTER INSERT OR UPDATE ON public.expense_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_allocation_total();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_expense_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_updated_at();

DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_updated_at();

-- Aggregate expenses by office and period (used by KPI cards)
CREATE OR REPLACE FUNCTION public.get_expense_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_office_id UUID DEFAULT NULL
)
RETURNS TABLE(
  office_id UUID,
  office_name TEXT,
  category_name TEXT,
  source_type TEXT,
  payment_source TEXT,
  total_amount NUMERIC,
  expense_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.office_id,
    e.office_name,
    e.category_name,
    e.source_type::TEXT,
    e.payment_source::TEXT,
    SUM(e.amount) AS total_amount,
    COUNT(*) AS expense_count
  FROM public.expenses e
  WHERE e.expense_date BETWEEN p_start_date AND p_end_date
    AND e.expense_status != 'archived'
    AND (p_office_id IS NULL OR e.office_id = p_office_id)
  GROUP BY e.office_id, e.office_name, e.category_name, e.source_type, e.payment_source;
$$;

-- ── 5. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_source_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_raw_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_sync_logs ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ──────────────────────────────────────────────────────────

-- expense_categories: all authenticated can read; super_admin can write
DROP POLICY IF EXISTS "expense_categories_read" ON public.expense_categories;
CREATE POLICY "expense_categories_read" ON public.expense_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_categories_write" ON public.expense_categories;
CREATE POLICY "expense_categories_write" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.is_super_admin_expense())
  WITH CHECK (public.is_super_admin_expense());

-- expense_vendors: all authenticated can read; admin+ can write
DROP POLICY IF EXISTS "expense_vendors_read" ON public.expense_vendors;
CREATE POLICY "expense_vendors_read" ON public.expense_vendors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_vendors_write" ON public.expense_vendors;
CREATE POLICY "expense_vendors_write" ON public.expense_vendors
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- expense_departments: all authenticated can read; admin+ can write
DROP POLICY IF EXISTS "expense_departments_read" ON public.expense_departments;
CREATE POLICY "expense_departments_read" ON public.expense_departments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_departments_write" ON public.expense_departments;
CREATE POLICY "expense_departments_write" ON public.expense_departments
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- expenses: admin+ can read all; super_admin can write
DROP POLICY IF EXISTS "expenses_read" ON public.expenses;
CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (public.is_super_admin_expense());

-- expense_allocations: follow expenses access
DROP POLICY IF EXISTS "expense_allocations_read" ON public.expense_allocations;
CREATE POLICY "expense_allocations_read" ON public.expense_allocations
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expense_allocations_write" ON public.expense_allocations;
CREATE POLICY "expense_allocations_write" ON public.expense_allocations
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- expense_import_batches
DROP POLICY IF EXISTS "expense_import_batches_read" ON public.expense_import_batches;
CREATE POLICY "expense_import_batches_read" ON public.expense_import_batches
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expense_import_batches_write" ON public.expense_import_batches;
CREATE POLICY "expense_import_batches_write" ON public.expense_import_batches
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- expense_source_mappings
DROP POLICY IF EXISTS "expense_source_mappings_read" ON public.expense_source_mappings;
CREATE POLICY "expense_source_mappings_read" ON public.expense_source_mappings
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "expense_source_mappings_write" ON public.expense_source_mappings;
CREATE POLICY "expense_source_mappings_write" ON public.expense_source_mappings
  FOR ALL TO authenticated
  USING (public.is_super_admin_expense())
  WITH CHECK (public.is_super_admin_expense());

-- recurring_expense_templates
DROP POLICY IF EXISTS "recurring_expense_templates_read" ON public.recurring_expense_templates;
CREATE POLICY "recurring_expense_templates_read" ON public.recurring_expense_templates
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "recurring_expense_templates_write" ON public.recurring_expense_templates;
CREATE POLICY "recurring_expense_templates_write" ON public.recurring_expense_templates
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- amex_raw_transactions
DROP POLICY IF EXISTS "amex_raw_transactions_read" ON public.amex_raw_transactions;
CREATE POLICY "amex_raw_transactions_read" ON public.amex_raw_transactions
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "amex_raw_transactions_write" ON public.amex_raw_transactions;
CREATE POLICY "amex_raw_transactions_write" ON public.amex_raw_transactions
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- amex_sync_logs
DROP POLICY IF EXISTS "amex_sync_logs_read" ON public.amex_sync_logs;
CREATE POLICY "amex_sync_logs_read" ON public.amex_sync_logs
  FOR SELECT TO authenticated USING (public.is_admin_or_above_expense());

DROP POLICY IF EXISTS "amex_sync_logs_write" ON public.amex_sync_logs;
CREATE POLICY "amex_sync_logs_write" ON public.amex_sync_logs
  FOR ALL TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- ── 7. SEED DATA — EXPENSE CATEGORIES ────────────────────────────────────────

DO $$
DECLARE
  v_payroll_id UUID;
  v_benefits_id UUID;
  v_amex_id UUID;
  v_utilities_id UUID;
  v_occupancy_id UUID;
  v_insurance_id UUID;
  v_compliance_id UUID;
  v_supplies_id UUID;
  v_marketing_id UUID;
  v_other_id UUID;
BEGIN
  -- Top-level categories
  INSERT INTO public.expense_categories (id, name, sort_order, is_active)
  VALUES
    (gen_random_uuid(), 'Payroll', 1, true),
    (gen_random_uuid(), 'Employee Benefits', 2, true),
    (gen_random_uuid(), 'American Express / Corporate Card', 3, true),
    (gen_random_uuid(), 'Utilities', 4, true),
    (gen_random_uuid(), 'Occupancy', 5, true),
    (gen_random_uuid(), 'Insurance', 6, true),
    (gen_random_uuid(), 'Regulatory / Compliance', 7, true),
    (gen_random_uuid(), 'Supplies', 8, true),
    (gen_random_uuid(), 'Marketing', 9, true),
    (gen_random_uuid(), 'Other', 10, true)
  ON CONFLICT (name) DO NOTHING;

  -- Fetch parent IDs
  SELECT id INTO v_payroll_id FROM public.expense_categories WHERE name = 'Payroll' LIMIT 1;
  SELECT id INTO v_benefits_id FROM public.expense_categories WHERE name = 'Employee Benefits' LIMIT 1;
  SELECT id INTO v_amex_id FROM public.expense_categories WHERE name = 'American Express / Corporate Card' LIMIT 1;
  SELECT id INTO v_utilities_id FROM public.expense_categories WHERE name = 'Utilities' LIMIT 1;
  SELECT id INTO v_occupancy_id FROM public.expense_categories WHERE name = 'Occupancy' LIMIT 1;
  SELECT id INTO v_insurance_id FROM public.expense_categories WHERE name = 'Insurance' LIMIT 1;
  SELECT id INTO v_compliance_id FROM public.expense_categories WHERE name = 'Regulatory / Compliance' LIMIT 1;

  -- Payroll subcategories
  IF v_payroll_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('Wages / Salary', v_payroll_id, 1, true),
      ('Contractor Payments', v_payroll_id, 2, true),
      ('Payroll Taxes', v_payroll_id, 3, true),
      ('Overtime', v_payroll_id, 4, true),
      ('Bonuses', v_payroll_id, 5, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Benefits subcategories
  IF v_benefits_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('Health Benefits', v_benefits_id, 1, true),
      ('401(k) Expense', v_benefits_id, 2, true),
      ('Other Benefits', v_benefits_id, 3, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Utilities subcategories
  IF v_utilities_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('Electric', v_utilities_id, 1, true),
      ('Gas', v_utilities_id, 2, true),
      ('Water', v_utilities_id, 3, true),
      ('Internet', v_utilities_id, 4, true),
      ('Phone / Telecom', v_utilities_id, 5, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Occupancy subcategories
  IF v_occupancy_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('Rent - Brick', v_occupancy_id, 1, true),
      ('Rent - Barnegat', v_occupancy_id, 2, true),
      ('Rent - Staten Island', v_occupancy_id, 3, true),
      ('Rent - Eatontown', v_occupancy_id, 4, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Insurance subcategories
  IF v_insurance_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('Business Insurance', v_insurance_id, 1, true),
      ('Liability Insurance', v_insurance_id, 2, true),
      ('Workers Compensation', v_insurance_id, 3, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Compliance subcategories
  IF v_compliance_id IS NOT NULL THEN
    INSERT INTO public.expense_categories (name, parent_category_id, sort_order, is_active)
    VALUES
      ('NJ DEP Fees', v_compliance_id, 1, true),
      ('Professional Licenses', v_compliance_id, 2, true),
      ('Compliance Fees', v_compliance_id, 3, true)
    ON CONFLICT (name) DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Expense category seed error: %', SQLERRM;
END $$;

-- ── 8. SEED DATA — EXPENSE DEPARTMENTS ───────────────────────────────────────

DO $$
BEGIN
  INSERT INTO public.expense_departments (name, sort_order, is_active)
  VALUES
    ('Front Desk / Admin', 1, true),
    ('Clinical', 2, true),
    ('Hygiene', 3, true),
    ('Doctors', 4, true),
    ('Marketing', 5, true),
    ('Lab', 6, true),
    ('Office Operations', 7, true),
    ('Supplies', 8, true),
    ('Management', 9, true),
    ('Other', 10, true)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Expense department seed error: %', SQLERRM;
END $$;

-- ── 9. SEED DATA — SOURCE MAPPINGS ───────────────────────────────────────────

DO $$
BEGIN
  INSERT INTO public.expense_source_mappings (source_system, source_field, target_field, is_active)
  VALUES
    ('amex_csv', 'Date', 'expense_date', true),
    ('amex_csv', 'Amount', 'amount', true),
    ('amex_csv', 'Description', 'merchant_name', true),
    ('amex_csv', 'Card Member', 'cardholder_name', true),
    ('amex_csv', 'Account #', 'card_last4', true),
    ('gusto', 'check_date', 'expense_date', true),
    ('gusto', 'gross_pay', 'amount', true),
    ('gusto', 'employee_name', 'cardholder_name', true),
    ('gusto', 'office_name', 'office_name', true)
  ON CONFLICT (source_system, source_field, target_field) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Source mapping seed error: %', SQLERRM;
END $$;
