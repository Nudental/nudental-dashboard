-- Monthly Executive Digest: pg_cron schedule
-- Runs on the 1st of every month at 8:00 AM UTC
-- Follows the same pattern as rcm_weekly_digest_cron.sql

-- Ensure pg_cron and pg_net extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ensure management_settings table exists
CREATE TABLE IF NOT EXISTS public.management_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.management_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: super_admin can manage; authenticated can read
DROP POLICY IF EXISTS "super_admin_manage_management_settings" ON public.management_settings;
CREATE POLICY "super_admin_manage_management_settings"
ON public.management_settings
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "authenticated_read_management_settings" ON public.management_settings;
CREATE POLICY "authenticated_read_management_settings"
ON public.management_settings
FOR SELECT
TO authenticated
USING (true);

-- Remove existing cron job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'monthly-executive-digest'
  ) THEN
    PERFORM cron.unschedule('monthly-executive-digest');
  END IF;
END;
$$;

-- Schedule: 1st of every month at 8:00 AM UTC
SELECT cron.schedule(
  'monthly-executive-digest',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/monthly-executive-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Upsert default schedule config
INSERT INTO public.management_settings (setting_key, setting_value)
VALUES (
  'monthly_executive_email_schedule',
  '{"enabled": true, "recipients": {"ny": true, "maia": true}}'
)
ON CONFLICT (setting_key) DO NOTHING;
