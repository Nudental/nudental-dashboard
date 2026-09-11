-- ─────────────────────────────────────────────────────────────────────────────
-- Dentrix Ascend Import Audit & Endpoint Registry
-- Migration: 20260410200000_dentrix_import_audit.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Dentrix endpoint registry ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dentrix_endpoint_registry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_key          TEXT NOT NULL UNIQUE,
  endpoint_name         TEXT NOT NULL,
  endpoint_path         TEXT NOT NULL,
  description           TEXT,
  supports_location     BOOLEAN DEFAULT true,
  supports_date_range   BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  priority              INTEGER DEFAULT 10,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ─── Import audit log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID NOT NULL,                        -- groups all entries for one sync run
  office_id             UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name           TEXT,
  location_id           TEXT,                                 -- Dentrix locationId
  endpoint_key          TEXT NOT NULL,
  endpoint_name         TEXT,
  endpoint_path         TEXT,
  sync_type             TEXT NOT NULL DEFAULT 'manual',       -- historical | manual | scheduled | incremental
  status                TEXT NOT NULL DEFAULT 'pending',      -- Success | Partial Success | No Data Returned | Failed | Skipped
  reason                TEXT,                                 -- human-readable reason message
  records_fetched       INTEGER DEFAULT 0,
  records_imported      INTEGER DEFAULT 0,
  records_skipped       INTEGER DEFAULT 0,
  records_failed        INTEGER DEFAULT 0,
  response_status_code  INTEGER,
  error_code            TEXT,
  error_details         JSONB,
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  duration_ms           INTEGER,
  next_retry_at         TIMESTAMPTZ,
  retry_count           INTEGER DEFAULT 0,
  triggered_by          TEXT DEFAULT 'system',
  triggered_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_system         TEXT DEFAULT 'Dentrix Ascend',
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_import_audit_run_id        ON public.import_audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_office_id     ON public.import_audit_log(office_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_endpoint_key  ON public.import_audit_log(endpoint_key);
CREATE INDEX IF NOT EXISTS idx_import_audit_status        ON public.import_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_import_audit_sync_type     ON public.import_audit_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_import_audit_started_at    ON public.import_audit_log(started_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.dentrix_endpoint_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_audit_log          ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dentrix_endpoint_registry' AND policyname = 'admin_all_dentrix_endpoint_registry'
  ) THEN
    CREATE POLICY admin_all_dentrix_endpoint_registry ON public.dentrix_endpoint_registry
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'import_audit_log' AND policyname = 'admin_all_import_audit_log'
  ) THEN
    CREATE POLICY admin_all_import_audit_log ON public.import_audit_log
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- ─── Seed endpoint registry ───────────────────────────────────────────────────
INSERT INTO public.dentrix_endpoint_registry
  (endpoint_key, endpoint_name, endpoint_path, description, supports_location, supports_date_range, priority)
VALUES
  ('daily_summary',         'Daily Summary',            '/v2/reports/daily-summary',         'Daily production, collections, and patient summary',           true,  true,  1),
  ('monthly_summary',       'Monthly Summary',          '/v2/reports/monthly-summary',       'Monthly aggregated financial and operational summary',          true,  true,  2),
  ('production_summary',    'Production Summary',       '/v2/production/summary',            'Gross production totals by date range',                        true,  true,  3),
  ('collections_summary',   'Collections Summary',      '/v2/collections/summary',           'Collections totals by date range',                             true,  true,  4),
  ('production_by_provider','Production by Provider',   '/v2/production/by-provider',        'Provider-level production breakdown',                          true,  true,  5),
  ('provider_performance',  'Provider Performance',     '/v2/provider-performance',          'Provider KPIs including case acceptance and collections',      true,  true,  6),
  ('appointments',          'Appointments',             '/v2/appointments',                  'Scheduled, completed, and cancelled appointments',             true,  true,  7),
  ('providers',             'Providers',                '/v2/providers',                     'Provider roster for a location',                               true,  false, 8),
  ('goals',                 'Goals',                    '/v2/goals',                         'Production and collection goals by location',                  true,  false, 9),
  ('offices',               'Offices',                  '/v2/offices',                       'Office/location metadata',                                     false, false, 10)
ON CONFLICT (endpoint_key) DO NOTHING;
