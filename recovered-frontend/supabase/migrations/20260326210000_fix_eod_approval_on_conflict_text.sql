-- ============================================================
-- Migration: Fix EOD Approval ON CONFLICT — restore TEXT office_id in trigger
-- Timestamp: 20260326210000
--
-- ROOT CAUSE:
--   monthly_executive_analytics.office_id is TEXT (stores office names like
--   'Nu Dental of Eatontown') with UNIQUE (office_id, report_month, report_year).
--   Migration 20260326200000 changed the trigger to insert NEW.office_id (UUID)
--   into that TEXT column. PostgreSQL cannot match the ON CONFLICT target because
--   the UUID value fails the TEXT CHECK constraint, causing:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- FIX:
--   Restore the trigger to resolve the office NAME (TEXT) from the offices table
--   and insert that into monthly_executive_analytics.office_id — matching the
--   actual column type and the UNIQUE constraint that drives ON CONFLICT.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_eod_to_monthly_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office_name   TEXT;
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

  -- Ensure office_id is present
  IF NEW.office_id IS NULL THEN
    RAISE WARNING '[eod-analytics] office_id is NULL for entry id=%. Skipping analytics sync.', NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve office NAME (TEXT) from offices table.
  -- monthly_executive_analytics.office_id is TEXT storing office names,
  -- with UNIQUE (office_id, report_month, report_year) on those TEXT values.
  SELECT name INTO v_office_name
  FROM public.offices
  WHERE id = NEW.office_id
  LIMIT 1;

  IF v_office_name IS NULL THEN
    RAISE WARNING '[eod-analytics] Could not resolve office name for office_id=%. Skipping analytics sync.', NEW.office_id;
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

  -- Upsert into monthly_executive_analytics using TEXT office name.
  -- ON CONFLICT (office_id, report_month, report_year) matches the UNIQUE constraint
  -- defined in 20260322000000_executive_monthly_analytics.sql which is on TEXT office_id.
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
    v_office_name,    -- TEXT office name — matches monthly_executive_analytics.office_id (TEXT)
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

  RAISE NOTICE '[eod-analytics] Synced office=% month=% year=% prod=% coll=% exp=%',
    v_office_name, v_report_month, v_report_year, v_production, v_collections, v_expenses;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_eod_approval_sync_analytics ON public.daily_entries;
CREATE TRIGGER trg_eod_approval_sync_analytics
  AFTER UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_eod_to_monthly_analytics();

-- Grant execute
GRANT EXECUTE ON FUNCTION public.fn_sync_eod_to_monthly_analytics() TO authenticated;
