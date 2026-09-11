-- ============================================================
-- Migration: Auto-insert EOD approved data into Executive Monthly Analytics
-- Timestamp: 20260328000000
-- Purpose:
--   When a Regional Manager approves an EOD report (daily_entries.status → 'approved'),
--   automatically aggregate and upsert production/collection/expense totals into
--   monthly_executive_analytics for the corresponding office/month/year.
--   Includes dedupe check via ON CONFLICT upsert — safe to re-approve or re-run.
-- ============================================================

-- ─── Helper: Aggregate approved daily_entries into monthly_executive_analytics ─
-- Called by trigger after each approval. Sums all approved rows for the same
-- office + month + year and upserts the result.
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

  -- Resolve office name from offices table (monthly_executive_analytics uses name as office_id)
  SELECT name INTO v_office_name
  FROM public.offices
  WHERE id = NEW.office_id
  LIMIT 1;

  IF v_office_name IS NULL THEN
    -- Cannot map to analytics without office name — log and skip gracefully
    RAISE WARNING '[eod-analytics] Could not resolve office name for office_id=%. Skipping analytics sync.', NEW.office_id;
    RETURN NEW;
  END IF;

  -- Derive month and year from the entry_date
  v_report_month := EXTRACT(MONTH FROM NEW.entry_date::DATE);
  v_report_year  := EXTRACT(YEAR  FROM NEW.entry_date::DATE);

  -- Aggregate ALL approved entries for this office + month + year
  -- This ensures the monthly total is always accurate even if multiple
  -- entries are approved over time (additive, not just the single row).
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

  -- Upsert into monthly_executive_analytics
  -- ON CONFLICT (office_id, report_month, report_year) → UPDATE totals
  -- This is the dedupe check: if a record already exists for this office/month/year,
  -- it updates the totals rather than inserting a duplicate.
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
    v_office_name,
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

-- ─── Attach trigger to daily_entries ─────────────────────────────────────────
-- Fires AFTER UPDATE so the row is fully committed before we aggregate.
DROP TRIGGER IF EXISTS trg_eod_approval_sync_analytics ON public.daily_entries;
CREATE TRIGGER trg_eod_approval_sync_analytics
  AFTER UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_eod_to_monthly_analytics();

-- ─── Grant execute on the function to authenticated role ─────────────────────
-- The trigger runs as SECURITY DEFINER so it bypasses RLS for the insert/update,
-- but we still need the authenticated role to be able to call it indirectly.
GRANT EXECUTE ON FUNCTION public.fn_sync_eod_to_monthly_analytics() TO authenticated;

-- ─── Index: speed up the aggregate query inside the trigger ──────────────────
CREATE INDEX IF NOT EXISTS idx_daily_entries_approved_office_date
  ON public.daily_entries (office_id, entry_date, status)
  WHERE status = 'approved';
