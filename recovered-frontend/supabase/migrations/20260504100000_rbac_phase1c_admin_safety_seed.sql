-- ============================================================
-- RBAC Phase 1C — Admin Safety Seed
-- Checkpoint: RBAC Phase 1C Admin safety seed — no enforcement — no launch
--
-- Purpose:
--   Correct admin role_permissions rows that are currently false
--   but represent pages/tabs Admin effectively has access to today
--   via __all bypass or hardcoded role arrays.
--
--   This migration prepares Admin DB rows to match current effective
--   Admin access BEFORE Admin is removed from the __all bypass in a
--   future phase. Without this correction, removing Admin from __all
--   would lock Admin out of Executive Overview, Payroll, Payroll Audit,
--   Payroll Sync, Provider Performance, and all Payroll sub-tabs.
--
-- Scope:
--   - ONLY role = 'admin'
--   - ONLY the 17 specific keys listed below
--   - Uses INSERT ... ON CONFLICT (role, permission) DO UPDATE SET enabled = true
--   - No ALTER TABLE
--   - No DROP
--   - No DELETE
--   - No new table
--   - No enforcement change
--   - No route/page/tab/navConfig behavior change
--   - No schema structural change
--
-- Keys changed (17 total):
--   Legacy/enforced:
--     dashboard:executive_overview
--     performance:provider_view
--
--   Finance / Payroll nav:
--     finance.payroll.view
--     finance.payroll_audit.view
--     finance.payroll_sync.view
--
--   Payroll sub-tabs (12):
--     finance.payroll.dentrix_ascend.view
--     finance.payroll.gusto.view
--     finance.payroll.gusto.overview.view
--     finance.payroll.gusto.employees.view
--     finance.payroll.gusto.payroll_runs.view
--     finance.payroll.gusto.contractors.view
--     finance.payroll.gusto.benefits.view
--     finance.payroll.gusto.pay_schedules.view
--     finance.payroll.gusto.import_history.view
--     finance.payroll.gusto.time_attendance.view
--     finance.payroll.comparison.view
--     finance.payroll.provider_compensation.view
-- ============================================================

INSERT INTO public.role_permissions (role, permission, enabled, updated_at)
VALUES
  -- Legacy / enforced keys
  ('admin', 'dashboard:executive_overview',                  true, now()),
  ('admin', 'performance:provider_view',                     true, now()),

  -- Finance / Payroll nav
  ('admin', 'finance.payroll.view',                          true, now()),
  ('admin', 'finance.payroll_audit.view',                    true, now()),
  ('admin', 'finance.payroll_sync.view',                     true, now()),

  -- Payroll sub-tabs
  ('admin', 'finance.payroll.dentrix_ascend.view',           true, now()),
  ('admin', 'finance.payroll.gusto.view',                    true, now()),
  ('admin', 'finance.payroll.gusto.overview.view',           true, now()),
  ('admin', 'finance.payroll.gusto.employees.view',          true, now()),
  ('admin', 'finance.payroll.gusto.payroll_runs.view',       true, now()),
  ('admin', 'finance.payroll.gusto.contractors.view',        true, now()),
  ('admin', 'finance.payroll.gusto.benefits.view',           true, now()),
  ('admin', 'finance.payroll.gusto.pay_schedules.view',      true, now()),
  ('admin', 'finance.payroll.gusto.import_history.view',     true, now()),
  ('admin', 'finance.payroll.gusto.time_attendance.view',    true, now()),
  ('admin', 'finance.payroll.comparison.view',               true, now()),
  ('admin', 'finance.payroll.provider_compensation.view',    true, now())

ON CONFLICT (role, permission)
DO UPDATE SET
  enabled    = true,
  updated_at = now();
