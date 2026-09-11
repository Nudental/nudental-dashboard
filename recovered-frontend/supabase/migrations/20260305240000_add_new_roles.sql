-- Migration: Add new roles - Office Manager, Treatment Coordinator, RDA, Clinical Manager, Dental Assistant
-- Seeds default permissions for each new role in role_permissions table

-- Seed default permissions for new roles
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
    -- Office Manager: can view reports, edit entries, approve entries
    ('office_manager', 'view_reports', true),
    ('office_manager', 'edit_entries', true),
    ('office_manager', 'manage_users', false),
    ('office_manager', 'approve_entries', true),
    ('office_manager', 'manage_categories', false),
    ('office_manager', 'view_audit_logs', true),

    -- Treatment Coordinator: can view reports and edit entries
    ('treatment_coordinator', 'view_reports', true),
    ('treatment_coordinator', 'edit_entries', true),
    ('treatment_coordinator', 'manage_users', false),
    ('treatment_coordinator', 'approve_entries', false),
    ('treatment_coordinator', 'manage_categories', false),
    ('treatment_coordinator', 'view_audit_logs', false),

    -- RDA: can edit entries only
    ('rda', 'view_reports', false),
    ('rda', 'edit_entries', true),
    ('rda', 'manage_users', false),
    ('rda', 'approve_entries', false),
    ('rda', 'manage_categories', false),
    ('rda', 'view_audit_logs', false),

    -- Clinical Manager: can view reports, edit entries, approve entries, view audit logs
    ('clinical_manager', 'view_reports', true),
    ('clinical_manager', 'edit_entries', true),
    ('clinical_manager', 'manage_users', false),
    ('clinical_manager', 'approve_entries', true),
    ('clinical_manager', 'manage_categories', false),
    ('clinical_manager', 'view_audit_logs', true),

    -- Dental Assistant: can edit entries only
    ('dental_assistant', 'view_reports', false),
    ('dental_assistant', 'edit_entries', true),
    ('dental_assistant', 'manage_users', false),
    ('dental_assistant', 'approve_entries', false),
    ('dental_assistant', 'manage_categories', false),
    ('dental_assistant', 'view_audit_logs', false)
ON CONFLICT (role, permission) DO NOTHING;
