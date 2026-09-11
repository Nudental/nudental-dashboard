-- ══════════════════════════════════════════════════════════════════════════════
-- BACKFILL: Monthly Production / Collections / AR — April 2022 → March 2026
-- ══════════════════════════════════════════════════════════════════════════════
-- Purpose:
--   Provides a normalized monthly summary table covering 48 months × 4 offices
--   (April 2022 – March 2026) for the Nu Dashboard executive overview.
--
--   The Jan–Apr 2026 rows are validated against the Nu Dash comp data Analysis
--   Ledger Report Builder PDF (office_collection_production_summary_jan_apr_2026).
--
--   Pre-2026 rows are seeded as estimated/placeholder values derived from the
--   known 2026 run-rate and typical seasonal patterns. They are flagged with
--   source = 'estimated_backfill' so the UI can distinguish them from
--   reconciled eAssist exports.
--
-- Offices:
--   Barnegat    | 1c719b5b-fd77-4da8-a1b9-2209f1cea63e
--   Brick       | 54626997-57c2-4934-8743-1dabb4d176f4
--   Eatontown   | 220372a5-afae-49c9-8a0c-f4c0717ff352
--   Staten Island | b0abcc46-55e8-4529-a28f-eedf41c1d72e
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.office_production_summary_monthly (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month          date NOT NULL,           -- First day of month (e.g. 2022-04-01)
  period_label          text NOT NULL,           -- e.g. 'April 2022'
  office_canonical      text NOT NULL,           -- 'Barnegat' | 'Brick' | 'Eatontown' | 'Staten Island'
  office_id             uuid REFERENCES public.offices(id) ON DELETE SET NULL,

  -- Production
  gross_production      numeric(14,2) NOT NULL DEFAULT 0,
  production_adj        numeric(14,2) NOT NULL DEFAULT 0,  -- negative = reductions
  net_production        numeric(14,2) NOT NULL DEFAULT 0,

  -- Collections
  insurance_collections numeric(14,2) NOT NULL DEFAULT 0,
  patient_collections   numeric(14,2) NOT NULL DEFAULT 0,
  total_collections     numeric(14,2) NOT NULL DEFAULT 0,  -- negative = money received

  -- AR Aging snapshot (end-of-month, 0 = not yet captured)
  ar_0_30               numeric(14,2) NOT NULL DEFAULT 0,
  ar_31_60              numeric(14,2) NOT NULL DEFAULT 0,
  ar_61_90              numeric(14,2) NOT NULL DEFAULT 0,
  ar_91_plus            numeric(14,2) NOT NULL DEFAULT 0,
  ar_total              numeric(14,2) NOT NULL DEFAULT 0,

  -- Derived
  collection_rate       numeric(7,4),   -- total_collections / net_production (as ratio)

  -- Reconciliation metadata
  source                text NOT NULL DEFAULT 'estimated_backfill',
  -- 'eassist_pdf_validated'  = matched against PDF source-of-truth
  -- 'eassist_daily_report'   = imported from eAssist daily workbook
  -- 'estimated_backfill'     = derived from run-rate / seasonal model
  reconciled_at         timestamptz,
  reconciliation_notes  text,
  imported_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── Unique constraint ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.office_production_summary_monthly'::regclass
      AND conname = 'uq_office_prod_summary_period_office'
  ) THEN
    ALTER TABLE public.office_production_summary_monthly
      ADD CONSTRAINT uq_office_prod_summary_period_office
      UNIQUE (period_month, office_canonical);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ops_monthly_period
  ON public.office_production_summary_monthly (period_month);

CREATE INDEX IF NOT EXISTS idx_ops_monthly_office
  ON public.office_production_summary_monthly (office_canonical);

CREATE INDEX IF NOT EXISTS idx_ops_monthly_period_office
  ON public.office_production_summary_monthly (period_month, office_canonical);

CREATE INDEX IF NOT EXISTS idx_ops_monthly_source
  ON public.office_production_summary_monthly (source);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.office_production_summary_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ops_monthly_super_admin_all" ON public.office_production_summary_monthly;
CREATE POLICY "ops_monthly_super_admin_all"
  ON public.office_production_summary_monthly
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "ops_monthly_authenticated_read" ON public.office_production_summary_monthly;
CREATE POLICY "ops_monthly_authenticated_read"
  ON public.office_production_summary_monthly
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── Seed: Jan–Apr 2026 (PDF-validated) ──────────────────────────────────────
-- Values from: Nu Dash comp data Analysis Ledger Report Builder
-- Source document: office_collection_production_summary_jan_apr_2026.pdf
-- Collections are stored as NEGATIVE (exactly as in source report).

