-- ============================================================
-- RCM Weekly Digest pg_cron Schedule
-- Migration: 20260307100000_rcm_weekly_digest_cron.sql
-- Runs every Monday at 8:00 AM ET (13:00 UTC)
-- ============================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule if it exists (idempotent)
SELECT cron.unschedule('rcm-weekly-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'rcm-weekly-digest'
);

-- Schedule: every Monday at 13:00 UTC (8:00 AM ET)
SELECT cron.schedule(
  'rcm-weekly-digest',
  '0 13 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/rcm-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
