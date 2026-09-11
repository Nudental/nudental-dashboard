-- ============================================================
-- DATA PIPELINE AUDIT & RECONCILIATION TABLES
-- Migration: 20260410100000_data_pipeline_audit_tables.sql
-- ============================================================

-- ── 1. ENUM TYPES ────────────────────────────────────────────

DROP TYPE IF EXISTS public.sync_status_type CASCADE;
CREATE TYPE public.sync_status_type AS ENUM (
  'pending', 'running', 'success', 'partial', 'error', 'conflict', 'skipped'
);

DROP TYPE IF EXISTS public.conflict_severity CASCADE;
CREATE TYPE public.conflict_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

DROP TYPE IF EXISTS public.conflict_resolution_type CASCADE;
CREATE TYPE public.conflict_resolution_type AS ENUM (
  'pending', 'use_ascend', 'use_manual', 'merged', 'flagged', 'ignored'
);

DROP TYPE IF EXISTS public.endpoint_health_type CASCADE;
CREATE TYPE public.endpoint_health_type AS ENUM (
  'healthy', 'degraded', 'failing', 'unmapped', 'deprecated', 'untested'
);

-- ── 2. API ENDPOINT REGISTRY ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_endpoint_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_key TEXT NOT NULL UNIQUE,
  endpoint_path TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'GET',
  description TEXT,
  target_table TEXT,
  target_columns JSONB DEFAULT '[]'::jsonb,
  field_mapping JSONB DEFAULT '{}'::jsonb,
  health_status public.endpoint_health_type DEFAULT 'untested',
  last_tested_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  is_active BOOLEAN DEFAULT true,
  supports_date_range BOOLEAN DEFAULT false,
  supports_office_filter BOOLEAN DEFAULT false,
  backfill_start_date DATE DEFAULT '2022-04-01',
  backfill_completed BOOLEAN DEFAULT false,
  backfill_last_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_registry_key ON public.api_endpoint_registry(endpoint_key);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_registry_health ON public.api_endpoint_registry(health_status);

-- ── 3. DATA SYNC LOGS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL DEFAULT gen_random_uuid(),
  endpoint_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  date_range_start DATE,
  date_range_end DATE,
  status public.sync_status_type NOT NULL DEFAULT 'pending',
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_conflicted INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  is_backfill BOOLEAN DEFAULT false,
  is_dry_run BOOLEAN DEFAULT false,
  triggered_by TEXT DEFAULT 'system',
  triggered_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  error_details JSONB,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_sync_logs_job_id ON public.data_sync_logs(sync_job_id);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_endpoint ON public.data_sync_logs(endpoint_key);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_status ON public.data_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_office ON public.data_sync_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_started ON public.data_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_backfill ON public.data_sync_logs(is_backfill, date_range_start);

