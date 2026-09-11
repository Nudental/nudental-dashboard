-- ══════════════════════════════════════════════════════════════════════════════
-- BENCHMARK RECONCILIATION TABLE — eAssist Daily Reports 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- Purpose: Row-level validation source for Nu Dashboard vs eAssist benchmark.
-- Offices covered: Barnegat, Brick, Eatontown (NOT Staten Island in this dataset)
-- Date range: 2026-02-18 through 2026-04-22
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Benchmark table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benchmark_eassist_daily_reports_2026 (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date               date NOT NULL,
  report_month              text NOT NULL,
  office_raw                text NOT NULL,
  office_canonical          text NOT NULL,
  office_id                 uuid REFERENCES public.offices(id) ON DELETE SET NULL,

  daily_production          numeric(14,2) NOT NULL DEFAULT 0,
  daily_adj                 numeric(14,2) NOT NULL DEFAULT 0,
  net_daily_production      numeric(14,2) NOT NULL DEFAULT 0,

  daily_insurance_coll      numeric(14,2) NOT NULL DEFAULT 0,
  daily_patient_coll        numeric(14,2) NOT NULL DEFAULT 0,
  daily_total_coll          numeric(14,2) NOT NULL DEFAULT 0,

  monthly_production        numeric(14,2) NOT NULL DEFAULT 0,
  monthly_adj               numeric(14,2) NOT NULL DEFAULT 0,
  net_monthly_production    numeric(14,2) NOT NULL DEFAULT 0,

  monthly_insurance_coll    numeric(14,2) NOT NULL DEFAULT 0,
  monthly_patient_coll      numeric(14,2) NOT NULL DEFAULT 0,
  total_monthly_coll        numeric(14,2) NOT NULL DEFAULT 0,

  dashboard_daily_production      numeric(14,2),
  dashboard_daily_adj             numeric(14,2),
  dashboard_net_daily_production  numeric(14,2),
  dashboard_daily_insurance_coll  numeric(14,2),
  dashboard_daily_patient_coll    numeric(14,2),
  dashboard_daily_total_coll      numeric(14,2),
  dashboard_monthly_production    numeric(14,2),
  dashboard_monthly_adj           numeric(14,2),
  dashboard_net_monthly_production numeric(14,2),
  dashboard_monthly_insurance_coll numeric(14,2),
  dashboard_monthly_patient_coll  numeric(14,2),
  dashboard_total_monthly_coll    numeric(14,2),

  mismatch_daily_production       boolean GENERATED ALWAYS AS (
    dashboard_daily_production IS NOT NULL AND
    ABS(daily_production - dashboard_daily_production) > 1.00
  ) STORED,
  mismatch_net_daily_production   boolean GENERATED ALWAYS AS (
    dashboard_net_daily_production IS NOT NULL AND
    ABS(net_daily_production - dashboard_net_daily_production) > 1.00
  ) STORED,
  mismatch_daily_total_coll       boolean GENERATED ALWAYS AS (
    dashboard_daily_total_coll IS NOT NULL AND
    ABS(daily_total_coll - dashboard_daily_total_coll) > 1.00
  ) STORED,
  mismatch_monthly_production     boolean GENERATED ALWAYS AS (
    dashboard_monthly_production IS NOT NULL AND
    ABS(monthly_production - dashboard_monthly_production) > 1.00
  ) STORED,
  mismatch_net_monthly_production boolean GENERATED ALWAYS AS (
    dashboard_net_monthly_production IS NOT NULL AND
    ABS(net_monthly_production - dashboard_net_monthly_production) > 1.00
  ) STORED,
  mismatch_total_monthly_coll     boolean GENERATED ALWAYS AS (
    dashboard_total_monthly_coll IS NOT NULL AND
    ABS(total_monthly_coll - dashboard_total_monthly_coll) > 1.00
  ) STORED,

  source                    text NOT NULL DEFAULT 'eassist_daily_report_2026',
  imported_at               timestamptz NOT NULL DEFAULT now(),
  reconciled_at             timestamptz,
  notes                     text
);

