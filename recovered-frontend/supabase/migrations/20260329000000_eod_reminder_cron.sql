-- Migration: EOD deadline reminder cron + rejection notification support
-- Schedules the eod-deadline-reminder edge function at 8:30 PM ET daily

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eod-deadline-reminder-830pm') THEN
    PERFORM cron.unschedule('eod-deadline-reminder-830pm');
  END IF;
END $$;

-- Schedule EOD deadline reminder at 8:30 PM UTC (adjust for ET: 8:30 PM ET = 00:30 AM UTC next day in EST, 01:30 AM UTC in EDT)
-- Using 00:30 UTC which corresponds to 8:30 PM EST (UTC-4 in summer = 20:30 ET = 00:30 UTC+1 day)
-- For Eastern Time (UTC-4 during EDT): 8:30 PM ET = 00:30 UTC
SELECT cron.schedule(
  'eod-deadline-reminder-830pm',
  '30 0 * * *',  -- 00:30 UTC = 8:30 PM ET (EDT, UTC-4)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/eod-deadline-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Add index on daily_entries for fast pending count queries used by the real-time indicator
CREATE INDEX IF NOT EXISTS idx_daily_entries_status_approved_at
  ON public.daily_entries (status, approved_at DESC NULLS LAST);

-- Add index for submitted_by + entry_date lookups (used by reminder to check if already submitted)
CREATE INDEX IF NOT EXISTS idx_daily_entries_submitted_by_date
  ON public.daily_entries (submitted_by, entry_date);
