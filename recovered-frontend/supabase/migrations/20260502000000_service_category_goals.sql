-- Migration: service_category_goals table
-- V276 — Service Category Goals with 15% prior-year growth seeding
-- Timestamp: 20260502000000
-- IMPORTANT: Does NOT modify office_goals or any existing goal tables.

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_category_goals (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id                uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  month_year               text NOT NULL,                        -- 'YYYY-MM'
  service_category         text NOT NULL,                        -- matches serviceCategory from /v2/production/by-cdt-category
  net_production_goal      numeric(12,2)   NULL,                 -- NULL = no goal / N/A; 0 = intentional zero
  procedure_count_goal     integer         NULL,
  unique_patient_goal      integer         NULL,
  growth_rate              numeric(6,4)    NOT NULL DEFAULT 0.15,
  baseline_year            integer         NULL,
  baseline_month_year      text            NULL,                 -- 'YYYY-MM' of the prior-year month used as baseline
  baseline_net_production  numeric(12,2)   NULL,
  baseline_procedure_count integer         NULL,
  baseline_unique_patients integer         NULL,
  generated_from           text            NULL,                 -- e.g. 'auto_15pct_growth' or 'manual'
  notes                    text            NULL,
  is_active                boolean         NOT NULL DEFAULT true,
  created_by               uuid            NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by               uuid            NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at               timestamptz     NOT NULL DEFAULT now(),
  updated_at               timestamptz     NOT NULL DEFAULT now(),
  UNIQUE(office_id, month_year, service_category)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scg_office_month
  ON public.service_category_goals(office_id, month_year);

CREATE INDEX IF NOT EXISTS idx_scg_month_year
  ON public.service_category_goals(month_year);

CREATE INDEX IF NOT EXISTS idx_scg_service_category
  ON public.service_category_goals(service_category);

-- ─── updated_at trigger (reuse existing fn_set_updated_at if present) ─────────
-- fn_set_updated_at is already defined in 20260228080000_office_goals.sql
-- Just add the trigger for the new table.
DROP TRIGGER IF EXISTS trg_service_category_goals_updated_at ON public.service_category_goals;
CREATE TRIGGER trg_service_category_goals_updated_at
  BEFORE UPDATE ON public.service_category_goals
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.service_category_goals ENABLE ROW LEVEL SECURITY;

-- All active users may read service category goals (same as office_goals_select)
DROP POLICY IF EXISTS "scg_select" ON public.service_category_goals;
CREATE POLICY "scg_select"
  ON public.service_category_goals
  FOR SELECT
  USING (
    public.is_active_user()
  );

-- Only super_admin and admin may insert
DROP POLICY IF EXISTS "scg_insert" ON public.service_category_goals;
CREATE POLICY "scg_insert"
  ON public.service_category_goals
  FOR INSERT
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- Only super_admin and admin may update
DROP POLICY IF EXISTS "scg_update" ON public.service_category_goals;
CREATE POLICY "scg_update"
  ON public.service_category_goals
  FOR UPDATE
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- Only super_admin may delete
DROP POLICY IF EXISTS "scg_delete" ON public.service_category_goals;
CREATE POLICY "scg_delete"
  ON public.service_category_goals
  FOR DELETE
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );
