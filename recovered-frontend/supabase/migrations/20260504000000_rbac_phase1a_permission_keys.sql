-- ============================================================
-- RBAC Phase 1A — Navigation + Sub-Tab Permission Key Seed
-- Checkpoint: RBAC Phase 1A Permission-Key Foundation + Role Editor UI — no launch
-- ============================================================
-- RULES:
--   • INSERT ... ON CONFLICT DO NOTHING only
--   • No ALTER TABLE
--   • No new tables
--   • No deletion of existing rows
--   • No overwrite of existing permissions
--   • No enforcement change — keys are available in Role Editor only
-- ============================================================

-- ── Navigation Access: Home ───────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'home.overview.view', true),
  ('admin',                    'home.overview.view', true),
  ('regional_manager',         'home.overview.view', true),
  ('regional_clinical_manager','home.overview.view', true),
  ('front_desk',               'home.overview.view', false),
  ('staff',                    'home.overview.view', false),
  ('doctor',                   'home.overview.view', false),
  ('hygienist',                'home.overview.view', false),
  ('office_manager',           'home.overview.view', false),
  ('treatment_coordinator',    'home.overview.view', false),
  ('rda',                      'home.overview.view', false),
  ('clinical_manager',         'home.overview.view', false),
  ('dental_assistant',         'home.overview.view', false)
ON CONFLICT DO NOTHING;