-- ── 4. RECONCILIATION CONFLICTS ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.reconciliation_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id UUID REFERENCES public.data_sync_logs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  source_module TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  record_date DATE,
  record_id_manual TEXT,
  record_id_ascend TEXT,
  field_name TEXT NOT NULL,
  manual_value TEXT,
  ascend_value TEXT,
  expected_value TEXT,
  actual_value TEXT,
  conflict_type TEXT NOT NULL,
  severity public.conflict_severity DEFAULT 'medium',
  resolution public.conflict_resolution_type DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  recommended_action TEXT,
  is_auto_resolvable BOOLEAN DEFAULT false,
  confidence_score NUMERIC(4,2),
  detected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_entity ON public.reconciliation_conflicts(entity_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_office ON public.reconciliation_conflicts(office_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_resolution ON public.reconciliation_conflicts(resolution);
CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_severity ON public.reconciliation_conflicts(severity);
CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_date ON public.reconciliation_conflicts(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_conflicts_detected ON public.reconciliation_conflicts(detected_at DESC);

-- ── 5. ASCEND IMPORT AUDIT TRAIL ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.ascend_import_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id UUID REFERENCES public.data_sync_logs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  record_date DATE,
  ascend_record_id TEXT,
  target_table TEXT NOT NULL,
  target_record_id UUID,
  operation TEXT NOT NULL,
  original_manual_values JSONB,
  imported_ascend_values JSONB NOT NULL,
  final_stored_values JSONB,
  field_mapping_used JSONB,
  normalization_applied JSONB,
  was_duplicate BOOLEAN DEFAULT false,
  was_conflict BOOLEAN DEFAULT false,
  conflict_id UUID REFERENCES public.reconciliation_conflicts(id) ON DELETE SET NULL,
  import_status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ascend_import_audit_entity ON public.ascend_import_audit(entity_type);
CREATE INDEX IF NOT EXISTS idx_ascend_import_audit_office ON public.ascend_import_audit(office_id);
CREATE INDEX IF NOT EXISTS idx_ascend_import_audit_date ON public.ascend_import_audit(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_ascend_import_audit_table ON public.ascend_import_audit(target_table);
CREATE INDEX IF NOT EXISTS idx_ascend_import_audit_synced ON public.ascend_import_audit(synced_at DESC);

-- ── 6. DATA HEALTH ALERTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity public.conflict_severity DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  affected_module TEXT,
  affected_table TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  date_range_start DATE,
  date_range_end DATE,
  endpoint_key TEXT,
  error_details JSONB,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_health_alerts_type ON public.data_health_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_data_health_alerts_resolved ON public.data_health_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_data_health_alerts_severity ON public.data_health_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_data_health_alerts_created ON public.data_health_alerts(created_at DESC);

-- ── 7. ENABLE RLS ────────────────────────────────────────────

ALTER TABLE public.api_endpoint_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ascend_import_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_health_alerts ENABLE ROW LEVEL SECURITY;

-- ── 8. HELPER FUNCTION ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
$$;

-- ── 9. RLS POLICIES ──────────────────────────────────────────

DROP POLICY IF EXISTS "admin_manage_api_endpoint_registry" ON public.api_endpoint_registry;
CREATE POLICY "admin_manage_api_endpoint_registry"
ON public.api_endpoint_registry FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "admin_manage_data_sync_logs" ON public.data_sync_logs;
CREATE POLICY "admin_manage_data_sync_logs"
ON public.data_sync_logs FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "admin_manage_reconciliation_conflicts" ON public.reconciliation_conflicts;
CREATE POLICY "admin_manage_reconciliation_conflicts"
ON public.reconciliation_conflicts FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "admin_manage_ascend_import_audit" ON public.ascend_import_audit;
CREATE POLICY "admin_manage_ascend_import_audit"
ON public.ascend_import_audit FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "admin_manage_data_health_alerts" ON public.data_health_alerts;
CREATE POLICY "admin_manage_data_health_alerts"
ON public.data_health_alerts FOR ALL TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

-- ── 10. SEED ENDPOINT REGISTRY ───────────────────────────────

INSERT INTO public.api_endpoint_registry (
  endpoint_key, endpoint_path, http_method, description,
  target_table, target_columns, field_mapping,
  supports_date_range, supports_office_filter, backfill_start_date, notes
) VALUES
(
  'health',
  '/health',
  'GET',
  'Ascend API health check endpoint',
  NULL,
  '[]'::jsonb,
  '{}'::jsonb,
  false, false, '2022-04-01',
  'Used for connectivity checks only'
),
(
  'daily_summary',
  '/v2/reports/daily-summary',
  'GET',
  'Daily production, collections, and adjustment summary',
  'daily_entries',
  '["entry_date","production_total","collections_total","adjustments_net","office_id"]'::jsonb,
  '{"date":"entry_date","grossProduction":"production_total","collections":"collections_total","adjustments":"adjustments_net","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Primary daily financial data source'
),
(
  'monthly_summary',
  '/v2/reports/monthly-summary',
  'GET',
  'Monthly aggregated production and collections',
  'monthly_executive_analytics',
  '["report_month","report_year","production_total","collections_total","office_id"]'::jsonb,
  '{"month":"report_month","year":"report_year","grossProduction":"production_total","collections":"collections_total","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Maps to monthly_executive_analytics table'
),
(
  'production_summary',
  '/v2/production/summary',
  'GET',
  'Production totals by date range',
  'daily_entries',
  '["entry_date","production_total","office_id"]'::jsonb,
  '{"date":"entry_date","production":"production_total","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Used for production trend calculations'
),
(
  'collections_summary',
  '/v2/collections/summary',
  'GET',
  'Collections totals by date range',
  'daily_entries',
  '["entry_date","collections_total","office_id"]'::jsonb,
  '{"date":"entry_date","collections":"collections_total","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Used for collection rate calculations'
),
(
  'appointments',
  '/v2/appointments',
  'GET',
  'Appointment schedule and completion data',
  'daily_entries',
  '["entry_date","scheduled_patients","seen_patients","broken_appointments","office_id"]'::jsonb,
  '{"date":"entry_date","scheduledCount":"scheduled_patients","completedCount":"seen_patients","noShowCount":"broken_appointments","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Maps no-shows to broken_appointments field'
),
(
  'providers',
  '/v2/providers',
  'GET',
  'Provider list and profile data',
  'providers',
  '["id","name","office_id","provider_type","is_active"]'::jsonb,
  '{"providerId":"ascend_provider_id","name":"name","locationId":"office_id","type":"provider_type","active":"is_active"}'::jsonb,
  false, false, '2022-04-01',
  'Used for provider normalization and matching'
),
(
  'offices',
  '/v2/offices',
  'GET',
  'Office/location list and metadata',
  'offices',
  '["id","name","address","is_active"]'::jsonb,
  '{"locationId":"ascend_location_id","name":"name","address":"address","active":"is_active"}'::jsonb,
  false, false, '2022-04-01',
  'Used for office normalization and UUID mapping'
),
(
  'production_by_provider',
  '/v2/production/by-provider',
  'GET',
  'Production breakdown by provider',
  'daily_entries',
  '["entry_date","production_total","provider_id","office_id"]'::jsonb,
  '{"date":"entry_date","production":"production_total","providerId":"provider_id","locationId":"office_id"}'::jsonb,
  true, true, '2022-04-01',
  'Critical for provider performance calculations'
),
(
  'goals',
  '/v2/goals',
  'GET',
  'Production and collection goals by office',
  'office_goals',
  '["office_id","goal_month","goal_year","production_goal","collection_goal"]'::jsonb,
  '{"locationId":"office_id","month":"goal_month","year":"goal_year","productionGoal":"production_goal","collectionGoal":"collection_goal"}'::jsonb,
  false, true, '2022-04-01',
  'Maps to office_goals table'
)
ON CONFLICT (endpoint_key) DO UPDATE SET
  endpoint_path = EXCLUDED.endpoint_path,
  description = EXCLUDED.description,
  target_table = EXCLUDED.target_table,
  target_columns = EXCLUDED.target_columns,
  field_mapping = EXCLUDED.field_mapping,
  supports_date_range = EXCLUDED.supports_date_range,
  supports_office_filter = EXCLUDED.supports_office_filter,
  updated_at = now();
