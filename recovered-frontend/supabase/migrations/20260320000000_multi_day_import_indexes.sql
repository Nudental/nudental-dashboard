-- ============================================================
-- Multi-Day Bulk Import: Performance Indexes & YTD Support
-- ============================================================
-- Adds composite indexes to optimize multi-day, multi-office
-- date range queries used by all dashboard modules after import.
-- ============================================================

-- Index: fast date-range queries for WTD/MTD/YTD aggregations
CREATE INDEX IF NOT EXISTS idx_daily_entries_entry_date
  ON public.daily_entries (entry_date);

-- Index: office + date range (Office Performance, Morning Huddle)
CREATE INDEX IF NOT EXISTS idx_daily_entries_office_date
  ON public.daily_entries (office_id, entry_date);

-- Index: provider + date range (Provider Performance scorecards)
CREATE INDEX IF NOT EXISTS idx_daily_entries_provider_date
  ON public.daily_entries (provider_name, entry_date)
  WHERE provider_name IS NOT NULL;

-- Index: office + date + provider (UPSERT lookup key)
CREATE INDEX IF NOT EXISTS idx_daily_entries_upsert_key
  ON public.daily_entries (office_id, entry_date, provider_name);

-- Index: submitted_by + date (audit trail for bulk imports)
CREATE INDEX IF NOT EXISTS idx_daily_entries_submitted_by
  ON public.daily_entries (submitted_by, entry_date)
  WHERE submitted_by IS NOT NULL;

-- Ensure the unique constraint for upsert deduplication is present
-- (idempotent: only creates if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_entries_office_date_provider_unique'
      AND conrelid = 'public.daily_entries'::regclass
  ) THEN
    ALTER TABLE public.daily_entries
      ADD CONSTRAINT daily_entries_office_date_provider_unique
      UNIQUE (office_id, entry_date, provider_name);
  END IF;
EXCEPTION
  WHEN others THEN
    -- Constraint may conflict with existing index; safe to skip
    NULL;
END;
$$;
