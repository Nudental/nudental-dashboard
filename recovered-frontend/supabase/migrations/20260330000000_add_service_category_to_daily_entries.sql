-- Migration: Add service_category column to daily_entries
-- Root cause: EOD form and bulk import both write service_category but the column was missing
-- from the daily_entries table, causing Supabase schema cache errors on submission.

ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS service_category TEXT;

-- Index for filtering/reporting by service category
CREATE INDEX IF NOT EXISTS idx_daily_entries_service_category
  ON public.daily_entries (service_category)
  WHERE service_category IS NOT NULL;
