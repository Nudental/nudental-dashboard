-- ============================================================
-- Payroll Schedule Table
-- Stores explicit payroll runs with pay period dates and paydays.
-- Source of truth for all payroll period boundaries.
-- ============================================================

-- Create payroll_schedule table
CREATE TABLE IF NOT EXISTS public.payroll_schedule (
  id                TEXT PRIMARY KEY,
  payroll_type      TEXT NOT NULL DEFAULT 'regular'
                    CHECK (payroll_type IN ('regular', 'tax_reconciliation', 'special_correction', 'provider_specific')),
  payroll_name      TEXT NOT NULL,
  pay_period_start  DATE NOT NULL,
  pay_period_end    DATE NOT NULL,
  payday            DATE NOT NULL,
  year              INTEGER NOT NULL,
  is_regular        BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_schedule_period_check CHECK (pay_period_end >= pay_period_start)
);

-- Index for fast year + type lookups
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_year ON public.payroll_schedule (year);
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_payday ON public.payroll_schedule (payday);
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_type ON public.payroll_schedule (payroll_type);
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_period ON public.payroll_schedule (pay_period_start, pay_period_end);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_payroll_schedule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_schedule_updated_at ON public.payroll_schedule;
CREATE TRIGGER trg_payroll_schedule_updated_at
  BEFORE UPDATE ON public.payroll_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_payroll_schedule_updated_at();

-- ============================================================
-- RLS: Super Admin only
-- ============================================================
ALTER TABLE public.payroll_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_payroll_schedule_all" ON public.payroll_schedule;
CREATE POLICY "super_admin_payroll_schedule_all"
  ON public.payroll_schedule
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================
-- Seed: Exact payroll schedule as provided
-- Use INSERT ... ON CONFLICT DO NOTHING for idempotency
-- ============================================================

INSERT INTO public.payroll_schedule
  (id, payroll_type, payroll_name, pay_period_start, pay_period_end, payday, year, is_regular, notes)
VALUES
  -- 2025 entries
  ('pp-2025-q4-tax',
   'tax_reconciliation',
   'Q4 2025 Tax Reconciliation',
   '2025-10-01', '2025-12-31', '2025-12-31',
   2025, FALSE,
   'Q4 2025 tax reconciliation run'),

  ('pp-2025-23',
   'regular',
   'Pay Period Nov 24 – Dec 7, 2025',
   '2025-11-24', '2025-12-07', '2025-12-12',
   2025, TRUE,
   NULL),

  ('pp-2025-24',
   'regular',
   'Pay Period Dec 8 – Dec 21, 2025',
   '2025-12-08', '2025-12-21', '2025-12-26',
   2025, TRUE,
   NULL),

  -- 2026 entries
  ('pp-2026-01',
   'regular',
   'Pay Period Dec 22, 2025 – Jan 4, 2026',
   '2025-12-22', '2026-01-04', '2026-01-09',
   2026, TRUE,
   NULL),

  ('pp-2026-02',
   'regular',
   'Pay Period Jan 5 – Jan 18, 2026',
   '2026-01-05', '2026-01-18', '2026-01-23',
   2026, TRUE,
   NULL),

  ('pp-2026-03',
   'regular',
   'Pay Period Jan 19 – Feb 1, 2026',
   '2026-01-19', '2026-02-01', '2026-02-06',
   2026, TRUE,
   NULL),

  ('pp-2026-04',
   'regular',
   'Pay Period Feb 2 – Feb 15, 2026',
   '2026-02-02', '2026-02-15', '2026-02-20',
   2026, TRUE,
   NULL),

  ('pp-2026-05',
   'regular',
   'Pay Period Feb 16 – Mar 1, 2026',
   '2026-02-16', '2026-03-01', '2026-03-06',
   2026, TRUE,
   NULL),

  ('pp-2026-06',
   'regular',
   'Pay Period Mar 2 – Mar 15, 2026',
   '2026-03-02', '2026-03-15', '2026-03-20',
   2026, TRUE,
   'John Fitzpatrick payroll run'),

  ('pp-2026-special-margolies',
   'special_correction',
   'Norman Margolies Payroll Correction',
   '2026-03-02', '2026-03-13', '2026-03-24',
   2026, FALSE,
   'Fixing Norman Margolies payroll correction run'),

  ('pp-2026-q1-tax',
   'tax_reconciliation',
   'Q1 2026 Tax Reconciliation',
   '2026-01-01', '2026-03-31', '2026-03-31',
   2026, FALSE,
   'Q1 2026 tax reconciliation run'),

  ('pp-2026-07',
   'regular',
   'Pay Period Mar 30 – Apr 12, 2026',
   '2026-03-30', '2026-04-12', '2026-04-17',
   2026, TRUE,
   NULL)

ON CONFLICT (id) DO NOTHING;
