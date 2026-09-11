-- Migration: payroll_report_sent_log table
-- Stores audit history of all provider payroll reports sent via the Pay Period Report workflow.

CREATE TABLE IF NOT EXISTS public.payroll_report_sent_log (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name         text NOT NULL,
  provider_id           text,
  provider_type         text CHECK (provider_type IN ('doctor', 'hygienist')),
  office_name           text,
  pay_period_start      date NOT NULL,
  pay_period_end        date NOT NULL,
  payday                date,
  compensation_pct      numeric(5,4) NOT NULL,
  total_collections     numeric(12,2) NOT NULL DEFAULT 0,
  compensation_amount   numeric(12,2) NOT NULL DEFAULT 0,
  recipient_email       text NOT NULL,
  cc_emails             text[],
  sent_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at               timestamptz NOT NULL DEFAULT now(),
  pdf_filename          text,
  reconciliation_status text DEFAULT 'no_detail',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by pay period
CREATE INDEX IF NOT EXISTS idx_payroll_report_sent_log_period
  ON public.payroll_report_sent_log (pay_period_start, pay_period_end);

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS idx_payroll_report_sent_log_provider
  ON public.payroll_report_sent_log (provider_id, pay_period_start);

-- RLS: only super_admin and admin roles can read/write
ALTER TABLE public.payroll_report_sent_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_report_sent_log'
      AND policyname = 'payroll_report_sent_log_admin_all'
  ) THEN
    CREATE POLICY payroll_report_sent_log_admin_all
      ON public.payroll_report_sent_log
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
      );
  END IF;
END $$;
