-- Migration: Add unique constraint to daily_entries for smart upsert
-- Enables ON CONFLICT upsert on (office_id, entry_date, provider_name)

-- Step 1: Add a unique index on (office_id, entry_date, provider_name)
-- Using a partial unique index to handle NULLs in provider_name gracefully
-- We coalesce provider_name to empty string for the constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_entries_upsert_key
  ON public.daily_entries (office_id, entry_date, COALESCE(provider_name, ''));

-- Step 2: Add a helper function to resolve office_id from office name (trimmed, case-insensitive)
CREATE OR REPLACE FUNCTION public.resolve_office_id_by_name(office_name_input TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM public.offices
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(office_name_input))
    AND is_active = true
  LIMIT 1;
$$;

-- Step 3: Add performance indexes for WTD/MTD queries
CREATE INDEX IF NOT EXISTS idx_daily_entries_entry_date
  ON public.daily_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_daily_entries_office_date
  ON public.daily_entries (office_id, entry_date);
