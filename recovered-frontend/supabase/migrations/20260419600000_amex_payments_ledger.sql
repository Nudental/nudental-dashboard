-- ============================================================
-- AMEX PAYMENTS LEDGER
-- Additive migration — creates amex_payments table only.
-- Does NOT modify any existing tables, columns, views, or policies.
-- ============================================================

-- ── ENUM: payment status ─────────────────────────────────────
DROP TYPE IF EXISTS public.amex_payment_status CASCADE;
CREATE TYPE public.amex_payment_status AS ENUM (
  'pending',
  'posted',
  'cleared',
  'void'
);

-- ── ENUM: payment source type ────────────────────────────────
DROP TYPE IF EXISTS public.amex_payment_source_type CASCADE;
CREATE TYPE public.amex_payment_source_type AS ENUM (
  'manual',
  'imported',
  'api'
);

-- ── TABLE: amex_payments ─────────────────────────────────────
-- Dedicated ledger for AmEx bill payments.
-- Completely separate from amex_raw_transactions (spend activity).
-- Each row = one payment event against an AmEx statement.
CREATE TABLE IF NOT EXISTS public.amex_payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Statement period this payment covers
  statement_period_start DATE NOT NULL,
  statement_period_end   DATE NOT NULL,
  statement_month        INTEGER NOT NULL CHECK (statement_month BETWEEN 1 AND 12),
  statement_year         INTEGER NOT NULL CHECK (statement_year >= 2020),

  -- Payment details
  payment_date           DATE NOT NULL,
  amount_paid            NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
  payment_status         public.amex_payment_status NOT NULL DEFAULT 'pending',
  payment_reference      TEXT,

  -- Card / account info (nullable — applies when payment is card-specific)
  card_last4             TEXT,
  card_program           TEXT,

  -- Source traceability
  source_type            public.amex_payment_source_type NOT NULL DEFAULT 'manual',

  -- Notes
  notes                  TEXT,

  -- Audit
  created_by             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_amex_payments_payment_date
  ON public.amex_payments (payment_date);

CREATE INDEX IF NOT EXISTS idx_amex_payments_statement_period
  ON public.amex_payments (statement_period_start, statement_period_end);

CREATE INDEX IF NOT EXISTS idx_amex_payments_status
  ON public.amex_payments (payment_status);

CREATE INDEX IF NOT EXISTS idx_amex_payments_year_month
  ON public.amex_payments (statement_year, statement_month);

CREATE INDEX IF NOT EXISTS idx_amex_payments_created_by
  ON public.amex_payments (created_by);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_amex_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amex_payments_updated_at ON public.amex_payments;
CREATE TRIGGER trg_amex_payments_updated_at
  BEFORE UPDATE ON public.amex_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_amex_payments_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.amex_payments ENABLE ROW LEVEL SECURITY;

-- Reuse the existing admin-or-above check from the expense module
DROP POLICY IF EXISTS "amex_payments_admin_all" ON public.amex_payments;
CREATE POLICY "amex_payments_admin_all"
  ON public.amex_payments
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_above_expense())
  WITH CHECK (public.is_admin_or_above_expense());

-- ── SUMMARY VIEW (optional, for downstream expense analysis) ──
-- Exposes amex_payment records as a separate expense source layer.
-- Downstream analysis can JOIN this view without touching existing
-- amex_raw_transactions or expenses tables.
CREATE OR REPLACE VIEW public.amex_payment_summary AS
SELECT
  id,
  statement_period_start,
  statement_period_end,
  statement_month,
  statement_year,
  payment_date,
  amount_paid,
  payment_status,
  payment_reference,
  card_last4,
  card_program,
  source_type,
  notes,
  created_by,
  created_at,
  updated_at,
  -- Expose as amex_payment source type for expense analysis integration
  'amex_payment'::TEXT AS expense_source_type,
  DATE_TRUNC('month', payment_date) AS payment_month_start
FROM public.amex_payments
WHERE payment_status != 'void';