-- ─── Handle legacy office_name column (pre-existing table from prior migration run) ─
-- If the table was created in a prior partial run with an office_name column,
-- remove the NOT NULL constraint and set a default so INSERTs don't fail.

DO $$
BEGIN
  -- Drop NOT NULL from office_name if it exists as a column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'office_name'
  ) THEN
    -- Set a default so existing NOT NULL constraint doesn't block inserts
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ALTER COLUMN office_name DROP NOT NULL;
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ALTER COLUMN office_name SET DEFAULT '';
  END IF;
END $$;

-- ─── Drop legacy unique constraint on (report_date, office_name) if it exists ─
-- This constraint was created by a prior partial migration run and blocks inserts
-- because office_name defaults to '' causing duplicate key violations.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.benchmark_eassist_daily_reports_2026'::regclass
      AND conname = 'benchmark_eassist_2026_office_date_unique'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      DROP CONSTRAINT benchmark_eassist_2026_office_date_unique;
  END IF;
END $$;

-- ─── Idempotent column additions (handles pre-existing table missing columns) ─

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS office_canonical text;

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS office_raw text;

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS report_month text;

-- Backfill office_canonical from office_raw if null
UPDATE public.benchmark_eassist_daily_reports_2026
SET office_canonical = office_raw
WHERE office_canonical IS NULL AND office_raw IS NOT NULL;

-- Set NOT NULL constraint only if all rows have a value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.benchmark_eassist_daily_reports_2026
    WHERE office_canonical IS NULL
  ) THEN
    BEGIN
      ALTER TABLE public.benchmark_eassist_daily_reports_2026
        ALTER COLUMN office_canonical SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- already NOT NULL or constraint already set
    END;
  END IF;
END $$;

-- ─── Unique constraint on (report_date, office_canonical) — idempotent ────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.benchmark_eassist_daily_reports_2026'::regclass
      AND contype = 'u'
      AND conname = 'benchmark_eassist_daily_reports_2026_report_date_office_canoni'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD CONSTRAINT benchmark_eassist_daily_reports_2026_report_date_office_canoni
      UNIQUE (report_date, office_canonical);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ─── Idempotent dashboard column additions (handles pre-existing table missing dashboard columns) ─

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_daily_production numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_daily_adj numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_net_daily_production numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_daily_insurance_coll numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_daily_patient_coll numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_daily_total_coll numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_monthly_production numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_monthly_adj numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_net_monthly_production numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_monthly_insurance_coll numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_monthly_patient_coll numeric(14,2);

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS dashboard_total_monthly_coll numeric(14,2);

-- ─── Idempotent core metadata column additions ────────────────────────────────

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

ALTER TABLE public.benchmark_eassist_daily_reports_2026
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill source default for rows that have it NULL
UPDATE public.benchmark_eassist_daily_reports_2026
SET source = 'eassist_daily_report_2026'
WHERE source IS NULL;

