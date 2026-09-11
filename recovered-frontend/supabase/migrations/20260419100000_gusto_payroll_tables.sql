-- ─────────────────────────────────────────────────────────────────────────────
-- GUSTO PAYROLL DATA LAYER
-- All tables prefixed gusto_ to avoid collision with existing Dentrix tables.
-- Existing payroll tables are NEVER touched by this migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper function: check if user is super_admin ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'super_admin'
  )
$$;

-- ─── Helper function: check if user is admin or super_admin ──────────────────
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('super_admin', 'admin')
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. EMPLOYEES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_employees (
  id                              uuid PRIMARY KEY,
  analytics_id                    bigint,
  first_name                      text,
  last_name                       text,
  preferred_first_name            text,
  legal_first_name                text,
  middle_initial                  text,
  email                           text,
  birthday                        date,
  gender                          text,
  hire_date                       date,
  termination_date                date,
  status                          text,
  employment_type                 text,
  pay_frequency                   text,
  payment_method                  text,
  payment_method_amount_type      text,
  work_state                      text,
  work_address_id                 text,
  pay_schedule_id                 text,
  department_id                   text,
  current_manager_id              text,
  onboarding_status               text,
  benefits_eligible               boolean,
  benefits_enrolled               boolean,
  tax_exemption_category          text,
  fit_withholding_exempt          boolean,
  is_fulltime                     boolean,
  needs_new_hire_payroll          boolean,
  is_verified                     boolean,
  gusto_employee_id               text,
  two_percent_shareholder         boolean,
  run_termination_payrolls        boolean,
  company_id                      uuid,
  imported_at                     timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. PAYROLL RUNS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_payroll_runs (
  id                              uuid PRIMARY KEY,
  analytics_id                    bigint,
  pay_period_start                date,
  pay_period_end                  date,
  check_date                      date,
  debit_date                      date,
  total_net_pay                   numeric(12,2),
  total_direct_deposit_net_pay    numeric(12,2),
  total_payable_tax               numeric(12,2),
  total_tax                       numeric(12,2),
  total_debit_amount              numeric(12,2),
  total_reimbursement             numeric(12,2),
  total_garnishments              numeric(12,2),
  total_company_donations         numeric(12,2),
  off_cycle                       boolean,
  off_cycle_reason                text,
  external                        boolean,
  processed                       boolean,
  processing                      boolean,
  processed_at                    timestamptz,
  items_processed                 integer,
  items_to_process                integer,
  run_by_user_name                text,
  fast_ach                        boolean,
  reversed                        boolean,
  needs_reprocessing              boolean,
  is_cancellable                  boolean,
  has_reversals                   boolean,
  pay_schedule_id                 text,
  pay_schedule_name               text,
  employee_ids                    uuid[],
  reversed_employee_ids           uuid[],
  company_id                      uuid,
  created_at                      timestamptz,
  updated_at                      timestamptz,
  imported_at                     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. CONTRACTOR PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_contractor_payments (
  id                              text PRIMARY KEY,
  contractor_id                   text,
  contractor_name                 text,
  contractor_display_name         text,
  payment_method                  text,
  check_date                      date,
  debit_date                      date,
  funded                          boolean,
  cancelled                       boolean,
  hours_worked                    numeric(8,2),
  hourly_rate                     numeric(10,2),
  wage                            numeric(12,2),
  bonus                           numeric(12,2),
  tips_cash                       numeric(12,2),
  tips_payment                    numeric(12,2),
  reimbursement                   numeric(12,2),
  total_amount                    numeric(12,2),
  wage_type                       text,
  memo                            text,
  invoice_number                  text,
  contractor_payment_group_id     text,
  funds_return_date               date,
  company_id                      uuid,
  created_at                      timestamptz,
  imported_at                     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. BENEFIT PLANS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_benefit_plans (
  id                              text PRIMARY KEY,
  uuid                            uuid,
  plan_name                       text,
  benefit_type                    integer,
  benefit_category                text,
  active                          boolean,
  carrier_name                    text,
  carrier_state                   text,
  carrier_key                     text,
  renewal_month                   integer,
  internal_benefit                boolean,
  skippable                       boolean,
  company_id                      uuid,
  imported_at                     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. EMPLOYEE BENEFIT ENROLLMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_employee_benefit_enrollments (
  id                              text PRIMARY KEY,
  employee_id                     uuid REFERENCES public.gusto_employees(id) ON DELETE CASCADE,
  benefit_plan_id                 text REFERENCES public.gusto_benefit_plans(id) ON DELETE CASCADE,
  employee_deduction              numeric(10,2),
  company_contribution            numeric(10,2),
  coverage_amount                 numeric(12,2),
  deduct_as_percentage            boolean,
  contribute_as_percentage        boolean,
  employee_deduction_annual_max   numeric(12,2),
  company_contribution_annual_max numeric(12,2),
  active                          boolean,
  elective                        boolean,
  deduction_reduces_taxable_income text,
  coverage_salary_multiplier      numeric,
  imported_at                     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. PAY SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_pay_schedules (
  id                              text PRIMARY KEY,
  pay_period_type                 text,
  anchor_pay_day                  date,
  anchor_end_of_pay_period        date,
  day_of_week                     integer,
  is_arrears                      boolean,
  auto_pilot_eligible             boolean,
  auto_pilot                      boolean,
  next_auto_pilot_date            date,
  pay_frequency_description       text,
  schedule_name                   text,
  schedule_label                  text,
  ach_transfer_days               integer,
  last_payment_period_end_date    date,
  ineligible_employees            jsonb,
  company_id                      uuid,
  imported_at                     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- G. PAYROLL SUMMARY TOTALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_payroll_summary_by_year (
  id                              bigserial PRIMARY KEY,
  year                            integer,
  total_net_pay                   numeric(14,2),
  total_taxes                     numeric(14,2),
  total_gross_debit               numeric(14,2),
  total_reimbursements            numeric(14,2),
  total_contractor_spend          numeric(14,2),
  payroll_run_count               integer,
  off_cycle_run_count             integer,
  regular_run_count               integer,
  avg_employees_per_run           numeric(6,2),
  run_by_breakdown                jsonb,
  refreshed_at                    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- H. EMPLOYEE / PROVIDER CROSSWALK MAPPING
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_provider_crosswalk (
  id                              bigserial PRIMARY KEY,
  gusto_employee_id               uuid REFERENCES public.gusto_employees(id) ON DELETE CASCADE,
  dentrix_provider_id             text,
  dentrix_provider_name           text,
  office_id                       uuid,
  role_classification             text,
  mapping_status                  text DEFAULT 'unmatched',
  mapping_confidence              text,
  match_method                    text,
  active                          boolean DEFAULT true,
  manual_override                 boolean DEFAULT false,
  notes                           text,
  mapped_by                       uuid,
  mapped_at                       timestamptz,
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- I. COMPARISON RESULTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_comparison_results (
  id                              bigserial PRIMARY KEY,
  crosswalk_id                    bigint REFERENCES public.gusto_provider_crosswalk(id) ON DELETE SET NULL,
  gusto_employee_id               uuid,
  dentrix_provider_id             text,
  office_id                       uuid,
  pay_period_start                date,
  pay_period_end                  date,
  check_date                      date,
  role_type                       text,
  dentrix_gross_production        numeric(12,2),
  dentrix_adjusted_production     numeric(12,2),
  dentrix_collections             numeric(12,2),
  dentrix_payroll_percentage      numeric(6,4),
  dentrix_calculated_payout       numeric(12,2),
  gusto_net_pay                   numeric(12,2),
  gusto_gross_debit               numeric(12,2),
  gusto_taxes                     numeric(12,2),
  gusto_reimbursements            numeric(12,2),
  gusto_benefits_contribution     numeric(12,2),
  gusto_contractor_payout         numeric(12,2),
  variance_amount                 numeric(12,2),
  variance_percentage             numeric(8,4),
  payroll_source                  text,
  run_type                        text,
  is_active_employee              boolean,
  notes                           text,
  generated_at                    timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- J. IMPORT AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gusto_import_logs (
  id                              bigserial PRIMARY KEY,
  import_type                     text,
  status                          text,
  records_attempted               integer,
  records_inserted                integer,
  records_updated                 integer,
  records_skipped                 integer,
  records_failed                  integer,
  error_details                   jsonb,
  imported_by                     uuid,
  imported_by_name                text,
  source                          text,
  gusto_company_id                text,
  date_range_start                date,
  date_range_end                  date,
  started_at                      timestamptz DEFAULT now(),
  completed_at                    timestamptz,
  duration_seconds                numeric
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gusto_employees_status ON public.gusto_employees(status);
CREATE INDEX IF NOT EXISTS idx_gusto_employees_work_state ON public.gusto_employees(work_state);
CREATE INDEX IF NOT EXISTS idx_gusto_employees_pay_schedule ON public.gusto_employees(pay_schedule_id);
CREATE INDEX IF NOT EXISTS idx_gusto_payroll_runs_check_date ON public.gusto_payroll_runs(check_date);
CREATE INDEX IF NOT EXISTS idx_gusto_payroll_runs_pay_period ON public.gusto_payroll_runs(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_gusto_contractor_payments_check_date ON public.gusto_contractor_payments(check_date);
CREATE INDEX IF NOT EXISTS idx_gusto_contractor_payments_contractor ON public.gusto_contractor_payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_gusto_enrollments_employee ON public.gusto_employee_benefit_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_gusto_enrollments_plan ON public.gusto_employee_benefit_enrollments(benefit_plan_id);
CREATE INDEX IF NOT EXISTS idx_gusto_crosswalk_employee ON public.gusto_provider_crosswalk(gusto_employee_id);
CREATE INDEX IF NOT EXISTS idx_gusto_crosswalk_dentrix ON public.gusto_provider_crosswalk(dentrix_provider_id);
CREATE INDEX IF NOT EXISTS idx_gusto_comparison_period ON public.gusto_comparison_results(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_gusto_import_logs_type ON public.gusto_import_logs(import_type);
CREATE INDEX IF NOT EXISTS idx_gusto_import_logs_started ON public.gusto_import_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_gusto_summary_year ON public.gusto_payroll_summary_by_year(year);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gusto_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_benefit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_employee_benefit_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_pay_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_payroll_summary_by_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_provider_crosswalk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_comparison_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gusto_import_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_employees
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_employees_admin_read" ON public.gusto_employees;
CREATE POLICY "gusto_employees_admin_read"
ON public.gusto_employees FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_employees_super_admin_write" ON public.gusto_employees;
CREATE POLICY "gusto_employees_super_admin_write"
ON public.gusto_employees FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_payroll_runs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_payroll_runs_admin_read" ON public.gusto_payroll_runs;
CREATE POLICY "gusto_payroll_runs_admin_read"
ON public.gusto_payroll_runs FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_payroll_runs_super_admin_write" ON public.gusto_payroll_runs;
CREATE POLICY "gusto_payroll_runs_super_admin_write"
ON public.gusto_payroll_runs FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_contractor_payments
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_contractor_payments_admin_read" ON public.gusto_contractor_payments;
CREATE POLICY "gusto_contractor_payments_admin_read"
ON public.gusto_contractor_payments FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_contractor_payments_super_admin_write" ON public.gusto_contractor_payments;
CREATE POLICY "gusto_contractor_payments_super_admin_write"
ON public.gusto_contractor_payments FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_benefit_plans
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_benefit_plans_admin_read" ON public.gusto_benefit_plans;
CREATE POLICY "gusto_benefit_plans_admin_read"
ON public.gusto_benefit_plans FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_benefit_plans_super_admin_write" ON public.gusto_benefit_plans;
CREATE POLICY "gusto_benefit_plans_super_admin_write"
ON public.gusto_benefit_plans FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_employee_benefit_enrollments
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_enrollments_admin_read" ON public.gusto_employee_benefit_enrollments;
CREATE POLICY "gusto_enrollments_admin_read"
ON public.gusto_employee_benefit_enrollments FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_enrollments_super_admin_write" ON public.gusto_employee_benefit_enrollments;
CREATE POLICY "gusto_enrollments_super_admin_write"
ON public.gusto_employee_benefit_enrollments FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_pay_schedules
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_pay_schedules_admin_read" ON public.gusto_pay_schedules;
CREATE POLICY "gusto_pay_schedules_admin_read"
ON public.gusto_pay_schedules FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_pay_schedules_super_admin_write" ON public.gusto_pay_schedules;
CREATE POLICY "gusto_pay_schedules_super_admin_write"
ON public.gusto_pay_schedules FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_payroll_summary_by_year
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_summary_admin_read" ON public.gusto_payroll_summary_by_year;
CREATE POLICY "gusto_summary_admin_read"
ON public.gusto_payroll_summary_by_year FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_summary_super_admin_write" ON public.gusto_payroll_summary_by_year;
CREATE POLICY "gusto_summary_super_admin_write"
ON public.gusto_payroll_summary_by_year FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_provider_crosswalk
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_crosswalk_admin_read" ON public.gusto_provider_crosswalk;
CREATE POLICY "gusto_crosswalk_admin_read"
ON public.gusto_provider_crosswalk FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_crosswalk_super_admin_write" ON public.gusto_provider_crosswalk;
CREATE POLICY "gusto_crosswalk_super_admin_write"
ON public.gusto_provider_crosswalk FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_comparison_results
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_comparison_admin_read" ON public.gusto_comparison_results;
CREATE POLICY "gusto_comparison_admin_read"
ON public.gusto_comparison_results FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_comparison_super_admin_write" ON public.gusto_comparison_results;
CREATE POLICY "gusto_comparison_super_admin_write"
ON public.gusto_comparison_results FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES — gusto_import_logs
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gusto_import_logs_admin_read" ON public.gusto_import_logs;
CREATE POLICY "gusto_import_logs_admin_read"
ON public.gusto_import_logs FOR SELECT TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "gusto_import_logs_super_admin_write" ON public.gusto_import_logs;
CREATE POLICY "gusto_import_logs_super_admin_write"
ON public.gusto_import_logs FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
