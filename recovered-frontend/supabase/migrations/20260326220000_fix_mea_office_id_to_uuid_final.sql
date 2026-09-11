-- ============================================================
-- Migration: Definitive Fix — monthly_executive_analytics.office_id → UUID
-- Timestamp: 20260326220000
--
-- ROOT CAUSE (FINAL):
--   monthly_executive_analytics.office_id is TEXT with a CHECK constraint
--   for specific office names. However:
--   1. The EOD approval trigger (fn_sync_eod_to_monthly_analytics) was
--      oscillating between UUID and TEXT across multiple fix attempts,
--      causing persistent "column office_id is of type uuid but expression
--      is of type text" errors depending on which version was live.
--   2. DataEntryForm.jsx sends o?.id (UUID) as office_id, which fails
--      the TEXT CHECK constraint.
--   3. mea_is_office_manager_for() joins on o.name = p_office_id (TEXT),
--      which breaks when office_id is UUID.
--
-- DEFINITIVE FIX:
--   Convert monthly_executive_analytics.office_id to UUID (proper FK to
--   offices.id). Migrate any existing TEXT rows by resolving office names
--   back to UUIDs. Fix the trigger, all functions, and RLS policies to
--   use UUID consistently everywhere.
-- ============================================================

-- ─── Step 1: Drop all objects that depend on the office_id column ─────────────

-- Drop the UNIQUE constraint (depends on office_id column type)
ALTER TABLE public.monthly_executive_analytics
  DROP CONSTRAINT IF EXISTS monthly_executive_analytics_office_id_report_month_report_year_key;

-- Drop the CHECK constraint on office_id
ALTER TABLE public.monthly_executive_analytics
  DROP CONSTRAINT IF EXISTS monthly_executive_analytics_office_id_check;

-- Drop the index that references office_id
DROP INDEX IF EXISTS public.idx_mea_office_month_year;

-- Drop RLS policies that reference office_id (will be recreated)
DROP POLICY IF EXISTS "mea_select" ON public.monthly_executive_analytics;
DROP POLICY IF EXISTS "mea_insert" ON public.monthly_executive_analytics;
DROP POLICY IF EXISTS "mea_update" ON public.monthly_executive_analytics;
DROP POLICY IF EXISTS "mea_delete" ON public.monthly_executive_analytics;

-- Drop the trigger that fires on monthly_executive_analytics
DROP TRIGGER IF EXISTS trg_mea_updated_at ON public.monthly_executive_analytics;

-- ─── Step 2: Migrate existing TEXT office_id rows to UUID ─────────────────────
-- For any rows where office_id is a TEXT office name, resolve to UUID.
-- Rows that are already valid UUIDs are left untouched.
DO $$
DECLARE
  v_row RECORD;
  v_uuid UUID;
BEGIN
  FOR v_row IN
    SELECT id, office_id FROM public.monthly_executive_analytics
  LOOP
    -- Try to cast to UUID — if it fails, it's a TEXT name that needs resolving
    BEGIN
      v_uuid := v_row.office_id::UUID;
      -- Already a valid UUID — no action needed
    EXCEPTION WHEN invalid_text_representation THEN
      -- It's a TEXT office name — look up the UUID
      SELECT o.id INTO v_uuid
      FROM public.offices o
      WHERE o.name = v_row.office_id
      LIMIT 1;

      IF v_uuid IS NOT NULL THEN
        UPDATE public.monthly_executive_analytics
          SET office_id = v_uuid::TEXT
          WHERE id = v_row.id;
        RAISE NOTICE '[mea-fix] Migrated office_id "%" → % for row %',
          v_row.office_id, v_uuid, v_row.id;
      ELSE
        RAISE WARNING '[mea-fix] Could not resolve office name "%" to UUID — row % will be deleted to prevent constraint violation',
          v_row.office_id, v_row.id;
        DELETE FROM public.monthly_executive_analytics WHERE id = v_row.id;
      END IF;
    END;
  END LOOP;
END $$;

-- ─── Step 3: Change column type from TEXT to UUID ─────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ALTER COLUMN office_id TYPE UUID USING office_id::UUID;

-- ─── Step 4: Add NOT NULL constraint and FK to offices ────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ALTER COLUMN office_id SET NOT NULL;

-- Add FK constraint (idempotent via DROP IF EXISTS first)
ALTER TABLE public.monthly_executive_analytics
  DROP CONSTRAINT IF EXISTS fk_mea_office;

ALTER TABLE public.monthly_executive_analytics
  ADD CONSTRAINT fk_mea_office
  FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE RESTRICT;

-- ─── Step 5: Recreate UNIQUE constraint on UUID office_id ─────────────────────
ALTER TABLE public.monthly_executive_analytics
  DROP CONSTRAINT IF EXISTS uq_mea_office_month_year;

ALTER TABLE public.monthly_executive_analytics
  ADD CONSTRAINT uq_mea_office_month_year
  UNIQUE (office_id, report_month, report_year);

-- ─── Step 6: Recreate index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mea_office_month_year
  ON public.monthly_executive_analytics(office_id, report_month, report_year);

-- ─── Step 7: Fix fn_sync_eod_to_monthly_analytics — use UUID directly ─────────
-- This is the EOD approval trigger function. Now that office_id is UUID,
-- we insert NEW.office_id (UUID) directly — no name resolution needed.
CREATE OR REPLACE FUNCTION public.fn_sync_eod_to_monthly_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_month  INTEGER;
  v_report_year   INTEGER;
  v_production    NUMERIC;
  v_collections   NUMERIC;
  v_expenses      NUMERIC;
  v_new_patients  INTEGER;