-- ─── Idempotent mismatch flag columns (generated columns cannot use ADD COLUMN IF NOT EXISTS for GENERATED) ─
-- Add as regular boolean columns if they don't exist (pre-existing table won't have GENERATED columns)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_daily_production'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_daily_production boolean
        GENERATED ALWAYS AS (
          dashboard_daily_production IS NOT NULL AND
          ABS(daily_production - dashboard_daily_production) > 1.00
        ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_net_daily_production'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_net_daily_production boolean
        GENERATED ALWAYS AS (
          dashboard_net_daily_production IS NOT NULL AND
          ABS(net_daily_production - dashboard_net_daily_production) > 1.00
        ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_daily_total_coll'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_daily_total_coll boolean
        GENERATED ALWAYS AS (
          dashboard_daily_total_coll IS NOT NULL AND
          ABS(daily_total_coll - dashboard_daily_total_coll) > 1.00
        ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_monthly_production'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_monthly_production boolean
        GENERATED ALWAYS AS (
          dashboard_monthly_production IS NOT NULL AND
          ABS(monthly_production - dashboard_monthly_production) > 1.00
        ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_net_monthly_production'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_net_monthly_production boolean
        GENERATED ALWAYS AS (
          dashboard_net_monthly_production IS NOT NULL AND
          ABS(net_monthly_production - dashboard_net_monthly_production) > 1.00
        ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_eassist_daily_reports_2026'
      AND column_name = 'mismatch_total_monthly_coll'
  ) THEN
    ALTER TABLE public.benchmark_eassist_daily_reports_2026
      ADD COLUMN mismatch_total_monthly_coll boolean
        GENERATED ALWAYS AS (
          dashboard_total_monthly_coll IS NOT NULL AND
          ABS(total_monthly_coll - dashboard_total_monthly_coll) > 1.00
        ) STORED;
  END IF;
END $$;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_benchmark_eassist_date
  ON public.benchmark_eassist_daily_reports_2026 (report_date);

CREATE INDEX IF NOT EXISTS idx_benchmark_eassist_office
  ON public.benchmark_eassist_daily_reports_2026 (office_canonical);

CREATE INDEX IF NOT EXISTS idx_benchmark_eassist_date_office
  ON public.benchmark_eassist_daily_reports_2026 (report_date, office_canonical);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.benchmark_eassist_daily_reports_2026 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'benchmark_eassist_daily_reports_2026'
      AND policyname = 'super_admin_full_access'
  ) THEN
    CREATE POLICY super_admin_full_access
      ON public.benchmark_eassist_daily_reports_2026
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- ─── Delete existing anchor rows before re-seeding ───────────────────────────
-- Removes any previously inserted anchor rows so the INSERT below is idempotent
-- regardless of which unique constraint was active during prior runs.

DELETE FROM public.benchmark_eassist_daily_reports_2026
WHERE (report_date, office_canonical) IN (
  ('2026-04-22', 'Barnegat'),
  ('2026-04-22', 'Brick'),
  ('2026-04-22', 'Eatontown'),
  ('2026-04-21', 'Brick')
);

-- ─── Seed anchor rows from workbook ──────────────────────────────────────────
-- These are the hard reconciliation anchors from the eAssist Daily Reports 2026 workbook.
-- Full workbook import should be done via the admin UI or a separate data load script.

INSERT INTO public.benchmark_eassist_daily_reports_2026 (
  report_date, report_month, office_raw, office_canonical,
  daily_production, daily_adj, net_daily_production,
  daily_insurance_coll, daily_patient_coll, daily_total_coll,
  monthly_production, monthly_adj, net_monthly_production,
  monthly_insurance_coll, monthly_patient_coll, total_monthly_coll,
  source, notes
) VALUES

-- ── 2026-04-22 | Barnegat ────────────────────────────────────────────────────
(
  '2026-04-22', 'April 2026', 'Barnegat', 'Barnegat',
  9332.00, -3854.00, 5478.00,
  412.10, 2599.86, 3011.96,
  179783.00, -122446.89, 57336.11,
  38937.20, 25187.04, 64124.24,
  'eassist_daily_report_2026',
  'Anchor row from eAssist workbook 2026-04-22, Barnegat'
),

-- ── 2026-04-22 | Brick ───────────────────────────────────────────────────────
(
  '2026-04-22', 'April 2026', 'Brick', 'Brick',
  0.00, -1643.00, -1643.00,
  3028.60, 0.00, 3028.60,
  117340.11, -78499.81, 38840.30,
  76845.06, 14991.83, 91836.89,
  'eassist_daily_report_2026',
  'Anchor row from eAssist workbook 2026-04-22 — matches PDF sample, Brick'
),

-- ── 2026-04-22 | Eatontown ───────────────────────────────────────────────────
(
  '2026-04-22', 'April 2026', 'Eatontown', 'Eatontown',
  7242.00, -4728.00, 2514.00,
  862.00, 572.85, 1434.85,
  146649.95, -92721.05, 53928.90,
  48270.43, 17392.92, 65663.35,
  'eassist_daily_report_2026',
  'Anchor row from eAssist workbook 2026-04-22, Eatontown'
),

-- ── 2026-04-21 | Brick ───────────────────────────────────────────────────────
(
  '2026-04-21', 'April 2026', 'Brick', 'Brick',
  17114.00, -3745.00, 13369.00,
  7407.00, 3545.58, 10952.58,
  115916.00, -68067.00, 47849.00,
  73736.46, 14975.42, 88711.88,
  'eassist_daily_report_2026',
  'Anchor row from eAssist workbook 2026-04-21, Brick'
);

-- ─── Reconciliation view ─────────────────────────────────────────────────────
-- Exposes mismatch summary for admin diagnostics screen

CREATE OR REPLACE VIEW public.v_benchmark_reconciliation_summary AS
SELECT
  office_canonical,
  report_date,
  report_month,
  daily_production,
  dashboard_daily_production,
  ROUND(daily_production - COALESCE(dashboard_daily_production, 0), 2) AS delta_daily_production,
  net_daily_production,
  dashboard_net_daily_production,
  ROUND(net_daily_production - COALESCE(dashboard_net_daily_production, 0), 2) AS delta_net_daily_production,
  daily_total_coll,
  dashboard_daily_total_coll,
  ROUND(daily_total_coll - COALESCE(dashboard_daily_total_coll, 0), 2) AS delta_daily_total_coll,
  monthly_production,
  dashboard_monthly_production,
  ROUND(monthly_production - COALESCE(dashboard_monthly_production, 0), 2) AS delta_monthly_production,
  net_monthly_production,
  dashboard_net_monthly_production,
  ROUND(net_monthly_production - COALESCE(dashboard_net_monthly_production, 0), 2) AS delta_net_monthly_production,
  total_monthly_coll,
  dashboard_total_monthly_coll,
  ROUND(total_monthly_coll - COALESCE(dashboard_total_monthly_coll, 0), 2) AS delta_total_monthly_coll,
  mismatch_daily_production,
  mismatch_net_daily_production,
  mismatch_daily_total_coll,
  mismatch_monthly_production,
  mismatch_net_monthly_production,
  mismatch_total_monthly_coll,
  (
    CASE WHEN mismatch_daily_production THEN 1 ELSE 0 END +
    CASE WHEN mismatch_net_daily_production THEN 1 ELSE 0 END +
    CASE WHEN mismatch_daily_total_coll THEN 1 ELSE 0 END +
    CASE WHEN mismatch_monthly_production THEN 1 ELSE 0 END +
    CASE WHEN mismatch_net_monthly_production THEN 1 ELSE 0 END +
    CASE WHEN mismatch_total_monthly_coll THEN 1 ELSE 0 END
  ) AS total_mismatches,
  reconciled_at,
  source
FROM public.benchmark_eassist_daily_reports_2026
ORDER BY report_date DESC, office_canonical;

-- ─── Normalized daily metrics view ───────────────────────────────────────────
-- Provides a normalized daily production/collections view for all dashboard tabs

CREATE OR REPLACE VIEW public.v_dentrix_normalized_daily AS
SELECT
  b.report_date,
  b.office_canonical                                    AS office,
  b.daily_production                                    AS gross_production_daily,
  b.daily_adj                                           AS production_adjustments_daily,
  b.net_daily_production                                AS net_production_daily,
  b.daily_insurance_coll                                AS insurance_collections_daily,
  b.daily_patient_coll                                  AS patient_collections_daily,
  b.daily_total_coll                                    AS total_collections_daily,
  b.monthly_production                                  AS gross_production_mtd,
  b.monthly_adj                                         AS production_adjustments_mtd,
  b.net_monthly_production                              AS net_production_mtd,
  b.monthly_insurance_coll                              AS insurance_collections_mtd,
  b.monthly_patient_coll                                AS patient_collections_mtd,
  b.total_monthly_coll                                  AS total_collections_mtd,
  -- Derived ratios
  CASE
    WHEN b.monthly_production <> 0
    THEN ROUND((b.total_monthly_coll / NULLIF(b.net_monthly_production, 0)) * 100, 2)
    ELSE NULL
  END                                                   AS collection_ratio_mtd,
  b.source,
  b.imported_at
FROM public.benchmark_eassist_daily_reports_2026 b;