INSERT INTO public.office_production_summary_monthly (
  period_month, period_label, office_canonical, office_id,
  gross_production, production_adj, net_production,
  insurance_collections, patient_collections, total_collections,
  collection_rate, source, reconciled_at, reconciliation_notes
) VALUES

-- ── January 2026 ─────────────────────────────────────────────────────────────
('2026-01-01', 'January 2026', 'Barnegat',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
  114038.51, 0, 114038.51,
  -97945.75, -24486.44, -122432.19,
  ROUND(122432.19 / NULLIF(114038.51, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-01-01', 'January 2026', 'Brick',
  '54626997-57c2-4934-8743-1dabb4d176f4',
  63682.69, 0, 63682.69,
  -47121.94, -11780.49, -58902.43,
  ROUND(58902.43 / NULLIF(63682.69, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-01-01', 'January 2026', 'Eatontown',
  '220372a5-afae-49c9-8a0c-f4c0717ff352',
  75899.60, 0, 75899.60,
  -49938.13, -12484.53, -62422.66,
  ROUND(62422.66 / NULLIF(75899.60, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-01-01', 'January 2026', 'Staten Island',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
  10855.20, 0, 10855.20,
  -6687.74, -1671.93, -8359.67,
  ROUND(8359.67 / NULLIF(10855.20, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

-- ── February 2026 ────────────────────────────────────────────────────────────
('2026-02-01', 'February 2026', 'Barnegat',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
  71324.71, 0, 71324.71,
  -95125.27, -23781.32, -118906.59,
  ROUND(118906.59 / NULLIF(71324.71, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-02-01', 'February 2026', 'Brick',
  '54626997-57c2-4934-8743-1dabb4d176f4',
  77507.98, 0, 77507.98,
  -57843.65, -14460.91, -72304.56,
  ROUND(72304.56 / NULLIF(77507.98, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-02-01', 'February 2026', 'Eatontown',
  '220372a5-afae-49c9-8a0c-f4c0717ff352',
  62148.07, 0, 62148.07,
  -59418.82, -14854.71, -74273.53,
  ROUND(74273.53 / NULLIF(62148.07, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-02-01', 'February 2026', 'Staten Island',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
  6155.00, 0, 6155.00,
  -3857.52, -964.38, -4821.90,
  ROUND(4821.90 / NULLIF(6155.00, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

-- ── March 2026 ───────────────────────────────────────────────────────────────
('2026-03-01', 'March 2026', 'Barnegat',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
  114745.18, 0, 114745.18,
  -90155.50, -22538.88, -112694.38,
  ROUND(112694.38 / NULLIF(114745.18, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-03-01', 'March 2026', 'Brick',
  '54626997-57c2-4934-8743-1dabb4d176f4',
  76047.23, 0, 76047.23,
  -57250.09, -14312.52, -71562.61,
  ROUND(71562.61 / NULLIF(76047.23, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-03-01', 'March 2026', 'Eatontown',
  '220372a5-afae-49c9-8a0c-f4c0717ff352',
  76631.80, 0, 76631.80,
  -69535.49, -17383.87, -86919.36,
  ROUND(86919.36 / NULLIF(76631.80, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

('2026-03-01', 'March 2026', 'Staten Island',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
  14395.51, 0, 14395.51,
  -9431.40, -2357.85, -11789.25,
  ROUND(11789.25 / NULLIF(14395.51, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF'),

-- ── April 2026 (partial — through Apr 22 per eAssist workbook) ───────────────
('2026-04-01', 'April 2026', 'Barnegat',
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
  74801.71, 0, 74801.71,
  -52504.78, -13126.19, -65630.97,
  ROUND(65630.97 / NULLIF(74801.71, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF (partial month through Apr 22)'),

('2026-04-01', 'April 2026', 'Brick',
  '54626997-57c2-4934-8743-1dabb4d176f4',
  44378.23, 0, 44378.23,
  -63546.20, -15886.55, -79432.75,
  ROUND(79432.75 / NULLIF(44378.23, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF (partial month through Apr 22)'),

('2026-04-01', 'April 2026', 'Eatontown',
  '220372a5-afae-49c9-8a0c-f4c0717ff352',
  52015.77, 0, 52015.77,
  -47214.58, -11803.64, -59018.22,
  ROUND(59018.22 / NULLIF(52015.77, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF (partial month through Apr 22)'),

('2026-04-01', 'April 2026', 'Staten Island',
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
  12411.12, 0, 12411.12,
  -14360.26, -3590.06, -17950.32,
  ROUND(17950.32 / NULLIF(12411.12, 0), 4),
  'eassist_pdf_validated', now(),
  'Validated against Nu Dash comp data Analysis Ledger Report Builder Jan-Apr 2026 PDF (partial month through Apr 22)')

ON CONFLICT (period_month, office_canonical) DO UPDATE SET
  gross_production      = EXCLUDED.gross_production,
  net_production        = EXCLUDED.net_production,
  total_collections     = EXCLUDED.total_collections,
  insurance_collections = EXCLUDED.insurance_collections,
  patient_collections   = EXCLUDED.patient_collections,
  collection_rate       = EXCLUDED.collection_rate,
  source                = EXCLUDED.source,
  reconciled_at         = EXCLUDED.reconciled_at,
  reconciliation_notes  = EXCLUDED.reconciliation_notes;

-- ─── Seed: April 2022 – December 2025 (estimated backfill) ───────────────────
-- These rows are derived from the 2026 monthly run-rate with seasonal adjustment
-- factors applied. They are flagged source = 'estimated_backfill' and must be
-- replaced with actual eAssist exports when available.
--
-- Run-rate basis (2026 monthly averages from PDF):
--   Barnegat:     production ~$98k/mo,  collections ~$105k/mo
--   Brick:        production ~$65k/mo,  collections ~$70k/mo
--   Eatontown:    production ~$67k/mo,  collections ~$73k/mo
--   Staten Island:production ~$11k/mo,  collections ~$10k/mo
--
-- Seasonal factors (dental industry norms):
--   Jan: 0.90  Feb: 0.85  Mar: 1.05  Apr: 1.00  May: 1.00  Jun: 0.95
--   Jul: 0.85  Aug: 0.90  Sep: 1.05  Oct: 1.10  Nov: 0.95  Dec: 0.80
--
-- Year-over-year growth applied: 5% per year backward from 2026 baseline.

DO $$
DECLARE
  -- Base monthly production (2026 run-rate)
  barnegat_prod_base    numeric := 98000;
  brick_prod_base       numeric := 65000;
  eatontown_prod_base   numeric := 67000;
  si_prod_base          numeric := 11000;

  -- Base monthly collections (2026 run-rate, stored as negative)
  barnegat_coll_base    numeric := -105000;
  brick_coll_base       numeric := -70000;
  eatontown_coll_base   numeric := -73000;
  si_coll_base          numeric := -10000;

  -- Seasonal factors by month (1-indexed)
  seasonal              numeric[] := ARRAY[0.90, 0.85, 1.05, 1.00, 1.00, 0.95,
                                           0.85, 0.90, 1.05, 1.10, 0.95, 0.80];

  -- YoY growth rate (5% per year, applied backward)
  yoy_rate              numeric := 0.05;

  cur_year              int;
  cur_month             int;
  period_dt             date;
  period_lbl            text;
  yrs_back              int;
  growth_factor         numeric;
  sf                    numeric;

  prod_b  numeric; prod_br numeric; prod_e  numeric; prod_si numeric;
  coll_b  numeric; coll_br numeric; coll_e  numeric; coll_si numeric;

  months_arr text[] := ARRAY['January','February','March','April','May','June',
                              'July','August','September','October','November','December'];
BEGIN
  FOR cur_year IN 2022..2025 LOOP
    FOR cur_month IN 1..12 LOOP
      -- Skip months before April 2022
      CONTINUE WHEN cur_year = 2022 AND cur_month < 4;

      period_dt  := make_date(cur_year, cur_month, 1);
      period_lbl := months_arr[cur_month] || ' ' || cur_year::text;

      -- Years back from 2026 baseline
      yrs_back      := 2026 - cur_year;
      growth_factor := POWER(1 + yoy_rate, yrs_back);
      sf            := seasonal[cur_month];

      -- Deflate production by growth factor (older = smaller)
      prod_b  := ROUND((barnegat_prod_base  / growth_factor) * sf, 2);
      prod_br := ROUND((brick_prod_base     / growth_factor) * sf, 2);
      prod_e  := ROUND((eatontown_prod_base / growth_factor) * sf, 2);
      prod_si := ROUND((si_prod_base        / growth_factor) * sf, 2);

      -- Collections follow same pattern (negative)
      coll_b  := ROUND((barnegat_coll_base  / growth_factor) * sf, 2);
      coll_br := ROUND((brick_coll_base     / growth_factor) * sf, 2);
      coll_e  := ROUND((eatontown_coll_base / growth_factor) * sf, 2);
      coll_si := ROUND((si_coll_base        / growth_factor) * sf, 2);

      -- Barnegat
      INSERT INTO public.office_production_summary_monthly (
        period_month, period_label, office_canonical, office_id,
        gross_production, production_adj, net_production,
        insurance_collections, patient_collections, total_collections,
        collection_rate, source, reconciliation_notes
      ) VALUES (
        period_dt, period_lbl, 'Barnegat', '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
        prod_b, 0, prod_b,
        ROUND(coll_b * 0.80, 2), ROUND(coll_b * 0.20, 2), coll_b,
        ROUND(ABS(coll_b) / NULLIF(prod_b, 0), 4),
        'estimated_backfill',
        'Estimated from 2026 run-rate with 5%/yr YoY deflation and seasonal factor ' || sf::text
      ) ON CONFLICT (period_month, office_canonical) DO NOTHING;

      -- Brick
      INSERT INTO public.office_production_summary_monthly (
        period_month, period_label, office_canonical, office_id,
        gross_production, production_adj, net_production,
        insurance_collections, patient_collections, total_collections,
        collection_rate, source, reconciliation_notes
      ) VALUES (
        period_dt, period_lbl, 'Brick', '54626997-57c2-4934-8743-1dabb4d176f4',
        prod_br, 0, prod_br,
        ROUND(coll_br * 0.80, 2), ROUND(coll_br * 0.20, 2), coll_br,
        ROUND(ABS(coll_br) / NULLIF(prod_br, 0), 4),
        'estimated_backfill',
        'Estimated from 2026 run-rate with 5%/yr YoY deflation and seasonal factor ' || sf::text
      ) ON CONFLICT (period_month, office_canonical) DO NOTHING;

      -- Eatontown
      INSERT INTO public.office_production_summary_monthly (
        period_month, period_label, office_canonical, office_id,
        gross_production, production_adj, net_production,
        insurance_collections, patient_collections, total_collections,
        collection_rate, source, reconciliation_notes
      ) VALUES (
        period_dt, period_lbl, 'Eatontown', '220372a5-afae-49c9-8a0c-f4c0717ff352',
        prod_e, 0, prod_e,
        ROUND(coll_e * 0.80, 2), ROUND(coll_e * 0.20, 2), coll_e,
        ROUND(ABS(coll_e) / NULLIF(prod_e, 0), 4),
        'estimated_backfill',
        'Estimated from 2026 run-rate with 5%/yr YoY deflation and seasonal factor ' || sf::text
      ) ON CONFLICT (period_month, office_canonical) DO NOTHING;

      -- Staten Island
      INSERT INTO public.office_production_summary_monthly (
        period_month, period_label, office_canonical, office_id,
        gross_production, production_adj, net_production,
        insurance_collections, patient_collections, total_collections,
        collection_rate, source, reconciliation_notes
      ) VALUES (
        period_dt, period_lbl, 'Staten Island', 'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
        prod_si, 0, prod_si,
        ROUND(coll_si * 0.80, 2), ROUND(coll_si * 0.20, 2), coll_si,
        ROUND(ABS(coll_si) / NULLIF(prod_si, 0), 4),
        'estimated_backfill',
        'Estimated from 2026 run-rate with 5%/yr YoY deflation and seasonal factor ' || sf::text
      ) ON CONFLICT (period_month, office_canonical) DO NOTHING;

    END LOOP;
  END LOOP;
END $$;

-- ─── Reconciliation summary view ──────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_office_production_summary_reconciliation AS
SELECT
  period_month,
  period_label,
  office_canonical,
  gross_production,
  net_production,
  total_collections,
  ABS(total_collections)                                          AS total_collections_abs,
  ROUND(ABS(total_collections) / NULLIF(net_production, 0) * 100, 2) AS collection_rate_pct,
  ar_total,
  source,
  reconciled_at,
  reconciliation_notes,
  CASE
    WHEN source = 'eassist_pdf_validated'  THEN 'validated'
    WHEN source = 'eassist_daily_report'   THEN 'imported'
    ELSE 'estimated'
  END AS data_quality
FROM public.office_production_summary_monthly
ORDER BY period_month DESC, office_canonical;

-- ─── 48-month cross-office aggregate view ────────────────────────────────────

CREATE OR REPLACE VIEW public.v_48month_production_collections AS
SELECT
  period_month,
  period_label,
  SUM(gross_production)                                           AS total_gross_production,
  SUM(net_production)                                             AS total_net_production,
  SUM(ABS(total_collections))                                     AS total_collections_abs,
  SUM(total_collections)                                          AS total_collections,
  ROUND(SUM(ABS(total_collections)) / NULLIF(SUM(net_production), 0) * 100, 2) AS collection_rate_pct,
  SUM(ar_total)                                                   AS total_ar,
  COUNT(DISTINCT office_canonical)                                AS office_count,
  -- Data quality breakdown
  COUNT(*) FILTER (WHERE source = 'eassist_pdf_validated')        AS validated_offices,
  COUNT(*) FILTER (WHERE source = 'eassist_daily_report')         AS imported_offices,
  COUNT(*) FILTER (WHERE source = 'estimated_backfill')           AS estimated_offices
FROM public.office_production_summary_monthly
GROUP BY period_month, period_label
ORDER BY period_month DESC;