BEGIN
  -- Only fire when status transitions TO 'approved'
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Skip if it was already approved (prevent re-processing on unrelated updates)
  IF OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Ensure office_id is present (UUID)
  IF NEW.office_id IS NULL THEN
    RAISE WARNING '[eod-analytics] office_id is NULL for entry id=%. Skipping analytics sync.', NEW.id;
    RETURN NEW;
  END IF;

  -- Verify the office exists in the offices table
  IF NOT EXISTS (SELECT 1 FROM public.offices WHERE id = NEW.office_id) THEN
    RAISE WARNING '[eod-analytics] office_id=% not found in offices table. Skipping analytics sync.', NEW.office_id;
    RETURN NEW;
  END IF;

  -- Derive month and year from the entry_date
  v_report_month := EXTRACT(MONTH FROM NEW.entry_date::DATE);
  v_report_year  := EXTRACT(YEAR  FROM NEW.entry_date::DATE);

  -- Aggregate ALL approved entries for this office + month + year
  SELECT
    COALESCE(SUM(COALESCE(de.production, 0) + COALESCE(de.total_production, 0)), 0),
    COALESCE(SUM(COALESCE(de.collection, 0) + COALESCE(de.total_collection, 0)), 0),
    COALESCE(SUM(COALESCE(de.expense_amount, 0)), 0),
    COALESCE(SUM(COALESCE(de.new_patients, 0)), 0)
  INTO
    v_production,
    v_collections,
    v_expenses,
    v_new_patients
  FROM public.daily_entries de
  WHERE de.office_id = NEW.office_id
    AND EXTRACT(MONTH FROM de.entry_date::DATE) = v_report_month
    AND EXTRACT(YEAR  FROM de.entry_date::DATE) = v_report_year
    AND de.status = 'approved';

  -- Upsert into monthly_executive_analytics using UUID office_id directly.
  -- ON CONFLICT (office_id, report_month, report_year) matches the UNIQUE
  -- constraint uq_mea_office_month_year on UUID office_id.
  INSERT INTO public.monthly_executive_analytics (
    office_id,
    report_month,
    report_year,
    production_total,
    collections_total,
    expenses_total,
    new_patients,
    data_source,
    updated_at
  )
  VALUES (
    NEW.office_id,   -- UUID — direct FK to offices.id
    v_report_month,
    v_report_year,
    v_production,
    v_collections,
    v_expenses,
    v_new_patients,
    'eod_approved',
    NOW()
  )
  ON CONFLICT (office_id, report_month, report_year)
  DO UPDATE SET
    production_total  = EXCLUDED.production_total,
    collections_total = EXCLUDED.collections_total,
    expenses_total    = EXCLUDED.expenses_total,
    new_patients      = EXCLUDED.new_patients,
    data_source       = 'eod_approved',
    updated_at        = NOW();

  RAISE NOTICE '[eod-analytics] Synced office_id=% month=% year=% prod=% coll=% exp=%',
    NEW.office_id, v_report_month, v_report_year, v_production, v_collections, v_expenses;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_eod_approval_sync_analytics ON public.daily_entries;
CREATE TRIGGER trg_eod_approval_sync_analytics
  AFTER UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_eod_to_monthly_analytics();

GRANT EXECUTE ON FUNCTION public.fn_sync_eod_to_monthly_analytics() TO authenticated;

-- ─── Step 8: Fix mea_is_office_manager_for — accept UUID, join on offices.id ──
-- Previously joined on o.name = p_office_id (TEXT). Now office_id is UUID,
-- so we accept UUID and join on o.id = p_office_id.
CREATE OR REPLACE FUNCTION public.mea_is_office_manager_for(p_office_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.user_office_assignments uoa ON uoa.user_id = up.id
    WHERE up.id = auth.uid()
      AND up.role::text = 'office_manager'
      AND up.is_active = true
      AND uoa.office_id = p_office_id
  );
$$;

-- ─── Step 9: Fix mea_is_admin_or_super — ensure it still works ────────────────
CREATE OR REPLACE FUNCTION public.mea_is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager')
      AND is_active = true
  );
$$;

-- ─── Step 10: Recreate updated_at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_mea_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mea_updated_at ON public.monthly_executive_analytics;
CREATE TRIGGER trg_mea_updated_at
  BEFORE UPDATE ON public.monthly_executive_analytics
  FOR EACH ROW EXECUTE FUNCTION public.fn_mea_set_updated_at();

-- ─── Step 11: Recreate RLS policies using UUID office_id ──────────────────────
ALTER TABLE public.monthly_executive_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mea_select" ON public.monthly_executive_analytics;
CREATE POLICY "mea_select"
  ON public.monthly_executive_analytics
  FOR SELECT
  TO authenticated
  USING (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_insert" ON public.monthly_executive_analytics;
CREATE POLICY "mea_insert"
  ON public.monthly_executive_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_update" ON public.monthly_executive_analytics;
CREATE POLICY "mea_update"
  ON public.monthly_executive_analytics
  FOR UPDATE
  TO authenticated
  USING (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  )
  WITH CHECK (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_delete" ON public.monthly_executive_analytics;
CREATE POLICY "mea_delete"
  ON public.monthly_executive_analytics
  FOR DELETE
  TO authenticated
  USING (
    public.mea_is_admin_or_super()
  );

-- ─── Step 12: Grant execute on updated functions ──────────────────────────────
GRANT EXECUTE ON FUNCTION public.mea_is_admin_or_super() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mea_is_office_manager_for(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_mea_set_updated_at() TO authenticated;

-- ─── Verification notice ──────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '[mea-fix] Migration 20260326220000 complete. monthly_executive_analytics.office_id is now UUID (FK → offices.id). EOD approval trigger uses UUID directly. All RLS policies updated.';
END $$;
