-- ============================================================
-- Department Category for Supply Request Module
-- Migration: 20260308000000_department_category_supply.sql
-- ============================================================

-- ── 1. ENUM TYPE ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.supply_department_category AS ENUM ('Front Desk', 'Back Staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. ADD COLUMNS ────────────────────────────────────────────────────────

-- supply_items: add department_category
ALTER TABLE public.supply_items
  ADD COLUMN IF NOT EXISTS department_category public.supply_department_category DEFAULT 'Back Staff';

-- supply_request_batches: add department_category
ALTER TABLE public.supply_request_batches
  ADD COLUMN IF NOT EXISTS department_category public.supply_department_category;

-- supply_request_items: add department_category
ALTER TABLE public.supply_request_items
  ADD COLUMN IF NOT EXISTS department_category public.supply_department_category;

-- ── 3. TAG EXISTING SUPPLY ITEMS ─────────────────────────────────────────

-- First, tag items in Front Desk / Patient Care departments
UPDATE public.supply_items
SET department_category = 'Front Desk'
WHERE department_id IN (
  SELECT id FROM public.supply_departments
  WHERE LOWER(name) LIKE '%front desk%'
     OR LOWER(name) LIKE '%patient care%'
     OR LOWER(name) LIKE '%reception%'
     OR LOWER(name) LIKE '%administrative%'
     OR LOWER(name) LIKE '%front office%'
);

-- Tag items by name keywords that are Front Desk supplies
UPDATE public.supply_items
SET department_category = 'Front Desk'
WHERE department_category = 'Back Staff'
  AND (
    LOWER(name) LIKE '%paper%'
    OR LOWER(name) LIKE '%pen%'
    OR LOWER(name) LIKE '%toner%'
    OR LOWER(name) LIKE '%clipboard%'
    OR LOWER(name) LIKE '%receipt%'
    OR LOWER(name) LIKE '%consent form%'
    OR LOWER(name) LIKE '%consent%'
    OR LOWER(name) LIKE '%appointment card%'
    OR LOWER(name) LIKE '%business card%'
    OR LOWER(name) LIKE '%referral%'
    OR LOWER(name) LIKE '%sticky note%'
    OR LOWER(name) LIKE '%printer%'
    OR LOWER(name) LIKE '%tissue box%'
    OR LOWER(name) LIKE '%hand sanitizer%'
    OR LOWER(name) LIKE '%water%'
    OR LOWER(name) LIKE '%cup%'
    OR LOWER(name) LIKE '%bottled%'
    OR LOWER(name) LIKE '%staple%'
    OR LOWER(name) LIKE '%folder%'
    OR LOWER(name) LIKE '%envelope%'
    OR LOWER(name) LIKE '%label%'
    OR LOWER(name) LIKE '%stamp%'
    OR LOWER(name) LIKE '%binder%'
    OR LOWER(name) LIKE '%notepad%'
    OR LOWER(name) LIKE '%highlighter%'
    OR LOWER(name) LIKE '%marker%'
    OR LOWER(name) LIKE '%tape%'
    OR LOWER(name) LIKE '%scissors%'
    OR LOWER(name) LIKE '%rubber band%'
    OR LOWER(name) LIKE '%paper clip%'
    OR LOWER(name) LIKE '%whiteboard%'
    OR LOWER(name) LIKE '%dry erase%'
  );

-- All remaining items default to 'Back Staff' (already set as default)

-- ── 4. UNIQUE INDEX for one batch per dept per office per month ───────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_request_batches_dept_office_month
  ON public.supply_request_batches (office_id, request_month, department_category)
  WHERE batch_status NOT IN ('rejected') AND department_category IS NOT NULL;

-- ── 5. INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supply_items_dept_category
  ON public.supply_items (department_category);

CREATE INDEX IF NOT EXISTS idx_supply_request_batches_dept_category
  ON public.supply_request_batches (department_category);
