-- Migration: Supply Chain & Ordering Permissions
-- Adds request:front_desk_order and request:back_staff_order permission keys
-- with default assignments per role

-- Seed new permissions for all existing roles
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
    -- Super Admin: both enabled
    ('super_admin', 'request:front_desk_order', true),
    ('super_admin', 'request:back_staff_order', true),

    -- Admin: both enabled
    ('admin', 'request:front_desk_order', true),
    ('admin', 'request:back_staff_order', true),

    -- Front Desk role: front desk order enabled
    ('front_desk', 'request:front_desk_order', true),
    ('front_desk', 'request:back_staff_order', false),

    -- Dental Assistant: back staff order enabled
    ('dental_assistant', 'request:front_desk_order', false),
    ('dental_assistant', 'request:back_staff_order', true),

    -- Hygienist: back staff order enabled
    ('hygienist', 'request:front_desk_order', false),
    ('hygienist', 'request:back_staff_order', true),

    -- Staff: neither enabled by default
    ('staff', 'request:front_desk_order', false),
    ('staff', 'request:back_staff_order', false),

    -- Doctor: neither enabled by default
    ('doctor', 'request:front_desk_order', false),
    ('doctor', 'request:back_staff_order', false),

    -- Office Manager: neither enabled by default
    ('office_manager', 'request:front_desk_order', false),
    ('office_manager', 'request:back_staff_order', false),

    -- Treatment Coordinator: neither enabled by default
    ('treatment_coordinator', 'request:front_desk_order', false),
    ('treatment_coordinator', 'request:back_staff_order', false),

    -- RDA: neither enabled by default
    ('rda', 'request:front_desk_order', false),
    ('rda', 'request:back_staff_order', false),

    -- Clinical Manager: neither enabled by default
    ('clinical_manager', 'request:front_desk_order', false),
    ('clinical_manager', 'request:back_staff_order', false)

ON CONFLICT (role, permission) DO NOTHING;