-- ── Navigation Access: Performance ───────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.kpis.view', true),
  ('admin',                    'performance.kpis.view', true),
  ('regional_manager',         'performance.kpis.view', true),
  ('regional_clinical_manager','performance.kpis.view', true),
  ('front_desk',               'performance.kpis.view', false),
  ('staff',                    'performance.kpis.view', false),
  ('doctor',                   'performance.kpis.view', false),
  ('hygienist',                'performance.kpis.view', false),
  ('office_manager',           'performance.kpis.view', false),
  ('treatment_coordinator',    'performance.kpis.view', false),
  ('rda',                      'performance.kpis.view', false),
  ('clinical_manager',         'performance.kpis.view', false),
  ('dental_assistant',         'performance.kpis.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.operations.view', true),
  ('admin',                    'performance.operations.view', true),
  ('regional_manager',         'performance.operations.view', true),
  ('regional_clinical_manager','performance.operations.view', true),
  ('front_desk',               'performance.operations.view', false),
  ('staff',                    'performance.operations.view', false),
  ('doctor',                   'performance.operations.view', false),
  ('hygienist',                'performance.operations.view', false),
  ('office_manager',           'performance.operations.view', false),
  ('treatment_coordinator',    'performance.operations.view', false),
  ('rda',                      'performance.operations.view', false),
  ('clinical_manager',         'performance.operations.view', false),
  ('dental_assistant',         'performance.operations.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.office_performance.view', true),
  ('admin',                    'performance.office_performance.view', true),
  ('regional_manager',         'performance.office_performance.view', true),
  ('regional_clinical_manager','performance.office_performance.view', true),
  ('front_desk',               'performance.office_performance.view', false),
  ('staff',                    'performance.office_performance.view', false),
  ('doctor',                   'performance.office_performance.view', false),
  ('hygienist',                'performance.office_performance.view', false),
  ('office_manager',           'performance.office_performance.view', false),
  ('treatment_coordinator',    'performance.office_performance.view', false),
  ('rda',                      'performance.office_performance.view', false),
  ('clinical_manager',         'performance.office_performance.view', false),
  ('dental_assistant',         'performance.office_performance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.provider_performance.view', true),
  ('admin',                    'performance.provider_performance.view', true),
  ('regional_manager',         'performance.provider_performance.view', false),
  ('regional_clinical_manager','performance.provider_performance.view', false),
  ('front_desk',               'performance.provider_performance.view', false),
  ('staff',                    'performance.provider_performance.view', false),
  ('doctor',                   'performance.provider_performance.view', false),
  ('hygienist',                'performance.provider_performance.view', false),
  ('office_manager',           'performance.provider_performance.view', false),
  ('treatment_coordinator',    'performance.provider_performance.view', false),
  ('rda',                      'performance.provider_performance.view', false),
  ('clinical_manager',         'performance.provider_performance.view', false),
  ('dental_assistant',         'performance.provider_performance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.monthly_trends.view', true),
  ('admin',                    'performance.monthly_trends.view', true),
  ('regional_manager',         'performance.monthly_trends.view', false),
  ('regional_clinical_manager','performance.monthly_trends.view', true),
  ('front_desk',               'performance.monthly_trends.view', false),
  ('staff',                    'performance.monthly_trends.view', false),
  ('doctor',                   'performance.monthly_trends.view', false),
  ('hygienist',                'performance.monthly_trends.view', false),
  ('office_manager',           'performance.monthly_trends.view', true),
  ('treatment_coordinator',    'performance.monthly_trends.view', false),
  ('rda',                      'performance.monthly_trends.view', false),
  ('clinical_manager',         'performance.monthly_trends.view', false),
  ('dental_assistant',         'performance.monthly_trends.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'performance.regional_manager.view', true),
  ('admin',                    'performance.regional_manager.view', false),
  ('regional_manager',         'performance.regional_manager.view', false),
  ('regional_clinical_manager','performance.regional_manager.view', true),
  ('front_desk',               'performance.regional_manager.view', false),
  ('staff',                    'performance.regional_manager.view', false),
  ('doctor',                   'performance.regional_manager.view', false),
  ('hygienist',                'performance.regional_manager.view', false),
  ('office_manager',           'performance.regional_manager.view', false),
  ('treatment_coordinator',    'performance.regional_manager.view', false),
  ('rda',                      'performance.regional_manager.view', false),
  ('clinical_manager',         'performance.regional_manager.view', false),
  ('dental_assistant',         'performance.regional_manager.view', false)
ON CONFLICT DO NOTHING;

-- ── Navigation Access: Finance ────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.payroll.view', true),
  ('admin',                    'finance.payroll.view', false),
  ('regional_manager',         'finance.payroll.view', false),
  ('regional_clinical_manager','finance.payroll.view', false),
  ('front_desk',               'finance.payroll.view', false),
  ('staff',                    'finance.payroll.view', false),
  ('doctor',                   'finance.payroll.view', false),
  ('hygienist',                'finance.payroll.view', false),
  ('office_manager',           'finance.payroll.view', false),
  ('treatment_coordinator',    'finance.payroll.view', false),
  ('rda',                      'finance.payroll.view', false),
  ('clinical_manager',         'finance.payroll.view', false),
  ('dental_assistant',         'finance.payroll.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.payroll_audit.view', true),
  ('admin',                    'finance.payroll_audit.view', false),
  ('regional_manager',         'finance.payroll_audit.view', false),
  ('regional_clinical_manager','finance.payroll_audit.view', false),
  ('front_desk',               'finance.payroll_audit.view', false),
  ('staff',                    'finance.payroll_audit.view', false),
  ('doctor',                   'finance.payroll_audit.view', false),
  ('hygienist',                'finance.payroll_audit.view', false),
  ('office_manager',           'finance.payroll_audit.view', false),
  ('treatment_coordinator',    'finance.payroll_audit.view', false),
  ('rda',                      'finance.payroll_audit.view', false),
  ('clinical_manager',         'finance.payroll_audit.view', false),
  ('dental_assistant',         'finance.payroll_audit.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.payroll_sync.view', true),
  ('admin',                    'finance.payroll_sync.view', false),
  ('regional_manager',         'finance.payroll_sync.view', false),
  ('regional_clinical_manager','finance.payroll_sync.view', false),
  ('front_desk',               'finance.payroll_sync.view', false),
  ('staff',                    'finance.payroll_sync.view', false),
  ('doctor',                   'finance.payroll_sync.view', false),
  ('hygienist',                'finance.payroll_sync.view', false),
  ('office_manager',           'finance.payroll_sync.view', false),
  ('treatment_coordinator',    'finance.payroll_sync.view', false),
  ('rda',                      'finance.payroll_sync.view', false),
  ('clinical_manager',         'finance.payroll_sync.view', false),
  ('dental_assistant',         'finance.payroll_sync.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.finance.view', true),
  ('admin',                    'finance.finance.view', true),
  ('regional_manager',         'finance.finance.view', true),
  ('regional_clinical_manager','finance.finance.view', true),
  ('front_desk',               'finance.finance.view', false),
  ('staff',                    'finance.finance.view', false),
  ('doctor',                   'finance.finance.view', false),
  ('hygienist',                'finance.finance.view', false),
  ('office_manager',           'finance.finance.view', false),
  ('treatment_coordinator',    'finance.finance.view', false),
  ('rda',                      'finance.finance.view', false),
  ('clinical_manager',         'finance.finance.view', false),
  ('dental_assistant',         'finance.finance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.expenses.view', true),
  ('admin',                    'finance.expenses.view', true),
  ('regional_manager',         'finance.expenses.view', true),
  ('regional_clinical_manager','finance.expenses.view', true),
  ('front_desk',               'finance.expenses.view', false),
  ('staff',                    'finance.expenses.view', false),
  ('doctor',                   'finance.expenses.view', false),
  ('hygienist',                'finance.expenses.view', false),
  ('office_manager',           'finance.expenses.view', false),
  ('treatment_coordinator',    'finance.expenses.view', false),
  ('rda',                      'finance.expenses.view', false),
  ('clinical_manager',         'finance.expenses.view', false),
  ('dental_assistant',         'finance.expenses.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.rcm.view', true),
  ('admin',                    'finance.rcm.view', true),
  ('regional_manager',         'finance.rcm.view', true),
  ('regional_clinical_manager','finance.rcm.view', true),
  ('front_desk',               'finance.rcm.view', false),
  ('staff',                    'finance.rcm.view', false),
  ('doctor',                   'finance.rcm.view', false),
  ('hygienist',                'finance.rcm.view', false),
  ('office_manager',           'finance.rcm.view', false),
  ('treatment_coordinator',    'finance.rcm.view', false),
  ('rda',                      'finance.rcm.view', false),
  ('clinical_manager',         'finance.rcm.view', false),
  ('dental_assistant',         'finance.rcm.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.audit.view', true),
  ('admin',                    'finance.audit.view', true),
  ('regional_manager',         'finance.audit.view', true),
  ('regional_clinical_manager','finance.audit.view', true),
  ('front_desk',               'finance.audit.view', false),
  ('staff',                    'finance.audit.view', false),
  ('doctor',                   'finance.audit.view', false),
  ('hygienist',                'finance.audit.view', false),
  ('office_manager',           'finance.audit.view', false),
  ('treatment_coordinator',    'finance.audit.view', false),
  ('rda',                      'finance.audit.view', false),
  ('clinical_manager',         'finance.audit.view', false),
  ('dental_assistant',         'finance.audit.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.audit_log.view', true),
  ('admin',                    'finance.audit_log.view', true),
  ('regional_manager',         'finance.audit_log.view', false),
  ('regional_clinical_manager','finance.audit_log.view', false),
  ('front_desk',               'finance.audit_log.view', false),
  ('staff',                    'finance.audit_log.view', false),
  ('doctor',                   'finance.audit_log.view', false),
  ('hygienist',                'finance.audit_log.view', false),
  ('office_manager',           'finance.audit_log.view', false),
  ('treatment_coordinator',    'finance.audit_log.view', false),
  ('rda',                      'finance.audit_log.view', false),
  ('clinical_manager',         'finance.audit_log.view', false),
  ('dental_assistant',         'finance.audit_log.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.audit_reports.view', true),
  ('admin',                    'finance.audit_reports.view', true),
  ('regional_manager',         'finance.audit_reports.view', false),
  ('regional_clinical_manager','finance.audit_reports.view', false),
  ('front_desk',               'finance.audit_reports.view', false),
  ('staff',                    'finance.audit_reports.view', false),
  ('doctor',                   'finance.audit_reports.view', false),
  ('hygienist',                'finance.audit_reports.view', false),
  ('office_manager',           'finance.audit_reports.view', false),
  ('treatment_coordinator',    'finance.audit_reports.view', false),
  ('rda',                      'finance.audit_reports.view', false),
  ('clinical_manager',         'finance.audit_reports.view', false),
  ('dental_assistant',         'finance.audit_reports.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.compliance.view', true),
  ('admin',                    'finance.compliance.view', true),
  ('regional_manager',         'finance.compliance.view', false),
  ('regional_clinical_manager','finance.compliance.view', false),
  ('front_desk',               'finance.compliance.view', false),
  ('staff',                    'finance.compliance.view', false),
  ('doctor',                   'finance.compliance.view', false),
  ('hygienist',                'finance.compliance.view', false),
  ('office_manager',           'finance.compliance.view', false),
  ('treatment_coordinator',    'finance.compliance.view', false),
  ('rda',                      'finance.compliance.view', false),
  ('clinical_manager',         'finance.compliance.view', false),
  ('dental_assistant',         'finance.compliance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.heatmap.view', true),
  ('admin',                    'finance.heatmap.view', true),
  ('regional_manager',         'finance.heatmap.view', false),
  ('regional_clinical_manager','finance.heatmap.view', false),
  ('front_desk',               'finance.heatmap.view', false),
  ('staff',                    'finance.heatmap.view', false),
  ('doctor',                   'finance.heatmap.view', false),
  ('hygienist',                'finance.heatmap.view', false),
  ('office_manager',           'finance.heatmap.view', false),
  ('treatment_coordinator',    'finance.heatmap.view', false),
  ('rda',                      'finance.heatmap.view', false),
  ('clinical_manager',         'finance.heatmap.view', false),
  ('dental_assistant',         'finance.heatmap.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.alerts.view', true),
  ('admin',                    'finance.alerts.view', true),
  ('regional_manager',         'finance.alerts.view', false),
  ('regional_clinical_manager','finance.alerts.view', false),
  ('front_desk',               'finance.alerts.view', false),
  ('staff',                    'finance.alerts.view', false),
  ('doctor',                   'finance.alerts.view', false),
  ('hygienist',                'finance.alerts.view', false),
  ('office_manager',           'finance.alerts.view', false),
  ('treatment_coordinator',    'finance.alerts.view', false),
  ('rda',                      'finance.alerts.view', false),
  ('clinical_manager',         'finance.alerts.view', false),
  ('dental_assistant',         'finance.alerts.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'finance.error_logs.view', true),
  ('admin',                    'finance.error_logs.view', true),
  ('regional_manager',         'finance.error_logs.view', false),
  ('regional_clinical_manager','finance.error_logs.view', false),
  ('front_desk',               'finance.error_logs.view', false),
  ('staff',                    'finance.error_logs.view', false),
  ('doctor',                   'finance.error_logs.view', false),
  ('hygienist',                'finance.error_logs.view', false),
  ('office_manager',           'finance.error_logs.view', false),
  ('treatment_coordinator',    'finance.error_logs.view', false),
  ('rda',                      'finance.error_logs.view', false),
  ('clinical_manager',         'finance.error_logs.view', false),
  ('dental_assistant',         'finance.error_logs.view', false)
ON CONFLICT DO NOTHING;

-- ── Navigation Access: Workflow ───────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.huddle.view', true),
  ('admin',                    'workflow.huddle.view', true),
  ('regional_manager',         'workflow.huddle.view', true),
  ('regional_clinical_manager','workflow.huddle.view', true),
  ('front_desk',               'workflow.huddle.view', true),
  ('staff',                    'workflow.huddle.view', true),
  ('doctor',                   'workflow.huddle.view', true),
  ('hygienist',                'workflow.huddle.view', true),
  ('office_manager',           'workflow.huddle.view', true),
  ('treatment_coordinator',    'workflow.huddle.view', true),
  ('rda',                      'workflow.huddle.view', true),
  ('clinical_manager',         'workflow.huddle.view', true),
  ('dental_assistant',         'workflow.huddle.view', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.insurance.view', true),
  ('admin',                    'workflow.insurance.view', true),
  ('regional_manager',         'workflow.insurance.view', true),
  ('regional_clinical_manager','workflow.insurance.view', true),
  ('front_desk',               'workflow.insurance.view', true),
  ('staff',                    'workflow.insurance.view', true),
  ('doctor',                   'workflow.insurance.view', true),
  ('hygienist',                'workflow.insurance.view', true),
  ('office_manager',           'workflow.insurance.view', true),
  ('treatment_coordinator',    'workflow.insurance.view', true),
  ('rda',                      'workflow.insurance.view', true),
  ('clinical_manager',         'workflow.insurance.view', true),
  ('dental_assistant',         'workflow.insurance.view', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.eod.view', true),
  ('admin',                    'workflow.eod.view', true),
  ('regional_manager',         'workflow.eod.view', true),
  ('regional_clinical_manager','workflow.eod.view', true),
  ('front_desk',               'workflow.eod.view', true),
  ('staff',                    'workflow.eod.view', true),
  ('doctor',                   'workflow.eod.view', true),
  ('hygienist',                'workflow.eod.view', true),
  ('office_manager',           'workflow.eod.view', true),
  ('treatment_coordinator',    'workflow.eod.view', true),
  ('rda',                      'workflow.eod.view', true),
  ('clinical_manager',         'workflow.eod.view', true),
  ('dental_assistant',         'workflow.eod.view', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.tasks.view', true),
  ('admin',                    'workflow.tasks.view', true),
  ('regional_manager',         'workflow.tasks.view', true),
  ('regional_clinical_manager','workflow.tasks.view', true),
  ('front_desk',               'workflow.tasks.view', true),
  ('staff',                    'workflow.tasks.view', true),
  ('doctor',                   'workflow.tasks.view', true),
  ('hygienist',                'workflow.tasks.view', true),
  ('office_manager',           'workflow.tasks.view', true),
  ('treatment_coordinator',    'workflow.tasks.view', true),
  ('rda',                      'workflow.tasks.view', true),
  ('clinical_manager',         'workflow.tasks.view', true),
  ('dental_assistant',         'workflow.tasks.view', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.eod_queue.view', true),
  ('admin',                    'workflow.eod_queue.view', true),
  ('regional_manager',         'workflow.eod_queue.view', true),
  ('regional_clinical_manager','workflow.eod_queue.view', true),
  ('front_desk',               'workflow.eod_queue.view', false),
  ('staff',                    'workflow.eod_queue.view', false),
  ('doctor',                   'workflow.eod_queue.view', false),
  ('hygienist',                'workflow.eod_queue.view', false),
  ('office_manager',           'workflow.eod_queue.view', false),
  ('treatment_coordinator',    'workflow.eod_queue.view', false),
  ('rda',                      'workflow.eod_queue.view', false),
  ('clinical_manager',         'workflow.eod_queue.view', false),
  ('dental_assistant',         'workflow.eod_queue.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.approvals.view', true),
  ('admin',                    'workflow.approvals.view', true),
  ('regional_manager',         'workflow.approvals.view', false),
  ('regional_clinical_manager','workflow.approvals.view', false),
  ('front_desk',               'workflow.approvals.view', false),
  ('staff',                    'workflow.approvals.view', false),
  ('doctor',                   'workflow.approvals.view', false),
  ('hygienist',                'workflow.approvals.view', false),
  ('office_manager',           'workflow.approvals.view', false),
  ('treatment_coordinator',    'workflow.approvals.view', false),
  ('rda',                      'workflow.approvals.view', false),
  ('clinical_manager',         'workflow.approvals.view', false),
  ('dental_assistant',         'workflow.approvals.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'workflow.huddle_queue.view', true),
  ('admin',                    'workflow.huddle_queue.view', true),
  ('regional_manager',         'workflow.huddle_queue.view', true),
  ('regional_clinical_manager','workflow.huddle_queue.view', true),
  ('front_desk',               'workflow.huddle_queue.view', false),
  ('staff',                    'workflow.huddle_queue.view', false),
  ('doctor',                   'workflow.huddle_queue.view', false),
  ('hygienist',                'workflow.huddle_queue.view', false),
  ('office_manager',           'workflow.huddle_queue.view', false),
  ('treatment_coordinator',    'workflow.huddle_queue.view', false),
  ('rda',                      'workflow.huddle_queue.view', false),
  ('clinical_manager',         'workflow.huddle_queue.view', false),
  ('dental_assistant',         'workflow.huddle_queue.view', false)
ON CONFLICT DO NOTHING;

-- ── Navigation Access: Resources ─────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'resources.reports.view', true),
  ('admin',                    'resources.reports.view', true),
  ('regional_manager',         'resources.reports.view', true),
  ('regional_clinical_manager','resources.reports.view', true),
  ('front_desk',               'resources.reports.view', false),
  ('staff',                    'resources.reports.view', false),
  ('doctor',                   'resources.reports.view', false),
  ('hygienist',                'resources.reports.view', false),
  ('office_manager',           'resources.reports.view', false),
  ('treatment_coordinator',    'resources.reports.view', false),
  ('rda',                      'resources.reports.view', false),
  ('clinical_manager',         'resources.reports.view', false),
  ('dental_assistant',         'resources.reports.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'resources.inventory.view', true),
  ('admin',                    'resources.inventory.view', true),
  ('regional_manager',         'resources.inventory.view', true),
  ('regional_clinical_manager','resources.inventory.view', true),
  ('front_desk',               'resources.inventory.view', true),
  ('staff',                    'resources.inventory.view', true),
  ('doctor',                   'resources.inventory.view', false),
  ('hygienist',                'resources.inventory.view', false),
  ('office_manager',           'resources.inventory.view', true),
  ('treatment_coordinator',    'resources.inventory.view', false),
  ('rda',                      'resources.inventory.view', true),
  ('clinical_manager',         'resources.inventory.view', true),
  ('dental_assistant',         'resources.inventory.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'resources.directory.view', true),
  ('admin',                    'resources.directory.view', true),
  ('regional_manager',         'resources.directory.view', true),
  ('regional_clinical_manager','resources.directory.view', true),
  ('front_desk',               'resources.directory.view', true),
  ('staff',                    'resources.directory.view', true),
  ('doctor',                   'resources.directory.view', true),
  ('hygienist',                'resources.directory.view', true),
  ('office_manager',           'resources.directory.view', true),
  ('treatment_coordinator',    'resources.directory.view', true),
  ('rda',                      'resources.directory.view', true),
  ('clinical_manager',         'resources.directory.view', true),
  ('dental_assistant',         'resources.directory.view', true)
ON CONFLICT DO NOTHING;

-- ── Navigation Access: Admin ──────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.users.view', true),
  ('admin',                    'admin.users.view', true),
  ('regional_manager',         'admin.users.view', false),
  ('regional_clinical_manager','admin.users.view', false),
  ('front_desk',               'admin.users.view', false),
  ('staff',                    'admin.users.view', false),
  ('doctor',                   'admin.users.view', false),
  ('hygienist',                'admin.users.view', false),
  ('office_manager',           'admin.users.view', false),
  ('treatment_coordinator',    'admin.users.view', false),
  ('rda',                      'admin.users.view', false),
  ('clinical_manager',         'admin.users.view', false),
  ('dental_assistant',         'admin.users.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.users.role_editor.view', true),
  ('admin',                    'admin.users.role_editor.view', false),
  ('regional_manager',         'admin.users.role_editor.view', false),
  ('regional_clinical_manager','admin.users.role_editor.view', false),
  ('front_desk',               'admin.users.role_editor.view', false),
  ('staff',                    'admin.users.role_editor.view', false),
  ('doctor',                   'admin.users.role_editor.view', false),
  ('hygienist',                'admin.users.role_editor.view', false),
  ('office_manager',           'admin.users.role_editor.view', false),
  ('treatment_coordinator',    'admin.users.role_editor.view', false),
  ('rda',                      'admin.users.role_editor.view', false),
  ('clinical_manager',         'admin.users.role_editor.view', false),
  ('dental_assistant',         'admin.users.role_editor.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.providers.view', true),
  ('admin',                    'admin.providers.view', true),
  ('regional_manager',         'admin.providers.view', false),
  ('regional_clinical_manager','admin.providers.view', false),
  ('front_desk',               'admin.providers.view', false),
  ('staff',                    'admin.providers.view', false),
  ('doctor',                   'admin.providers.view', false),
  ('hygienist',                'admin.providers.view', false),
  ('office_manager',           'admin.providers.view', false),
  ('treatment_coordinator',    'admin.providers.view', false),
  ('rda',                      'admin.providers.view', false),
  ('clinical_manager',         'admin.providers.view', false),
  ('dental_assistant',         'admin.providers.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.settings.view', true),
  ('admin',                    'admin.settings.view', false),
  ('regional_manager',         'admin.settings.view', false),
  ('regional_clinical_manager','admin.settings.view', false),
  ('front_desk',               'admin.settings.view', false),
  ('staff',                    'admin.settings.view', false),
  ('doctor',                   'admin.settings.view', false),
  ('hygienist',                'admin.settings.view', false),
  ('office_manager',           'admin.settings.view', false),
  ('treatment_coordinator',    'admin.settings.view', false),
  ('rda',                      'admin.settings.view', false),
  ('clinical_manager',         'admin.settings.view', false),
  ('dental_assistant',         'admin.settings.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.sync.view', true),
  ('admin',                    'admin.sync.view', true),
  ('regional_manager',         'admin.sync.view', false),
  ('regional_clinical_manager','admin.sync.view', false),
  ('front_desk',               'admin.sync.view', false),
  ('staff',                    'admin.sync.view', false),
  ('doctor',                   'admin.sync.view', false),
  ('hygienist',                'admin.sync.view', false),
  ('office_manager',           'admin.sync.view', false),
  ('treatment_coordinator',    'admin.sync.view', false),
  ('rda',                      'admin.sync.view', false),
  ('clinical_manager',         'admin.sync.view', false),
  ('dental_assistant',         'admin.sync.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.data_health.view', true),
  ('admin',                    'admin.data_health.view', true),
  ('regional_manager',         'admin.data_health.view', false),
  ('regional_clinical_manager','admin.data_health.view', false),
  ('front_desk',               'admin.data_health.view', false),
  ('staff',                    'admin.data_health.view', false),
  ('doctor',                   'admin.data_health.view', false),
  ('hygienist',                'admin.data_health.view', false),
  ('office_manager',           'admin.data_health.view', false),
  ('treatment_coordinator',    'admin.data_health.view', false),
  ('rda',                      'admin.data_health.view', false),
  ('clinical_manager',         'admin.data_health.view', false),
  ('dental_assistant',         'admin.data_health.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.import_audit.view', true),
  ('admin',                    'admin.import_audit.view', true),
  ('regional_manager',         'admin.import_audit.view', false),
  ('regional_clinical_manager','admin.import_audit.view', false),
  ('front_desk',               'admin.import_audit.view', false),
  ('staff',                    'admin.import_audit.view', false),
  ('doctor',                   'admin.import_audit.view', false),
  ('hygienist',                'admin.import_audit.view', false),
  ('office_manager',           'admin.import_audit.view', false),
  ('treatment_coordinator',    'admin.import_audit.view', false),
  ('rda',                      'admin.import_audit.view', false),
  ('clinical_manager',         'admin.import_audit.view', false),
  ('dental_assistant',         'admin.import_audit.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.manual_entry.view', true),
  ('admin',                    'admin.manual_entry.view', true),
  ('regional_manager',         'admin.manual_entry.view', true),
  ('regional_clinical_manager','admin.manual_entry.view', false),
  ('front_desk',               'admin.manual_entry.view', false),
  ('staff',                    'admin.manual_entry.view', false),
  ('doctor',                   'admin.manual_entry.view', false),
  ('hygienist',                'admin.manual_entry.view', false),
  ('office_manager',           'admin.manual_entry.view', false),
  ('treatment_coordinator',    'admin.manual_entry.view', false),
  ('rda',                      'admin.manual_entry.view', false),
  ('clinical_manager',         'admin.manual_entry.view', false),
  ('dental_assistant',         'admin.manual_entry.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.system.view', true),
  ('admin',                    'admin.system.view', true),
  ('regional_manager',         'admin.system.view', false),
  ('regional_clinical_manager','admin.system.view', false),
  ('front_desk',               'admin.system.view', false),
  ('staff',                    'admin.system.view', false),
  ('doctor',                   'admin.system.view', false),
  ('hygienist',                'admin.system.view', false),
  ('office_manager',           'admin.system.view', false),
  ('treatment_coordinator',    'admin.system.view', false),
  ('rda',                      'admin.system.view', false),
  ('clinical_manager',         'admin.system.view', false),
  ('dental_assistant',         'admin.system.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.reconciliation.view', true),
  ('admin',                    'admin.reconciliation.view', false),
  ('regional_manager',         'admin.reconciliation.view', false),
  ('regional_clinical_manager','admin.reconciliation.view', false),
  ('front_desk',               'admin.reconciliation.view', false),
  ('staff',                    'admin.reconciliation.view', false),
  ('doctor',                   'admin.reconciliation.view', false),
  ('hygienist',                'admin.reconciliation.view', false),
  ('office_manager',           'admin.reconciliation.view', false),
  ('treatment_coordinator',    'admin.reconciliation.view', false),
  ('rda',                      'admin.reconciliation.view', false),
  ('clinical_manager',         'admin.reconciliation.view', false),
  ('dental_assistant',         'admin.reconciliation.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin',              'admin.alert_thresholds.view', true),
  ('admin',                    'admin.alert_thresholds.view', false),
  ('regional_manager',         'admin.alert_thresholds.view', false),
  ('regional_clinical_manager','admin.alert_thresholds.view', false),
  ('front_desk',               'admin.alert_thresholds.view', false),
  ('staff',                    'admin.alert_thresholds.view', false),
  ('doctor',                   'admin.alert_thresholds.view', false),
  ('hygienist',                'admin.alert_thresholds.view', false),
  ('office_manager',           'admin.alert_thresholds.view', false),
  ('treatment_coordinator',    'admin.alert_thresholds.view', false),
  ('rda',                      'admin.alert_thresholds.view', false),
  ('clinical_manager',         'admin.alert_thresholds.view', false),
  ('dental_assistant',         'admin.alert_thresholds.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Payroll ───────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.dentrix_ascend.view', true),
  ('admin',       'finance.payroll.dentrix_ascend.view', false),
  ('regional_manager','finance.payroll.dentrix_ascend.view', false),
  ('regional_clinical_manager','finance.payroll.dentrix_ascend.view', false),
  ('front_desk',  'finance.payroll.dentrix_ascend.view', false),
  ('staff',       'finance.payroll.dentrix_ascend.view', false),
  ('doctor',      'finance.payroll.dentrix_ascend.view', false),
  ('hygienist',   'finance.payroll.dentrix_ascend.view', false),
  ('office_manager','finance.payroll.dentrix_ascend.view', false),
  ('treatment_coordinator','finance.payroll.dentrix_ascend.view', false),
  ('rda',         'finance.payroll.dentrix_ascend.view', false),
  ('clinical_manager','finance.payroll.dentrix_ascend.view', false),
  ('dental_assistant','finance.payroll.dentrix_ascend.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.view', true),
  ('admin',       'finance.payroll.gusto.view', false),
  ('regional_manager','finance.payroll.gusto.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.view', false),
  ('front_desk',  'finance.payroll.gusto.view', false),
  ('staff',       'finance.payroll.gusto.view', false),
  ('doctor',      'finance.payroll.gusto.view', false),
  ('hygienist',   'finance.payroll.gusto.view', false),
  ('office_manager','finance.payroll.gusto.view', false),
  ('treatment_coordinator','finance.payroll.gusto.view', false),
  ('rda',         'finance.payroll.gusto.view', false),
  ('clinical_manager','finance.payroll.gusto.view', false),
  ('dental_assistant','finance.payroll.gusto.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.overview.view', true),
  ('admin',       'finance.payroll.gusto.overview.view', false),
  ('regional_manager','finance.payroll.gusto.overview.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.overview.view', false),
  ('front_desk',  'finance.payroll.gusto.overview.view', false),
  ('staff',       'finance.payroll.gusto.overview.view', false),
  ('doctor',      'finance.payroll.gusto.overview.view', false),
  ('hygienist',   'finance.payroll.gusto.overview.view', false),
  ('office_manager','finance.payroll.gusto.overview.view', false),
  ('treatment_coordinator','finance.payroll.gusto.overview.view', false),
  ('rda',         'finance.payroll.gusto.overview.view', false),
  ('clinical_manager','finance.payroll.gusto.overview.view', false),
  ('dental_assistant','finance.payroll.gusto.overview.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.employees.view', true),
  ('admin',       'finance.payroll.gusto.employees.view', false),
  ('regional_manager','finance.payroll.gusto.employees.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.employees.view', false),
  ('front_desk',  'finance.payroll.gusto.employees.view', false),
  ('staff',       'finance.payroll.gusto.employees.view', false),
  ('doctor',      'finance.payroll.gusto.employees.view', false),
  ('hygienist',   'finance.payroll.gusto.employees.view', false),
  ('office_manager','finance.payroll.gusto.employees.view', false),
  ('treatment_coordinator','finance.payroll.gusto.employees.view', false),
  ('rda',         'finance.payroll.gusto.employees.view', false),
  ('clinical_manager','finance.payroll.gusto.employees.view', false),
  ('dental_assistant','finance.payroll.gusto.employees.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.payroll_runs.view', true),
  ('admin',       'finance.payroll.gusto.payroll_runs.view', false),
  ('regional_manager','finance.payroll.gusto.payroll_runs.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.payroll_runs.view', false),
  ('front_desk',  'finance.payroll.gusto.payroll_runs.view', false),
  ('staff',       'finance.payroll.gusto.payroll_runs.view', false),
  ('doctor',      'finance.payroll.gusto.payroll_runs.view', false),
  ('hygienist',   'finance.payroll.gusto.payroll_runs.view', false),
  ('office_manager','finance.payroll.gusto.payroll_runs.view', false),
  ('treatment_coordinator','finance.payroll.gusto.payroll_runs.view', false),
  ('rda',         'finance.payroll.gusto.payroll_runs.view', false),
  ('clinical_manager','finance.payroll.gusto.payroll_runs.view', false),
  ('dental_assistant','finance.payroll.gusto.payroll_runs.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.contractors.view', true),
  ('admin',       'finance.payroll.gusto.contractors.view', false),
  ('regional_manager','finance.payroll.gusto.contractors.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.contractors.view', false),
  ('front_desk',  'finance.payroll.gusto.contractors.view', false),
  ('staff',       'finance.payroll.gusto.contractors.view', false),
  ('doctor',      'finance.payroll.gusto.contractors.view', false),
  ('hygienist',   'finance.payroll.gusto.contractors.view', false),
  ('office_manager','finance.payroll.gusto.contractors.view', false),
  ('treatment_coordinator','finance.payroll.gusto.contractors.view', false),
  ('rda',         'finance.payroll.gusto.contractors.view', false),
  ('clinical_manager','finance.payroll.gusto.contractors.view', false),
  ('dental_assistant','finance.payroll.gusto.contractors.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.benefits.view', true),
  ('admin',       'finance.payroll.gusto.benefits.view', false),
  ('regional_manager','finance.payroll.gusto.benefits.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.benefits.view', false),
  ('front_desk',  'finance.payroll.gusto.benefits.view', false),
  ('staff',       'finance.payroll.gusto.benefits.view', false),
  ('doctor',      'finance.payroll.gusto.benefits.view', false),
  ('hygienist',   'finance.payroll.gusto.benefits.view', false),
  ('office_manager','finance.payroll.gusto.benefits.view', false),
  ('treatment_coordinator','finance.payroll.gusto.benefits.view', false),
  ('rda',         'finance.payroll.gusto.benefits.view', false),
  ('clinical_manager','finance.payroll.gusto.benefits.view', false),
  ('dental_assistant','finance.payroll.gusto.benefits.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.pay_schedules.view', true),
  ('admin',       'finance.payroll.gusto.pay_schedules.view', false),
  ('regional_manager','finance.payroll.gusto.pay_schedules.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.pay_schedules.view', false),
  ('front_desk',  'finance.payroll.gusto.pay_schedules.view', false),
  ('staff',       'finance.payroll.gusto.pay_schedules.view', false),
  ('doctor',      'finance.payroll.gusto.pay_schedules.view', false),
  ('hygienist',   'finance.payroll.gusto.pay_schedules.view', false),
  ('office_manager','finance.payroll.gusto.pay_schedules.view', false),
  ('treatment_coordinator','finance.payroll.gusto.pay_schedules.view', false),
  ('rda',         'finance.payroll.gusto.pay_schedules.view', false),
  ('clinical_manager','finance.payroll.gusto.pay_schedules.view', false),
  ('dental_assistant','finance.payroll.gusto.pay_schedules.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.import_history.view', true),
  ('admin',       'finance.payroll.gusto.import_history.view', false),
  ('regional_manager','finance.payroll.gusto.import_history.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.import_history.view', false),
  ('front_desk',  'finance.payroll.gusto.import_history.view', false),
  ('staff',       'finance.payroll.gusto.import_history.view', false),
  ('doctor',      'finance.payroll.gusto.import_history.view', false),
  ('hygienist',   'finance.payroll.gusto.import_history.view', false),
  ('office_manager','finance.payroll.gusto.import_history.view', false),
  ('treatment_coordinator','finance.payroll.gusto.import_history.view', false),
  ('rda',         'finance.payroll.gusto.import_history.view', false),
  ('clinical_manager','finance.payroll.gusto.import_history.view', false),
  ('dental_assistant','finance.payroll.gusto.import_history.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.gusto.time_attendance.view', true),
  ('admin',       'finance.payroll.gusto.time_attendance.view', false),
  ('regional_manager','finance.payroll.gusto.time_attendance.view', false),
  ('regional_clinical_manager','finance.payroll.gusto.time_attendance.view', false),
  ('front_desk',  'finance.payroll.gusto.time_attendance.view', false),
  ('staff',       'finance.payroll.gusto.time_attendance.view', false),
  ('doctor',      'finance.payroll.gusto.time_attendance.view', false),
  ('hygienist',   'finance.payroll.gusto.time_attendance.view', false),
  ('office_manager','finance.payroll.gusto.time_attendance.view', false),
  ('treatment_coordinator','finance.payroll.gusto.time_attendance.view', false),
  ('rda',         'finance.payroll.gusto.time_attendance.view', false),
  ('clinical_manager','finance.payroll.gusto.time_attendance.view', false),
  ('dental_assistant','finance.payroll.gusto.time_attendance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.comparison.view', true),
  ('admin',       'finance.payroll.comparison.view', false),
  ('regional_manager','finance.payroll.comparison.view', false),
  ('regional_clinical_manager','finance.payroll.comparison.view', false),
  ('front_desk',  'finance.payroll.comparison.view', false),
  ('staff',       'finance.payroll.comparison.view', false),
  ('doctor',      'finance.payroll.comparison.view', false),
  ('hygienist',   'finance.payroll.comparison.view', false),
  ('office_manager','finance.payroll.comparison.view', false),
  ('treatment_coordinator','finance.payroll.comparison.view', false),
  ('rda',         'finance.payroll.comparison.view', false),
  ('clinical_manager','finance.payroll.comparison.view', false),
  ('dental_assistant','finance.payroll.comparison.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin', 'finance.payroll.provider_compensation.view', true),
  ('admin',       'finance.payroll.provider_compensation.view', false),
  ('regional_manager','finance.payroll.provider_compensation.view', false),
  ('regional_clinical_manager','finance.payroll.provider_compensation.view', false),
  ('front_desk',  'finance.payroll.provider_compensation.view', false),
  ('staff',       'finance.payroll.provider_compensation.view', false),
  ('doctor',      'finance.payroll.provider_compensation.view', false),
  ('hygienist',   'finance.payroll.provider_compensation.view', false),
  ('office_manager','finance.payroll.provider_compensation.view', false),
  ('treatment_coordinator','finance.payroll.provider_compensation.view', false),
  ('rda',         'finance.payroll.provider_compensation.view', false),
  ('clinical_manager','finance.payroll.provider_compensation.view', false),
  ('dental_assistant','finance.payroll.provider_compensation.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Operations ────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.offices.view', true),
  ('admin','performance.operations.offices.view', true),
  ('regional_manager','performance.operations.offices.view', true),
  ('regional_clinical_manager','performance.operations.offices.view', true),
  ('front_desk','performance.operations.offices.view', false),
  ('staff','performance.operations.offices.view', false),
  ('doctor','performance.operations.offices.view', false),
  ('hygienist','performance.operations.offices.view', false),
  ('office_manager','performance.operations.offices.view', false),
  ('treatment_coordinator','performance.operations.offices.view', false),
  ('rda','performance.operations.offices.view', false),
  ('clinical_manager','performance.operations.offices.view', false),
  ('dental_assistant','performance.operations.offices.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.production.view', true),
  ('admin','performance.operations.production.view', true),
  ('regional_manager','performance.operations.production.view', true),
  ('regional_clinical_manager','performance.operations.production.view', true),
  ('front_desk','performance.operations.production.view', false),
  ('staff','performance.operations.production.view', false),
  ('doctor','performance.operations.production.view', false),
  ('hygienist','performance.operations.production.view', false),
  ('office_manager','performance.operations.production.view', false),
  ('treatment_coordinator','performance.operations.production.view', false),
  ('rda','performance.operations.production.view', false),
  ('clinical_manager','performance.operations.production.view', false),
  ('dental_assistant','performance.operations.production.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.performance.view', true),
  ('admin','performance.operations.performance.view', true),
  ('regional_manager','performance.operations.performance.view', true),
  ('regional_clinical_manager','performance.operations.performance.view', true),
  ('front_desk','performance.operations.performance.view', false),
  ('staff','performance.operations.performance.view', false),
  ('doctor','performance.operations.performance.view', false),
  ('hygienist','performance.operations.performance.view', false),
  ('office_manager','performance.operations.performance.view', false),
  ('treatment_coordinator','performance.operations.performance.view', false),
  ('rda','performance.operations.performance.view', false),
  ('clinical_manager','performance.operations.performance.view', false),
  ('dental_assistant','performance.operations.performance.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.providers.view', true),
  ('admin','performance.operations.providers.view', true),
  ('regional_manager','performance.operations.providers.view', true),
  ('regional_clinical_manager','performance.operations.providers.view', true),
  ('front_desk','performance.operations.providers.view', false),
  ('staff','performance.operations.providers.view', false),
  ('doctor','performance.operations.providers.view', false),
  ('hygienist','performance.operations.providers.view', false),
  ('office_manager','performance.operations.providers.view', false),
  ('treatment_coordinator','performance.operations.providers.view', false),
  ('rda','performance.operations.providers.view', false),
  ('clinical_manager','performance.operations.providers.view', false),
  ('dental_assistant','performance.operations.providers.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.services.view', true),
  ('admin','performance.operations.services.view', true),
  ('regional_manager','performance.operations.services.view', true),
  ('regional_clinical_manager','performance.operations.services.view', true),
  ('front_desk','performance.operations.services.view', false),
  ('staff','performance.operations.services.view', false),
  ('doctor','performance.operations.services.view', false),
  ('hygienist','performance.operations.services.view', false),
  ('office_manager','performance.operations.services.view', false),
  ('treatment_coordinator','performance.operations.services.view', false),
  ('rda','performance.operations.services.view', false),
  ('clinical_manager','performance.operations.services.view', false),
  ('dental_assistant','performance.operations.services.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.payors.view', true),
  ('admin','performance.operations.payors.view', true),
  ('regional_manager','performance.operations.payors.view', true),
  ('regional_clinical_manager','performance.operations.payors.view', true),
  ('front_desk','performance.operations.payors.view', false),
  ('staff','performance.operations.payors.view', false),
  ('doctor','performance.operations.payors.view', false),
  ('hygienist','performance.operations.payors.view', false),
  ('office_manager','performance.operations.payors.view', false),
  ('treatment_coordinator','performance.operations.payors.view', false),
  ('rda','performance.operations.payors.view', false),
  ('clinical_manager','performance.operations.payors.view', false),
  ('dental_assistant','performance.operations.payors.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.trends.view', true),
  ('admin','performance.operations.trends.view', true),
  ('regional_manager','performance.operations.trends.view', true),
  ('regional_clinical_manager','performance.operations.trends.view', true),
  ('front_desk','performance.operations.trends.view', false),
  ('staff','performance.operations.trends.view', false),
  ('doctor','performance.operations.trends.view', false),
  ('hygienist','performance.operations.trends.view', false),
  ('office_manager','performance.operations.trends.view', false),
  ('treatment_coordinator','performance.operations.trends.view', false),
  ('rda','performance.operations.trends.view', false),
  ('clinical_manager','performance.operations.trends.view', false),
  ('dental_assistant','performance.operations.trends.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.cancellations.view', true),
  ('admin','performance.operations.cancellations.view', true),
  ('regional_manager','performance.operations.cancellations.view', true),
  ('regional_clinical_manager','performance.operations.cancellations.view', true),
  ('front_desk','performance.operations.cancellations.view', false),
  ('staff','performance.operations.cancellations.view', false),
  ('doctor','performance.operations.cancellations.view', false),
  ('hygienist','performance.operations.cancellations.view', false),
  ('office_manager','performance.operations.cancellations.view', false),
  ('treatment_coordinator','performance.operations.cancellations.view', false),
  ('rda','performance.operations.cancellations.view', false),
  ('clinical_manager','performance.operations.cancellations.view', false),
  ('dental_assistant','performance.operations.cancellations.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.ar_aging.view', true),
  ('admin','performance.operations.ar_aging.view', true),
  ('regional_manager','performance.operations.ar_aging.view', true),
  ('regional_clinical_manager','performance.operations.ar_aging.view', true),
  ('front_desk','performance.operations.ar_aging.view', false),
  ('staff','performance.operations.ar_aging.view', false),
  ('doctor','performance.operations.ar_aging.view', false),
  ('hygienist','performance.operations.ar_aging.view', false),
  ('office_manager','performance.operations.ar_aging.view', false),
  ('treatment_coordinator','performance.operations.ar_aging.view', false),
  ('rda','performance.operations.ar_aging.view', false),
  ('clinical_manager','performance.operations.ar_aging.view', false),
  ('dental_assistant','performance.operations.ar_aging.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.marketing.view', true),
  ('admin','performance.operations.marketing.view', true),
  ('regional_manager','performance.operations.marketing.view', true),
  ('regional_clinical_manager','performance.operations.marketing.view', true),
  ('front_desk','performance.operations.marketing.view', false),
  ('staff','performance.operations.marketing.view', false),
  ('doctor','performance.operations.marketing.view', false),
  ('hygienist','performance.operations.marketing.view', false),
  ('office_manager','performance.operations.marketing.view', false),
  ('treatment_coordinator','performance.operations.marketing.view', false),
  ('rda','performance.operations.marketing.view', false),
  ('clinical_manager','performance.operations.marketing.view', false),
  ('dental_assistant','performance.operations.marketing.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.operations.scorecards.view', true),
  ('admin','performance.operations.scorecards.view', true),
  ('regional_manager','performance.operations.scorecards.view', true),
  ('regional_clinical_manager','performance.operations.scorecards.view', true),
  ('front_desk','performance.operations.scorecards.view', false),
  ('staff','performance.operations.scorecards.view', false),
  ('doctor','performance.operations.scorecards.view', false),
  ('hygienist','performance.operations.scorecards.view', false),
  ('office_manager','performance.operations.scorecards.view', false),
  ('treatment_coordinator','performance.operations.scorecards.view', false),
  ('rda','performance.operations.scorecards.view', false),
  ('clinical_manager','performance.operations.scorecards.view', false),
  ('dental_assistant','performance.operations.scorecards.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Financial Analytics & Expenses ────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.finance.analytics.view', true),
  ('admin','finance.finance.analytics.view', true),
  ('regional_manager','finance.finance.analytics.view', true),
  ('regional_clinical_manager','finance.finance.analytics.view', true),
  ('front_desk','finance.finance.analytics.view', false),
  ('staff','finance.finance.analytics.view', false),
  ('doctor','finance.finance.analytics.view', false),
  ('hygienist','finance.finance.analytics.view', false),
  ('office_manager','finance.finance.analytics.view', false),
  ('treatment_coordinator','finance.finance.analytics.view', false),
  ('rda','finance.finance.analytics.view', false),
  ('clinical_manager','finance.finance.analytics.view', false),
  ('dental_assistant','finance.finance.analytics.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.finance.production.view', true),
  ('admin','finance.finance.production.view', true),
  ('regional_manager','finance.finance.production.view', true),
  ('regional_clinical_manager','finance.finance.production.view', true),
  ('front_desk','finance.finance.production.view', false),
  ('staff','finance.finance.production.view', false),
  ('doctor','finance.finance.production.view', false),
  ('hygienist','finance.finance.production.view', false),
  ('office_manager','finance.finance.production.view', false),
  ('treatment_coordinator','finance.finance.production.view', false),
  ('rda','finance.finance.production.view', false),
  ('clinical_manager','finance.finance.production.view', false),
  ('dental_assistant','finance.finance.production.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.finance.collections.view', true),
  ('admin','finance.finance.collections.view', true),
  ('regional_manager','finance.finance.collections.view', true),
  ('regional_clinical_manager','finance.finance.collections.view', true),
  ('front_desk','finance.finance.collections.view', false),
  ('staff','finance.finance.collections.view', false),
  ('doctor','finance.finance.collections.view', false),
  ('hygienist','finance.finance.collections.view', false),
  ('office_manager','finance.finance.collections.view', false),
  ('treatment_coordinator','finance.finance.collections.view', false),
  ('rda','finance.finance.collections.view', false),
  ('clinical_manager','finance.finance.collections.view', false),
  ('dental_assistant','finance.finance.collections.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.finance.service_categories.view', true),
  ('admin','finance.finance.service_categories.view', true),
  ('regional_manager','finance.finance.service_categories.view', true),
  ('regional_clinical_manager','finance.finance.service_categories.view', true),
  ('front_desk','finance.finance.service_categories.view', false),
  ('staff','finance.finance.service_categories.view', false),
  ('doctor','finance.finance.service_categories.view', false),
  ('hygienist','finance.finance.service_categories.view', false),
  ('office_manager','finance.finance.service_categories.view', false),
  ('treatment_coordinator','finance.finance.service_categories.view', false),
  ('rda','finance.finance.service_categories.view', false),
  ('clinical_manager','finance.finance.service_categories.view', false),
  ('dental_assistant','finance.finance.service_categories.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.finance.reconciliation.view', true),
  ('admin','finance.finance.reconciliation.view', false),
  ('regional_manager','finance.finance.reconciliation.view', false),
  ('regional_clinical_manager','finance.finance.reconciliation.view', false),
  ('front_desk','finance.finance.reconciliation.view', false),
  ('staff','finance.finance.reconciliation.view', false),
  ('doctor','finance.finance.reconciliation.view', false),
  ('hygienist','finance.finance.reconciliation.view', false),
  ('office_manager','finance.finance.reconciliation.view', false),
  ('treatment_coordinator','finance.finance.reconciliation.view', false),
  ('rda','finance.finance.reconciliation.view', false),
  ('clinical_manager','finance.finance.reconciliation.view', false),
  ('dental_assistant','finance.finance.reconciliation.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.expenses.overview.view', true),
  ('admin','finance.expenses.overview.view', true),
  ('regional_manager','finance.expenses.overview.view', true),
  ('regional_clinical_manager','finance.expenses.overview.view', true),
  ('front_desk','finance.expenses.overview.view', false),
  ('staff','finance.expenses.overview.view', false),
  ('doctor','finance.expenses.overview.view', false),
  ('hygienist','finance.expenses.overview.view', false),
  ('office_manager','finance.expenses.overview.view', false),
  ('treatment_coordinator','finance.expenses.overview.view', false),
  ('rda','finance.expenses.overview.view', false),
  ('clinical_manager','finance.expenses.overview.view', false),
  ('dental_assistant','finance.expenses.overview.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.expenses.transactions.view', true),
  ('admin','finance.expenses.transactions.view', true),
  ('regional_manager','finance.expenses.transactions.view', true),
  ('regional_clinical_manager','finance.expenses.transactions.view', true),
  ('front_desk','finance.expenses.transactions.view', false),
  ('staff','finance.expenses.transactions.view', false),
  ('doctor','finance.expenses.transactions.view', false),
  ('hygienist','finance.expenses.transactions.view', false),
  ('office_manager','finance.expenses.transactions.view', false),
  ('treatment_coordinator','finance.expenses.transactions.view', false),
  ('rda','finance.expenses.transactions.view', false),
  ('clinical_manager','finance.expenses.transactions.view', false),
  ('dental_assistant','finance.expenses.transactions.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.expenses.amex.view', true),
  ('admin','finance.expenses.amex.view', true),
  ('regional_manager','finance.expenses.amex.view', true),
  ('regional_clinical_manager','finance.expenses.amex.view', true),
  ('front_desk','finance.expenses.amex.view', false),
  ('staff','finance.expenses.amex.view', false),
  ('doctor','finance.expenses.amex.view', false),
  ('hygienist','finance.expenses.amex.view', false),
  ('office_manager','finance.expenses.amex.view', false),
  ('treatment_coordinator','finance.expenses.amex.view', false),
  ('rda','finance.expenses.amex.view', false),
  ('clinical_manager','finance.expenses.amex.view', false),
  ('dental_assistant','finance.expenses.amex.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.expenses.amex_payments.view', true),
  ('admin','finance.expenses.amex_payments.view', true),
  ('regional_manager','finance.expenses.amex_payments.view', true),
  ('regional_clinical_manager','finance.expenses.amex_payments.view', true),
  ('front_desk','finance.expenses.amex_payments.view', false),
  ('staff','finance.expenses.amex_payments.view', false),
  ('doctor','finance.expenses.amex_payments.view', false),
  ('hygienist','finance.expenses.amex_payments.view', false),
  ('office_manager','finance.expenses.amex_payments.view', false),
  ('treatment_coordinator','finance.expenses.amex_payments.view', false),
  ('rda','finance.expenses.amex_payments.view', false),
  ('clinical_manager','finance.expenses.amex_payments.view', false),
  ('dental_assistant','finance.expenses.amex_payments.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.expenses.import.view', true),
  ('admin','finance.expenses.import.view', true),
  ('regional_manager','finance.expenses.import.view', false),
  ('regional_clinical_manager','finance.expenses.import.view', false),
  ('front_desk','finance.expenses.import.view', false),
  ('staff','finance.expenses.import.view', false),
  ('doctor','finance.expenses.import.view', false),
  ('hygienist','finance.expenses.import.view', false),
  ('office_manager','finance.expenses.import.view', false),
  ('treatment_coordinator','finance.expenses.import.view', false),
  ('rda','finance.expenses.import.view', false),
  ('clinical_manager','finance.expenses.import.view', false),
  ('dental_assistant','finance.expenses.import.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: RCM ───────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.claims.view', true),
  ('admin','finance.rcm.claims.view', true),
  ('regional_manager','finance.rcm.claims.view', true),
  ('regional_clinical_manager','finance.rcm.claims.view', true),
  ('front_desk','finance.rcm.claims.view', false),
  ('staff','finance.rcm.claims.view', false),
  ('doctor','finance.rcm.claims.view', false),
  ('hygienist','finance.rcm.claims.view', false),
  ('office_manager','finance.rcm.claims.view', false),
  ('treatment_coordinator','finance.rcm.claims.view', false),
  ('rda','finance.rcm.claims.view', false),
  ('clinical_manager','finance.rcm.claims.view', false),
  ('dental_assistant','finance.rcm.claims.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.payment.view', true),
  ('admin','finance.rcm.payment.view', true),
  ('regional_manager','finance.rcm.payment.view', true),
  ('regional_clinical_manager','finance.rcm.payment.view', true),
  ('front_desk','finance.rcm.payment.view', false),
  ('staff','finance.rcm.payment.view', false),
  ('doctor','finance.rcm.payment.view', false),
  ('hygienist','finance.rcm.payment.view', false),
  ('office_manager','finance.rcm.payment.view', false),
  ('treatment_coordinator','finance.rcm.payment.view', false),
  ('rda','finance.rcm.payment.view', false),
  ('clinical_manager','finance.rcm.payment.view', false),
  ('dental_assistant','finance.rcm.payment.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.statements.view', true),
  ('admin','finance.rcm.statements.view', true),
  ('regional_manager','finance.rcm.statements.view', true),
  ('regional_clinical_manager','finance.rcm.statements.view', true),
  ('front_desk','finance.rcm.statements.view', false),
  ('staff','finance.rcm.statements.view', false),
  ('doctor','finance.rcm.statements.view', false),
  ('hygienist','finance.rcm.statements.view', false),
  ('office_manager','finance.rcm.statements.view', false),
  ('treatment_coordinator','finance.rcm.statements.view', false),
  ('rda','finance.rcm.statements.view', false),
  ('clinical_manager','finance.rcm.statements.view', false),
  ('dental_assistant','finance.rcm.statements.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.pos.view', true),
  ('admin','finance.rcm.pos.view', true),
  ('regional_manager','finance.rcm.pos.view', true),
  ('regional_clinical_manager','finance.rcm.pos.view', true),
  ('front_desk','finance.rcm.pos.view', false),
  ('staff','finance.rcm.pos.view', false),
  ('doctor','finance.rcm.pos.view', false),
  ('hygienist','finance.rcm.pos.view', false),
  ('office_manager','finance.rcm.pos.view', false),
  ('treatment_coordinator','finance.rcm.pos.view', false),
  ('rda','finance.rcm.pos.view', false),
  ('clinical_manager','finance.rcm.pos.view', false),
  ('dental_assistant','finance.rcm.pos.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.adjustment.view', true),
  ('admin','finance.rcm.adjustment.view', true),
  ('regional_manager','finance.rcm.adjustment.view', true),
  ('regional_clinical_manager','finance.rcm.adjustment.view', true),
  ('front_desk','finance.rcm.adjustment.view', false),
  ('staff','finance.rcm.adjustment.view', false),
  ('doctor','finance.rcm.adjustment.view', false),
  ('hygienist','finance.rcm.adjustment.view', false),
  ('office_manager','finance.rcm.adjustment.view', false),
  ('treatment_coordinator','finance.rcm.adjustment.view', false),
  ('rda','finance.rcm.adjustment.view', false),
  ('clinical_manager','finance.rcm.adjustment.view', false),
  ('dental_assistant','finance.rcm.adjustment.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.dashboard.view', true),
  ('admin','finance.rcm.dashboard.view', true),
  ('regional_manager','finance.rcm.dashboard.view', true),
  ('regional_clinical_manager','finance.rcm.dashboard.view', true),
  ('front_desk','finance.rcm.dashboard.view', false),
  ('staff','finance.rcm.dashboard.view', false),
  ('doctor','finance.rcm.dashboard.view', false),
  ('hygienist','finance.rcm.dashboard.view', false),
  ('office_manager','finance.rcm.dashboard.view', false),
  ('treatment_coordinator','finance.rcm.dashboard.view', false),
  ('rda','finance.rcm.dashboard.view', false),
  ('clinical_manager','finance.rcm.dashboard.view', false),
  ('dental_assistant','finance.rcm.dashboard.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.ar_aging.view', true),
  ('admin','finance.rcm.ar_aging.view', true),
  ('regional_manager','finance.rcm.ar_aging.view', true),
  ('regional_clinical_manager','finance.rcm.ar_aging.view', true),
  ('front_desk','finance.rcm.ar_aging.view', false),
  ('staff','finance.rcm.ar_aging.view', false),
  ('doctor','finance.rcm.ar_aging.view', false),
  ('hygienist','finance.rcm.ar_aging.view', false),
  ('office_manager','finance.rcm.ar_aging.view', false),
  ('treatment_coordinator','finance.rcm.ar_aging.view', false),
  ('rda','finance.rcm.ar_aging.view', false),
  ('clinical_manager','finance.rcm.ar_aging.view', false),
  ('dental_assistant','finance.rcm.ar_aging.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.refund.view', true),
  ('admin','finance.rcm.refund.view', true),
  ('regional_manager','finance.rcm.refund.view', true),
  ('regional_clinical_manager','finance.rcm.refund.view', true),
  ('front_desk','finance.rcm.refund.view', false),
  ('staff','finance.rcm.refund.view', false),
  ('doctor','finance.rcm.refund.view', false),
  ('hygienist','finance.rcm.refund.view', false),
  ('office_manager','finance.rcm.refund.view', false),
  ('treatment_coordinator','finance.rcm.refund.view', false),
  ('rda','finance.rcm.refund.view', false),
  ('clinical_manager','finance.rcm.refund.view', false),
  ('dental_assistant','finance.rcm.refund.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.daily_comparison.view', true),
  ('admin','finance.rcm.daily_comparison.view', true),
  ('regional_manager','finance.rcm.daily_comparison.view', true),
  ('regional_clinical_manager','finance.rcm.daily_comparison.view', true),
  ('front_desk','finance.rcm.daily_comparison.view', false),
  ('staff','finance.rcm.daily_comparison.view', false),
  ('doctor','finance.rcm.daily_comparison.view', false),
  ('hygienist','finance.rcm.daily_comparison.view', false),
  ('office_manager','finance.rcm.daily_comparison.view', false),
  ('treatment_coordinator','finance.rcm.daily_comparison.view', false),
  ('rda','finance.rcm.daily_comparison.view', false),
  ('clinical_manager','finance.rcm.daily_comparison.view', false),
  ('dental_assistant','finance.rcm.daily_comparison.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','finance.rcm.eassist_daily.view', true),
  ('admin','finance.rcm.eassist_daily.view', true),
  ('regional_manager','finance.rcm.eassist_daily.view', true),
  ('regional_clinical_manager','finance.rcm.eassist_daily.view', true),
  ('front_desk','finance.rcm.eassist_daily.view', false),
  ('staff','finance.rcm.eassist_daily.view', false),
  ('doctor','finance.rcm.eassist_daily.view', false),
  ('hygienist','finance.rcm.eassist_daily.view', false),
  ('office_manager','finance.rcm.eassist_daily.view', false),
  ('treatment_coordinator','finance.rcm.eassist_daily.view', false),
  ('rda','finance.rcm.eassist_daily.view', false),
  ('clinical_manager','finance.rcm.eassist_daily.view', false),
  ('dental_assistant','finance.rcm.eassist_daily.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: KPIs & Monthly Trends ────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.kpis.main.view', true),
  ('admin','performance.kpis.main.view', true),
  ('regional_manager','performance.kpis.main.view', true),
  ('regional_clinical_manager','performance.kpis.main.view', true),
  ('front_desk','performance.kpis.main.view', false),
  ('staff','performance.kpis.main.view', false),
  ('doctor','performance.kpis.main.view', false),
  ('hygienist','performance.kpis.main.view', false),
  ('office_manager','performance.kpis.main.view', false),
  ('treatment_coordinator','performance.kpis.main.view', false),
  ('rda','performance.kpis.main.view', false),
  ('clinical_manager','performance.kpis.main.view', false),
  ('dental_assistant','performance.kpis.main.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.kpis.specialty.view', true),
  ('admin','performance.kpis.specialty.view', true),
  ('regional_manager','performance.kpis.specialty.view', true),
  ('regional_clinical_manager','performance.kpis.specialty.view', true),
  ('front_desk','performance.kpis.specialty.view', false),
  ('staff','performance.kpis.specialty.view', false),
  ('doctor','performance.kpis.specialty.view', false),
  ('hygienist','performance.kpis.specialty.view', false),
  ('office_manager','performance.kpis.specialty.view', false),
  ('treatment_coordinator','performance.kpis.specialty.view', false),
  ('rda','performance.kpis.specialty.view', false),
  ('clinical_manager','performance.kpis.specialty.view', false),
  ('dental_assistant','performance.kpis.specialty.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.kpis.providers.view', true),
  ('admin','performance.kpis.providers.view', true),
  ('regional_manager','performance.kpis.providers.view', true),
  ('regional_clinical_manager','performance.kpis.providers.view', true),
  ('front_desk','performance.kpis.providers.view', false),
  ('staff','performance.kpis.providers.view', false),
  ('doctor','performance.kpis.providers.view', false),
  ('hygienist','performance.kpis.providers.view', false),
  ('office_manager','performance.kpis.providers.view', false),
  ('treatment_coordinator','performance.kpis.providers.view', false),
  ('rda','performance.kpis.providers.view', false),
  ('clinical_manager','performance.kpis.providers.view', false),
  ('dental_assistant','performance.kpis.providers.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.kpis.specialty_providers.view', true),
  ('admin','performance.kpis.specialty_providers.view', true),
  ('regional_manager','performance.kpis.specialty_providers.view', true),
  ('regional_clinical_manager','performance.kpis.specialty_providers.view', true),
  ('front_desk','performance.kpis.specialty_providers.view', false),
  ('staff','performance.kpis.specialty_providers.view', false),
  ('doctor','performance.kpis.specialty_providers.view', false),
  ('hygienist','performance.kpis.specialty_providers.view', false),
  ('office_manager','performance.kpis.specialty_providers.view', false),
  ('treatment_coordinator','performance.kpis.specialty_providers.view', false),
  ('rda','performance.kpis.specialty_providers.view', false),
  ('clinical_manager','performance.kpis.specialty_providers.view', false),
  ('dental_assistant','performance.kpis.specialty_providers.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.monthly_trends.summary.view', true),
  ('admin','performance.monthly_trends.summary.view', true),
  ('regional_manager','performance.monthly_trends.summary.view', false),
  ('regional_clinical_manager','performance.monthly_trends.summary.view', true),
  ('front_desk','performance.monthly_trends.summary.view', false),
  ('staff','performance.monthly_trends.summary.view', false),
  ('doctor','performance.monthly_trends.summary.view', false),
  ('hygienist','performance.monthly_trends.summary.view', false),
  ('office_manager','performance.monthly_trends.summary.view', true),
  ('treatment_coordinator','performance.monthly_trends.summary.view', false),
  ('rda','performance.monthly_trends.summary.view', false),
  ('clinical_manager','performance.monthly_trends.summary.view', false),
  ('dental_assistant','performance.monthly_trends.summary.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.monthly_trends.import_export.view', true),
  ('admin','performance.monthly_trends.import_export.view', true),
  ('regional_manager','performance.monthly_trends.import_export.view', false),
  ('regional_clinical_manager','performance.monthly_trends.import_export.view', false),
  ('front_desk','performance.monthly_trends.import_export.view', false),
  ('staff','performance.monthly_trends.import_export.view', false),
  ('doctor','performance.monthly_trends.import_export.view', false),
  ('hygienist','performance.monthly_trends.import_export.view', false),
  ('office_manager','performance.monthly_trends.import_export.view', false),
  ('treatment_coordinator','performance.monthly_trends.import_export.view', false),
  ('rda','performance.monthly_trends.import_export.view', false),
  ('clinical_manager','performance.monthly_trends.import_export.view', false),
  ('dental_assistant','performance.monthly_trends.import_export.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.monthly_trends.manual_override.view', true),
  ('admin','performance.monthly_trends.manual_override.view', true),
  ('regional_manager','performance.monthly_trends.manual_override.view', false),
  ('regional_clinical_manager','performance.monthly_trends.manual_override.view', false),
  ('front_desk','performance.monthly_trends.manual_override.view', false),
  ('staff','performance.monthly_trends.manual_override.view', false),
  ('doctor','performance.monthly_trends.manual_override.view', false),
  ('hygienist','performance.monthly_trends.manual_override.view', false),
  ('office_manager','performance.monthly_trends.manual_override.view', false),
  ('treatment_coordinator','performance.monthly_trends.manual_override.view', false),
  ('rda','performance.monthly_trends.manual_override.view', false),
  ('clinical_manager','performance.monthly_trends.manual_override.view', false),
  ('dental_assistant','performance.monthly_trends.manual_override.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Office Performance ───────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.office_performance.revenue.view', true),
  ('admin','performance.office_performance.revenue.view', true),
  ('regional_manager','performance.office_performance.revenue.view', true),
  ('regional_clinical_manager','performance.office_performance.revenue.view', true),
  ('front_desk','performance.office_performance.revenue.view', false),
  ('staff','performance.office_performance.revenue.view', false),
  ('doctor','performance.office_performance.revenue.view', false),
  ('hygienist','performance.office_performance.revenue.view', false),
  ('office_manager','performance.office_performance.revenue.view', false),
  ('treatment_coordinator','performance.office_performance.revenue.view', false),
  ('rda','performance.office_performance.revenue.view', false),
  ('clinical_manager','performance.office_performance.revenue.view', false),
  ('dental_assistant','performance.office_performance.revenue.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.office_performance.expenses.view', true),
  ('admin','performance.office_performance.expenses.view', true),
  ('regional_manager','performance.office_performance.expenses.view', true),
  ('regional_clinical_manager','performance.office_performance.expenses.view', true),
  ('front_desk','performance.office_performance.expenses.view', false),
  ('staff','performance.office_performance.expenses.view', false),
  ('doctor','performance.office_performance.expenses.view', false),
  ('hygienist','performance.office_performance.expenses.view', false),
  ('office_manager','performance.office_performance.expenses.view', false),
  ('treatment_coordinator','performance.office_performance.expenses.view', false),
  ('rda','performance.office_performance.expenses.view', false),
  ('clinical_manager','performance.office_performance.expenses.view', false),
  ('dental_assistant','performance.office_performance.expenses.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','performance.office_performance.productivity.view', true),
  ('admin','performance.office_performance.productivity.view', true),
  ('regional_manager','performance.office_performance.productivity.view', true),
  ('regional_clinical_manager','performance.office_performance.productivity.view', true),
  ('front_desk','performance.office_performance.productivity.view', false),
  ('staff','performance.office_performance.productivity.view', false),
  ('doctor','performance.office_performance.productivity.view', false),
  ('hygienist','performance.office_performance.productivity.view', false),
  ('office_manager','performance.office_performance.productivity.view', false),
  ('treatment_coordinator','performance.office_performance.productivity.view', false),
  ('rda','performance.office_performance.productivity.view', false),
  ('clinical_manager','performance.office_performance.productivity.view', false),
  ('dental_assistant','performance.office_performance.productivity.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Reports ───────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.reports.pl_summary.view', true),
  ('admin','resources.reports.pl_summary.view', true),
  ('regional_manager','resources.reports.pl_summary.view', true),
  ('regional_clinical_manager','resources.reports.pl_summary.view', true),
  ('front_desk','resources.reports.pl_summary.view', false),
  ('staff','resources.reports.pl_summary.view', false),
  ('doctor','resources.reports.pl_summary.view', false),
  ('hygienist','resources.reports.pl_summary.view', false),
  ('office_manager','resources.reports.pl_summary.view', false),
  ('treatment_coordinator','resources.reports.pl_summary.view', false),
  ('rda','resources.reports.pl_summary.view', false),
  ('clinical_manager','resources.reports.pl_summary.view', false),
  ('dental_assistant','resources.reports.pl_summary.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.reports.office_breakdown.view', true),
  ('admin','resources.reports.office_breakdown.view', true),
  ('regional_manager','resources.reports.office_breakdown.view', true),
  ('regional_clinical_manager','resources.reports.office_breakdown.view', true),
  ('front_desk','resources.reports.office_breakdown.view', false),
  ('staff','resources.reports.office_breakdown.view', false),
  ('doctor','resources.reports.office_breakdown.view', false),
  ('hygienist','resources.reports.office_breakdown.view', false),
  ('office_manager','resources.reports.office_breakdown.view', false),
  ('treatment_coordinator','resources.reports.office_breakdown.view', false),
  ('rda','resources.reports.office_breakdown.view', false),
  ('clinical_manager','resources.reports.office_breakdown.view', false),
  ('dental_assistant','resources.reports.office_breakdown.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.reports.goal_leaderboard.view', true),
  ('admin','resources.reports.goal_leaderboard.view', true),
  ('regional_manager','resources.reports.goal_leaderboard.view', true),
  ('regional_clinical_manager','resources.reports.goal_leaderboard.view', true),
  ('front_desk','resources.reports.goal_leaderboard.view', false),
  ('staff','resources.reports.goal_leaderboard.view', false),
  ('doctor','resources.reports.goal_leaderboard.view', false),
  ('hygienist','resources.reports.goal_leaderboard.view', false),
  ('office_manager','resources.reports.goal_leaderboard.view', false),
  ('treatment_coordinator','resources.reports.goal_leaderboard.view', false),
  ('rda','resources.reports.goal_leaderboard.view', false),
  ('clinical_manager','resources.reports.goal_leaderboard.view', false),
  ('dental_assistant','resources.reports.goal_leaderboard.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.reports.period_comparison.view', true),
  ('admin','resources.reports.period_comparison.view', true),
  ('regional_manager','resources.reports.period_comparison.view', true),
  ('regional_clinical_manager','resources.reports.period_comparison.view', true),
  ('front_desk','resources.reports.period_comparison.view', false),
  ('staff','resources.reports.period_comparison.view', false),
  ('doctor','resources.reports.period_comparison.view', false),
  ('hygienist','resources.reports.period_comparison.view', false),
  ('office_manager','resources.reports.period_comparison.view', false),
  ('treatment_coordinator','resources.reports.period_comparison.view', false),
  ('rda','resources.reports.period_comparison.view', false),
  ('clinical_manager','resources.reports.period_comparison.view', false),
  ('dental_assistant','resources.reports.period_comparison.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.reports.revenue_by_provider.view', true),
  ('admin','resources.reports.revenue_by_provider.view', true),
  ('regional_manager','resources.reports.revenue_by_provider.view', true),
  ('regional_clinical_manager','resources.reports.revenue_by_provider.view', true),
  ('front_desk','resources.reports.revenue_by_provider.view', false),
  ('staff','resources.reports.revenue_by_provider.view', false),
  ('doctor','resources.reports.revenue_by_provider.view', false),
  ('hygienist','resources.reports.revenue_by_provider.view', false),
  ('office_manager','resources.reports.revenue_by_provider.view', false),
  ('treatment_coordinator','resources.reports.revenue_by_provider.view', false),
  ('rda','resources.reports.revenue_by_provider.view', false),
  ('clinical_manager','resources.reports.revenue_by_provider.view', false),
  ('dental_assistant','resources.reports.revenue_by_provider.view', false)
ON CONFLICT DO NOTHING;

-- ── Sub-Tab Access: Inventory ─────────────────────────────────────────────────
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.overview.view', true),
  ('admin','resources.inventory.overview.view', true),
  ('regional_manager','resources.inventory.overview.view', true),
  ('regional_clinical_manager','resources.inventory.overview.view', true),
  ('front_desk','resources.inventory.overview.view', true),
  ('staff','resources.inventory.overview.view', true),
  ('doctor','resources.inventory.overview.view', false),
  ('hygienist','resources.inventory.overview.view', false),
  ('office_manager','resources.inventory.overview.view', true),
  ('treatment_coordinator','resources.inventory.overview.view', false),
  ('rda','resources.inventory.overview.view', true),
  ('clinical_manager','resources.inventory.overview.view', true),
  ('dental_assistant','resources.inventory.overview.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.bone_tissue.view', true),
  ('admin','resources.inventory.bone_tissue.view', true),
  ('regional_manager','resources.inventory.bone_tissue.view', true),
  ('regional_clinical_manager','resources.inventory.bone_tissue.view', true),
  ('front_desk','resources.inventory.bone_tissue.view', false),
  ('staff','resources.inventory.bone_tissue.view', false),
  ('doctor','resources.inventory.bone_tissue.view', false),
  ('hygienist','resources.inventory.bone_tissue.view', false),
  ('office_manager','resources.inventory.bone_tissue.view', false),
  ('treatment_coordinator','resources.inventory.bone_tissue.view', false),
  ('rda','resources.inventory.bone_tissue.view', true),
  ('clinical_manager','resources.inventory.bone_tissue.view', true),
  ('dental_assistant','resources.inventory.bone_tissue.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.implant.view', true),
  ('admin','resources.inventory.implant.view', true),
  ('regional_manager','resources.inventory.implant.view', true),
  ('regional_clinical_manager','resources.inventory.implant.view', true),
  ('front_desk','resources.inventory.implant.view', false),
  ('staff','resources.inventory.implant.view', false),
  ('doctor','resources.inventory.implant.view', false),
  ('hygienist','resources.inventory.implant.view', false),
  ('office_manager','resources.inventory.implant.view', false),
  ('treatment_coordinator','resources.inventory.implant.view', false),
  ('rda','resources.inventory.implant.view', true),
  ('clinical_manager','resources.inventory.implant.view', true),
  ('dental_assistant','resources.inventory.implant.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.front_desk.view', true),
  ('admin','resources.inventory.front_desk.view', true),
  ('regional_manager','resources.inventory.front_desk.view', true),
  ('regional_clinical_manager','resources.inventory.front_desk.view', true),
  ('front_desk','resources.inventory.front_desk.view', true),
  ('staff','resources.inventory.front_desk.view', true),
  ('doctor','resources.inventory.front_desk.view', false),
  ('hygienist','resources.inventory.front_desk.view', false),
  ('office_manager','resources.inventory.front_desk.view', true),
  ('treatment_coordinator','resources.inventory.front_desk.view', false),
  ('rda','resources.inventory.front_desk.view', false),
  ('clinical_manager','resources.inventory.front_desk.view', false),
  ('dental_assistant','resources.inventory.front_desk.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.usage_log.view', true),
  ('admin','resources.inventory.usage_log.view', true),
  ('regional_manager','resources.inventory.usage_log.view', true),
  ('regional_clinical_manager','resources.inventory.usage_log.view', true),
  ('front_desk','resources.inventory.usage_log.view', false),
  ('staff','resources.inventory.usage_log.view', false),
  ('doctor','resources.inventory.usage_log.view', false),
  ('hygienist','resources.inventory.usage_log.view', false),
  ('office_manager','resources.inventory.usage_log.view', true),
  ('treatment_coordinator','resources.inventory.usage_log.view', false),
  ('rda','resources.inventory.usage_log.view', true),
  ('clinical_manager','resources.inventory.usage_log.view', true),
  ('dental_assistant','resources.inventory.usage_log.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.bulk_import.view', true),
  ('admin','resources.inventory.bulk_import.view', true),
  ('regional_manager','resources.inventory.bulk_import.view', false),
  ('regional_clinical_manager','resources.inventory.bulk_import.view', false),
  ('front_desk','resources.inventory.bulk_import.view', false),
  ('staff','resources.inventory.bulk_import.view', false),
  ('doctor','resources.inventory.bulk_import.view', false),
  ('hygienist','resources.inventory.bulk_import.view', false),
  ('office_manager','resources.inventory.bulk_import.view', false),
  ('treatment_coordinator','resources.inventory.bulk_import.view', false),
  ('rda','resources.inventory.bulk_import.view', false),
  ('clinical_manager','resources.inventory.bulk_import.view', false),
  ('dental_assistant','resources.inventory.bulk_import.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.settings.view', true),
  ('admin','resources.inventory.settings.view', true),
  ('regional_manager','resources.inventory.settings.view', false),
  ('regional_clinical_manager','resources.inventory.settings.view', false),
  ('front_desk','resources.inventory.settings.view', false),
  ('staff','resources.inventory.settings.view', false),
  ('doctor','resources.inventory.settings.view', false),
  ('hygienist','resources.inventory.settings.view', false),
  ('office_manager','resources.inventory.settings.view', false),
  ('treatment_coordinator','resources.inventory.settings.view', false),
  ('rda','resources.inventory.settings.view', false),
  ('clinical_manager','resources.inventory.settings.view', false),
  ('dental_assistant','resources.inventory.settings.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.reports.view', true),
  ('admin','resources.inventory.reports.view', true),
  ('regional_manager','resources.inventory.reports.view', true),
  ('regional_clinical_manager','resources.inventory.reports.view', true),
  ('front_desk','resources.inventory.reports.view', false),
  ('staff','resources.inventory.reports.view', false),
  ('doctor','resources.inventory.reports.view', false),
  ('hygienist','resources.inventory.reports.view', false),
  ('office_manager','resources.inventory.reports.view', true),
  ('treatment_coordinator','resources.inventory.reports.view', false),
  ('rda','resources.inventory.reports.view', false),
  ('clinical_manager','resources.inventory.reports.view', false),
  ('dental_assistant','resources.inventory.reports.view', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','resources.inventory.monthly_supply.view', true),
  ('admin','resources.inventory.monthly_supply.view', true),
  ('regional_manager','resources.inventory.monthly_supply.view', true),
  ('regional_clinical_manager','resources.inventory.monthly_supply.view', true),
  ('front_desk','resources.inventory.monthly_supply.view', true),
  ('staff','resources.inventory.monthly_supply.view', true),
  ('doctor','resources.inventory.monthly_supply.view', false),
  ('hygienist','resources.inventory.monthly_supply.view', false),
  ('office_manager','resources.inventory.monthly_supply.view', true),
  ('treatment_coordinator','resources.inventory.monthly_supply.view', false),
  ('rda','resources.inventory.monthly_supply.view', true),
  ('clinical_manager','resources.inventory.monthly_supply.view', true),
  ('dental_assistant','resources.inventory.monthly_supply.view', false)
ON CONFLICT DO NOTHING;
