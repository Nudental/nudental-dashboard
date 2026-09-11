-- ─────────────────────────────────────────────────────────────────────────────
-- EXPENSE FACTS — NORMALIZED EXPENSE LAYER
-- Merges manual daily_entries expenses with Gusto payroll-derived expenses.
-- Source A (manual) and Source B (gusto_payroll) remain traceable by source.
-- NEVER modifies existing tables. NEVER touches Dentrix/payroll tab data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GUSTO EXPENSE FACTS TABLE
--    Idempotent, keyed off stable Gusto source identifiers.
--    Populated by the backfill + sync functions below.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_expense_facts (
  id                    text PRIMARY KEY,
  -- Source identification (deduplication key)
  source_type           text NOT NULL DEFAULT 'gusto_payroll',
  source_table          text NOT NULL,  -- 'gusto_payroll_runs' | 'gusto_contractor_payments' | 'gusto_employee_benefit_enrollments'
  source_id             text NOT NULL,  -- stable ID from source table
  -- Expense classification
  expense_category      text NOT NULL,  -- 'Payroll' | 'Benefit Paid' | 'Contractors Paid' | 'Payroll Taxes'
  expense_subcategory   text,           -- more granular label
  expense_source        text NOT NULL DEFAULT 'gusto_payroll',  -- 'gusto_payroll' | 'manual'
  -- Financial data
  expense_amount        numeric(14,2) NOT NULL DEFAULT 0,
  -- Date (use check_date / processed_at as the expense date — never hire/onboarding date)
  expense_date          date NOT NULL,
  -- Office mapping
  office_id             uuid,           -- FK to offices.id (nullable = unassigned/corporate)
  office_name           text,           -- denormalized for fast queries
  office_mapping_status text DEFAULT 'resolved',  -- 'resolved' | 'unassigned' | 'needs_review'
  -- Gusto metadata
  gusto_employee_id     uuid,
  gusto_employee_name   text,
  gusto_run_id          uuid,           -- payroll run id if applicable
  pay_period_start      date,
  pay_period_end        date,
  -- Audit
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  -- Unique constraint: prevents double-counting on re-sync
  UNIQUE (source_table, source_id, expense_category)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gusto_expense_facts_date
  ON public.gusto_expense_facts (expense_date);

CREATE INDEX IF NOT EXISTS idx_gusto_expense_facts_office
  ON public.gusto_expense_facts (office_id);

CREATE INDEX IF NOT EXISTS idx_gusto_expense_facts_category
  ON public.gusto_expense_facts (expense_category);

CREATE INDEX IF NOT EXISTS idx_gusto_expense_facts_source
  ON public.gusto_expense_facts (source_type, source_table);

CREATE INDEX IF NOT EXISTS idx_gusto_expense_facts_date_office
  ON public.gusto_expense_facts (expense_date, office_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EXPENSE_FACTS VIEW
--    Single canonical view that all dashboard pages query.
--    UNIONs manual daily_entries expenses + gusto_expense_facts.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.expense_facts;
CREATE VIEW public.expense_facts AS
  -- Source A: Manual daily_entries expenses
  SELECT
    de.id::text                                          AS id,
    de.entry_date                                        AS expense_date,
    COALESCE(de.expense_category, 'Uncategorized')       AS expense_category,
    NULL::text                                           AS expense_subcategory,
    de.expense_amount                                    AS expense_amount,
    'manual'::text                                       AS expense_source,
    de.office_id                                         AS office_id,
    o.name                                               AS office_name,
    NULL::uuid                                           AS gusto_employee_id,
    NULL::text                                           AS gusto_employee_name,
    NULL::uuid                                           AS gusto_run_id,
    NULL::date                                           AS pay_period_start,
    NULL::date                                           AS pay_period_end,
    'manual'::text                                       AS source_table,
    de.id::text                                          AS source_id,
    'resolved'::text                                     AS office_mapping_status
  FROM public.daily_entries de
  LEFT JOIN public.offices o ON o.id = de.office_id
  WHERE de.expense_amount IS NOT NULL
    AND de.expense_amount > 0

  UNION ALL

  -- Source B: Gusto payroll-derived expenses
  SELECT
    gef.id                                               AS id,
    gef.expense_date                                     AS expense_date,
    gef.expense_category                                 AS expense_category,
    gef.expense_subcategory                              AS expense_subcategory,
    gef.expense_amount                                   AS expense_amount,
    gef.expense_source                                   AS expense_source,
    gef.office_id                                        AS office_id,
    gef.office_name                                      AS office_name,
    gef.gusto_employee_id                                AS gusto_employee_id,
    gef.gusto_employee_name                              AS gusto_employee_name,
    gef.gusto_run_id                                     AS gusto_run_id,
    gef.pay_period_start                                 AS pay_period_start,
    gef.pay_period_end                                   AS pay_period_end,
    gef.source_table                                     AS source_table,
    gef.source_id                                        AS source_id,
    gef.office_mapping_status                            AS office_mapping_status
  FROM public.gusto_expense_facts gef;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SYNC FUNCTION: Populate gusto_expense_facts from processed Gusto runs
--    Only includes: source = Gusto, status = Processed (processed = true)
--    Excludes: reversed, needs_reprocessing, processing (incomplete)
--    Idempotent: uses INSERT ... ON CONFLICT DO UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_gusto_expense_facts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_inserted   integer := 0;
  v_updated    integer := 0;
  v_skipped    integer := 0;
  v_errors     jsonb   := '[]'::jsonb;
  v_run        record;
  v_contractor record;
  v_office_id  uuid;
  v_office_name text;
  v_expense_id text;
BEGIN
  -- ── A. Payroll Runs → "Payroll" expense category ──────────────────────────
  -- Only processed=true, reversed=false, needs_reprocessing=false
  FOR v_run IN
    SELECT
      gpr.id,
      gpr.check_date,
      gpr.pay_period_start,
      gpr.pay_period_end,
      gpr.total_net_pay,
      gpr.total_payable_tax,
      gpr.total_reimbursement,
      gpr.total_debit_amount
    FROM public.gusto_payroll_runs gpr
    WHERE gpr.processed = true
      AND (gpr.reversed IS NULL OR gpr.reversed = false)
      AND (gpr.needs_reprocessing IS NULL OR gpr.needs_reprocessing = false)
      AND (gpr.processing IS NULL OR gpr.processing = false)
      AND gpr.check_date IS NOT NULL
  LOOP
    BEGIN
      -- Resolve office: use first crosswalk mapping for this run, else null
      SELECT gpc.office_id, o.name
        INTO v_office_id, v_office_name
        FROM public.gusto_provider_crosswalk gpc
        LEFT JOIN public.offices o ON o.id = gpc.office_id
        WHERE gpc.active = true
          AND gpc.mapping_status = 'matched'
        LIMIT 1;

      -- ── Payroll (net pay / wages) ──────────────────────────────────────
      IF v_run.total_net_pay IS NOT NULL AND v_run.total_net_pay > 0 THEN
        v_expense_id := 'gpr_payroll_' || v_run.id::text;
        INSERT INTO public.gusto_expense_facts (
          id, source_type, source_table, source_id,
          expense_category, expense_subcategory, expense_source,
          expense_amount, expense_date,
          office_id, office_name, office_mapping_status,
          gusto_run_id, pay_period_start, pay_period_end,
          created_at, updated_at
        ) VALUES (
          v_expense_id, 'gusto_payroll', 'gusto_payroll_runs', v_run.id::text,
          'Payroll', 'Employee Wages / Net Pay', 'gusto_payroll',
          v_run.total_net_pay, v_run.check_date,
          v_office_id, v_office_name,
          CASE WHEN v_office_id IS NULL THEN 'unassigned' ELSE 'resolved' END,
          v_run.id, v_run.pay_period_start, v_run.pay_period_end,
          now(), now()
        )
        ON CONFLICT (source_table, source_id, expense_category) DO UPDATE SET
          expense_amount        = EXCLUDED.expense_amount,
          expense_date          = EXCLUDED.expense_date,
          office_id             = EXCLUDED.office_id,
          office_name           = EXCLUDED.office_name,
          office_mapping_status = EXCLUDED.office_mapping_status,
          pay_period_start      = EXCLUDED.pay_period_start,
          pay_period_end        = EXCLUDED.pay_period_end,
          updated_at            = now();
        v_inserted := v_inserted + 1;
      END IF;

      -- ── Payroll Taxes ──────────────────────────────────────────────────
      IF v_run.total_payable_tax IS NOT NULL AND v_run.total_payable_tax > 0 THEN
        v_expense_id := 'gpr_taxes_' || v_run.id::text;
        INSERT INTO public.gusto_expense_facts (
          id, source_type, source_table, source_id,
          expense_category, expense_subcategory, expense_source,
          expense_amount, expense_date,
          office_id, office_name, office_mapping_status,
          gusto_run_id, pay_period_start, pay_period_end,
          created_at, updated_at
        ) VALUES (
          v_expense_id, 'gusto_payroll', 'gusto_payroll_runs', v_run.id::text,
          'Payroll Taxes', 'Employer Payroll Taxes', 'gusto_payroll',
          v_run.total_payable_tax, v_run.check_date,
          v_office_id, v_office_name,
          CASE WHEN v_office_id IS NULL THEN 'unassigned' ELSE 'resolved' END,
          v_run.id, v_run.pay_period_start, v_run.pay_period_end,
          now(), now()
        )
        ON CONFLICT (source_table, source_id, expense_category) DO UPDATE SET
          expense_amount        = EXCLUDED.expense_amount,
          expense_date          = EXCLUDED.expense_date,
          office_id             = EXCLUDED.office_id,
          office_name           = EXCLUDED.office_name,
          office_mapping_status = EXCLUDED.office_mapping_status,
          updated_at            = now();
        v_inserted := v_inserted + 1;
      END IF;

      -- ── Benefit Paid (reimbursements from payroll run as proxy) ────────
      IF v_run.total_reimbursement IS NOT NULL AND v_run.total_reimbursement > 0 THEN
        v_expense_id := 'gpr_benefits_' || v_run.id::text;
        INSERT INTO public.gusto_expense_facts (
          id, source_type, source_table, source_id,
          expense_category, expense_subcategory, expense_source,
          expense_amount, expense_date,
          office_id, office_name, office_mapping_status,
          gusto_run_id, pay_period_start, pay_period_end,
          created_at, updated_at
        ) VALUES (
          v_expense_id, 'gusto_payroll', 'gusto_payroll_runs', v_run.id::text,
          'Benefit Paid', 'Employer Benefit Contributions', 'gusto_payroll',
          v_run.total_reimbursement, v_run.check_date,
          v_office_id, v_office_name,
          CASE WHEN v_office_id IS NULL THEN 'unassigned' ELSE 'resolved' END,
          v_run.id, v_run.pay_period_start, v_run.pay_period_end,
          now(), now()
        )
        ON CONFLICT (source_table, source_id, expense_category) DO UPDATE SET
          expense_amount        = EXCLUDED.expense_amount,
          expense_date          = EXCLUDED.expense_date,
          office_id             = EXCLUDED.office_id,
          office_name           = EXCLUDED.office_name,
          office_mapping_status = EXCLUDED.office_mapping_status,
          updated_at            = now();
        v_inserted := v_inserted + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'run_id', v_run.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- ── B. Contractor Payments → "Contractors Paid" expense category ──────────
  -- Only funded=true, cancelled=false
  FOR v_contractor IN
    SELECT
      gcp.id,
      gcp.check_date,
      gcp.total_amount,
      gcp.contractor_name,
      gcp.contractor_display_name
    FROM public.gusto_contractor_payments gcp
    WHERE (gcp.cancelled IS NULL OR gcp.cancelled = false)
      AND (gcp.funded IS NULL OR gcp.funded = true)
      AND gcp.total_amount IS NOT NULL
      AND gcp.total_amount > 0
      AND gcp.check_date IS NOT NULL
  LOOP
    BEGIN
      v_expense_id := 'gcp_contractors_' || v_contractor.id;
      INSERT INTO public.gusto_expense_facts (
        id, source_type, source_table, source_id,
        expense_category, expense_subcategory, expense_source,
        expense_amount, expense_date,
        office_id, office_name, office_mapping_status,
        gusto_employee_name,
        created_at, updated_at
      ) VALUES (
        v_expense_id, 'gusto_payroll', 'gusto_contractor_payments', v_contractor.id,
        'Contractors Paid',
        COALESCE(v_contractor.contractor_display_name, v_contractor.contractor_name, 'Contractor'),
        'gusto_payroll',
        v_contractor.total_amount, v_contractor.check_date,
        NULL, NULL, 'unassigned',
        COALESCE(v_contractor.contractor_display_name, v_contractor.contractor_name),
        now(), now()
      )
      ON CONFLICT (source_table, source_id, expense_category) DO UPDATE SET
        expense_amount   = EXCLUDED.expense_amount,
        expense_date     = EXCLUDED.expense_date,
        updated_at       = now();
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'contractor_id', v_contractor.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated',  v_updated,
    'skipped',  v_skipped,
    'errors',   v_errors,
    'synced_at', now()
  );
END;
$func$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RECONCILIATION FUNCTION
--    Validates that gusto_expense_facts totals match gusto_payroll_runs totals
--    for the same date range. Returns mismatches as warnings.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_gusto_expenses(
  p_start_date date,
  p_end_date   date,
  p_office_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_payroll_source_total   numeric := 0;
  v_payroll_expense_total  numeric := 0;
  v_contractor_source_total  numeric := 0;
  v_contractor_expense_total numeric := 0;
  v_benefit_source_total   numeric := 0;
  v_benefit_expense_total  numeric := 0;
  v_warnings               jsonb   := '[]'::jsonb;
  v_threshold              numeric := 0.01;
BEGIN
  -- ── Payroll: source total from gusto_payroll_runs ─────────────────────────
  SELECT COALESCE(SUM(total_net_pay), 0)
    INTO v_payroll_source_total
    FROM public.gusto_payroll_runs
    WHERE processed = true
      AND (reversed IS NULL OR reversed = false)
      AND (needs_reprocessing IS NULL OR needs_reprocessing = false)
      AND check_date BETWEEN p_start_date AND p_end_date;

  -- ── Payroll: expense total from gusto_expense_facts ───────────────────────
  SELECT COALESCE(SUM(expense_amount), 0)
    INTO v_payroll_expense_total
    FROM public.gusto_expense_facts
    WHERE expense_category = 'Payroll'
      AND expense_date BETWEEN p_start_date AND p_end_date
      AND (p_office_id IS NULL OR office_id = p_office_id);

  -- ── Contractors: source total ─────────────────────────────────────────────
  SELECT COALESCE(SUM(total_amount), 0)
    INTO v_contractor_source_total
    FROM public.gusto_contractor_payments
    WHERE (cancelled IS NULL OR cancelled = false)
      AND (funded IS NULL OR funded = true)
      AND check_date BETWEEN p_start_date AND p_end_date;

  -- ── Contractors: expense total ────────────────────────────────────────────
  SELECT COALESCE(SUM(expense_amount), 0)
    INTO v_contractor_expense_total
    FROM public.gusto_expense_facts
    WHERE expense_category = 'Contractors Paid'
      AND expense_date BETWEEN p_start_date AND p_end_date
      AND (p_office_id IS NULL OR office_id = p_office_id);

  -- ── Check mismatches ──────────────────────────────────────────────────────
  IF ABS(v_payroll_source_total - v_payroll_expense_total) > v_threshold THEN
    v_warnings := v_warnings || jsonb_build_object(
      'category',      'Payroll',
      'source_total',  v_payroll_source_total,
      'expense_total', v_payroll_expense_total,
      'variance',      v_payroll_source_total - v_payroll_expense_total,
      'message',       'Payroll expense total does not match processed Gusto payroll runs total'
    );
  END IF;

  IF ABS(v_contractor_source_total - v_contractor_expense_total) > v_threshold THEN
    v_warnings := v_warnings || jsonb_build_object(
      'category',      'Contractors Paid',
      'source_total',  v_contractor_source_total,
      'expense_total', v_contractor_expense_total,
      'variance',      v_contractor_source_total - v_contractor_expense_total,
      'message',       'Contractors Paid expense total does not match Gusto contractor payments total'
    );
  END IF;

  RETURN jsonb_build_object(
    'period_start',              p_start_date,
    'period_end',                p_end_date,
    'payroll_source_total',      v_payroll_source_total,
    'payroll_expense_total',     v_payroll_expense_total,
    'contractor_source_total',   v_contractor_source_total,
    'contractor_expense_total',  v_contractor_expense_total,
    'benefit_source_total',      v_benefit_source_total,
    'benefit_expense_total',     v_benefit_expense_total,
    'warnings',                  v_warnings,
    'is_reconciled',             (jsonb_array_length(v_warnings) = 0),
    'checked_at',                now()
  );
END;
$func$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADMIN WARNING LOG TABLE (for office mapping issues)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_expense_warnings (
  id            bigserial PRIMARY KEY,
  warning_type  text NOT NULL,  -- 'office_unresolved' | 'reconciliation_mismatch' | 'duplicate_skipped'
  source_table  text,
  source_id     text,
  message       text NOT NULL,
  details       jsonb,
  resolved      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gusto_expense_warnings_type
  ON public.gusto_expense_warnings (warning_type, resolved);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gusto_expense_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_expense_warnings ENABLE ROW LEVEL SECURITY;

-- gusto_expense_facts: admin_or_above can read; super_admin can write
DROP POLICY IF EXISTS "gusto_expense_facts_read" ON public.gusto_expense_facts;
CREATE POLICY "gusto_expense_facts_read"
  ON public.gusto_expense_facts
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_expense_facts_write" ON public.gusto_expense_facts;
CREATE POLICY "gusto_expense_facts_write"
  ON public.gusto_expense_facts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- gusto_expense_warnings: admin_or_above can read; super_admin can write
DROP POLICY IF EXISTS "gusto_expense_warnings_read" ON public.gusto_expense_warnings;
CREATE POLICY "gusto_expense_warnings_read"
  ON public.gusto_expense_warnings
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_expense_warnings_write" ON public.gusto_expense_warnings;
CREATE POLICY "gusto_expense_warnings_write"
  ON public.gusto_expense_warnings
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. HISTORICAL BACKFILL
--    Run sync_gusto_expense_facts() immediately to populate all historical data.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only run if gusto_payroll_runs has data
  IF EXISTS (SELECT 1 FROM public.gusto_payroll_runs LIMIT 1) THEN
    v_result := public.sync_gusto_expense_facts();
    RAISE NOTICE 'Gusto expense backfill complete: %', v_result;
  ELSE
    RAISE NOTICE 'No Gusto payroll runs found — backfill skipped (will run on first import)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill error (non-fatal): %', SQLERRM;
END $$;
