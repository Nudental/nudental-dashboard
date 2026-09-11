-- ============================================================
-- Migration: EOD Post-Approval Workflow
-- Timestamp: 20260326230000
-- Purpose:
--   1. Add new status values: pending_reapproval, rejected_after_approval
--   2. Add columns to daily_entries for post-approval tracking
--   3. Add columns to eod_status_history for richer audit trail
--   4. Update fn_sync_eod_to_monthly_analytics to handle reversals
--      (when status changes FROM approved TO rejected/pending_reapproval,
--       remove or zero-out the analytics contribution of that entry)
--   5. Update RLS policies to allow post-approval edits by admins/regional managers
-- ============================================================

-- ─── 1. Add post-approval columns to daily_entries ───────────────────────────
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS rejected_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_by_name   TEXT,
  ADD COLUMN IF NOT EXISTS previous_status     TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS edited_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by_name      TEXT,
  ADD COLUMN IF NOT EXISTS edit_reason         TEXT,
  ADD COLUMN IF NOT EXISTS reapproval_note     TEXT,
  ADD COLUMN IF NOT EXISTS reapproved_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reapproved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reapproved_by_name  TEXT;

-- ─── 2. Add richer audit columns to eod_status_history ───────────────────────
ALTER TABLE public.eod_status_history
  ADD COLUMN IF NOT EXISTS event_type          TEXT,
  ADD COLUMN IF NOT EXISTS old_values          JSONB,
  ADD COLUMN IF NOT EXISTS new_values          JSONB,
  ADD COLUMN IF NOT EXISTS edit_reason         TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT,
  ADD COLUMN IF NOT EXISTS approval_reversal_reason TEXT;

-- ─── 3. Update fn_sync_eod_to_monthly_analytics to handle reversals ──────────
-- When an approved entry is moved back to rejected or pending_reapproval,
-- we must re-aggregate the monthly analytics WITHOUT that entry's data.
-- The trigger already aggregates ALL approved entries for the office/month/year,
-- so we just need to also fire when status transitions AWAY from 'approved'.
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
  v_office_id     UUID;
  v_entry_date    DATE;
BEGIN
  -- Determine which entry date and office to use
  -- For approval: use NEW values
  -- For reversal (approved → something else): use OLD values
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Transition TO approved — sync analytics
    v_office_id  := NEW.office_id;
    v_entry_date := NEW.entry_date::DATE;
  ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    -- Transition FROM approved — reverse/re-aggregate analytics
    v_office_id  := OLD.office_id;
    v_entry_date := OLD.entry_date::DATE;
  ELSE
    -- No analytics-relevant transition
    RETURN NEW;
  END IF;

  -- Ensure office_id is present
  IF v_office_id IS NULL THEN
    RAISE WARNING '[eod-analytics] office_id is NULL for entry id=%. Skipping analytics sync.', NEW.id;
    RETURN NEW;
  END IF;

  -- Verify the office exists
  IF NOT EXISTS (SELECT 1 FROM public.offices WHERE id = v_office_id) THEN
    RAISE WARNING '[eod-analytics] office_id=% not found in offices table. Skipping analytics sync.', v_office_id;
    RETURN NEW;
  END IF;

  v_report_month := EXTRACT(MONTH FROM v_entry_date);
  v_report_year  := EXTRACT(YEAR  FROM v_entry_date);

  -- Aggregate ALL currently-approved entries for this office + month + year
  -- (After the current row's status change is committed, this reflects the
  --  correct set of approved entries — including or excluding the changed row.)
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
  WHERE de.office_id = v_office_id
    AND EXTRACT(MONTH FROM de.entry_date::DATE) = v_report_month
    AND EXTRACT(YEAR  FROM de.entry_date::DATE) = v_report_year
    AND de.status = 'approved'
    AND de.id <> NEW.id;  -- Exclude the current row (its new status is not yet visible in the aggregate)

  -- If transitioning TO approved, include this row's values in the aggregate
  IF NEW.status = 'approved' THEN
    v_production   := v_production   + COALESCE(NEW.production, 0)   + COALESCE(NEW.total_production, 0);
    v_collections  := v_collections  + COALESCE(NEW.collection, 0)   + COALESCE(NEW.total_collection, 0);
    v_expenses     := v_expenses     + COALESCE(NEW.expense_amount, 0);
    v_new_patients := v_new_patients + COALESCE(NEW.new_patients, 0);
  END IF;
  -- If transitioning FROM approved, the current row is excluded (already done above)

  -- Upsert the re-aggregated totals
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
    v_office_id,
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

  RAISE NOTICE '[eod-analytics] Synced office_id=% month=% year=% prod=% coll=% exp=% (trigger by status: %→%)',
    v_office_id, v_report_month, v_report_year, v_production, v_collections, v_expenses, OLD.status, NEW.status;

  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_eod_approval_sync_analytics ON public.daily_entries;
CREATE TRIGGER trg_eod_approval_sync_analytics
  AFTER UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_eod_to_monthly_analytics();

GRANT EXECUTE ON FUNCTION public.fn_sync_eod_to_monthly_analytics() TO authenticated;

-- ─── 4. Update eod_status_stamp trigger to handle new statuses ───────────────
CREATE OR REPLACE FUNCTION public.eod_status_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Stamp submitted_at on first submission
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status <> 'pending') THEN
    NEW.submitted_at := now();
  END IF;
  -- Stamp approved_at when approved or re-approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    NEW.approved_at := now();
  END IF;
  -- Stamp rejected_at when rejected or rejected_after_approval
  IF NEW.status IN ('rejected', 'rejected_after_approval') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('rejected', 'rejected_after_approval')) THEN
    NEW.rejected_at := now();
  END IF;
  -- Record previous_status and status_changed_at on any status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.previous_status   := OLD.status;
    NEW.status_changed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_eod_status_stamp ON public.daily_entries;
CREATE TRIGGER trg_eod_status_stamp
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.eod_status_stamp();

-- ─── 5. Indexes for new status values ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_entries_pending_reapproval
  ON public.daily_entries(status)
  WHERE status = 'pending_reapproval';

CREATE INDEX IF NOT EXISTS idx_daily_entries_rejected_after_approval
  ON public.daily_entries(status)
  WHERE status = 'rejected_after_approval';

-- ─── 6. Update eod_status_history RLS to allow insert for all status changes ─
DROP POLICY IF EXISTS "eod_status_history_insert" ON public.eod_status_history;
CREATE POLICY "eod_status_history_insert"
  ON public.eod_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
  );

-- ─── 7. Ensure daily_entries UPDATE policy allows post-approval edits ─────────
-- The existing policy already allows admins/regional managers to update any row.
-- No change needed — the existing eod_daily_entries_update policy covers this.
-- Verify it exists (idempotent):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_entries'
      AND policyname = 'eod_daily_entries_update'
  ) THEN
    -- Recreate if somehow missing
    CREATE POLICY "eod_daily_entries_update"
      ON public.daily_entries
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR (public.is_office_manager() AND office_id = public.current_user_office_id())
          OR submitted_by = auth.uid()
        )
      )
      WITH CHECK (public.is_active_user());
  END IF;
END $$;
