-- ============================================================
-- Migration: Fix EOD Approval Analytics Trigger — office_id UUID
-- Timestamp: 20260326200000
-- Root Cause Fixed:
--   fn_sync_eod_to_monthly_analytics was inserting v_office_name (TEXT)
--   into monthly_executive_analytics.office_id which is a UUID column
--   (FK → offices.id). This caused:
--   "column office_id is of type uuid but expression is of type text"
--   whenever an EOD report was approved.
--
-- Fix:
--   Replace the trigger function to insert NEW.office_id (UUID) directly.
--   Remove the office name resolution — it is not needed since the column
--   is now a UUID foreign key referencing offices.id.
-- ============================================================

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

  -- Upsert into monthly_executive_analytics using UUID office_id directly
  -- ON CONFLICT (office_id, report_month, report_year) → UPDATE totals
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
    NEW.office_id,      -- UUID — matches monthly_executive_analytics.office_id (UUID FK → offices.id)
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

-- Re-attach trigger (idempotent — DROP IF EXISTS first)
DROP TRIGGER IF EXISTS trg_eod_approval_sync_analytics ON public.daily_entries;
CREATE TRIGGER trg_eod_approval_sync_analytics
  AFTER UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_eod_to_monthly_analytics();

-- Grant execute
GRANT EXECUTE ON FUNCTION public.fn_sync_eod_to_monthly_analytics() TO authenticated;
