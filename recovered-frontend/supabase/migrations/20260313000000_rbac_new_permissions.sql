-- Migration: New RBAC Permission Keys
-- Adds huddle, financial, performance, and inventory permission keys
-- with default role assignments per spec

INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
  -- ============================================================
  -- SUPER ADMIN: all permissions enabled
  -- ============================================================
  ('super_admin', 'huddle:view',                  true),
  ('super_admin', 'huddle:edit',                  true),
  ('super_admin', 'analytics:financial_view',     true),
  ('super_admin', 'reports:financial_view',        true),
  ('super_admin', 'performance:office_view',       true),
  ('super_admin', 'performance:provider_view',     true),
  ('super_admin', 'inventory:view',               true),
  ('super_admin', 'inventory:edit',               true),

  -- ============================================================
  -- ADMIN: all except performance:provider_view
  -- ============================================================
  ('admin', 'huddle:view',                  true),
  ('admin', 'huddle:edit',                  true),
  ('admin', 'analytics:financial_view',     true),
  ('admin', 'reports:financial_view',        true),
  ('admin', 'performance:office_view',       true),
  ('admin', 'performance:provider_view',     false),
  ('admin', 'inventory:view',               true),
  ('admin', 'inventory:edit',               true),

  -- ============================================================
  -- CLINICAL MANAGER: all except performance:provider_view
  -- ============================================================
  ('clinical_manager', 'huddle:view',                  true),
  ('clinical_manager', 'huddle:edit',                  true),
  ('clinical_manager', 'analytics:financial_view',     true),
  ('clinical_manager', 'reports:financial_view',        true),
  ('clinical_manager', 'performance:office_view',       true),
  ('clinical_manager', 'performance:provider_view',     false),
  ('clinical_manager', 'inventory:view',               true),
  ('clinical_manager', 'inventory:edit',               true),

  -- ============================================================
  -- OFFICE MANAGER: all except performance:provider_view
  -- ============================================================
  ('office_manager', 'huddle:view',                  true),
  ('office_manager', 'huddle:edit',                  true),
  ('office_manager', 'analytics:financial_view',     true),
  ('office_manager', 'reports:financial_view',        true),
  ('office_manager', 'performance:office_view',       true),
  ('office_manager', 'performance:provider_view',     false),
  ('office_manager', 'inventory:view',               true),
  ('office_manager', 'inventory:edit',               true),

  -- ============================================================
  -- FRONT DESK: huddle:view and inventory:view only
  -- ============================================================
  ('front_desk', 'huddle:view',                  true),
  ('front_desk', 'huddle:edit',                  false),
  ('front_desk', 'analytics:financial_view',     false),
  ('front_desk', 'reports:financial_view',        false),
  ('front_desk', 'performance:office_view',       false),
  ('front_desk', 'performance:provider_view',     false),
  ('front_desk', 'inventory:view',               true),
  ('front_desk', 'inventory:edit',               false),

  -- ============================================================
  -- DENTAL ASSISTANT (back staff): huddle:view and inventory:view only
  -- ============================================================
  ('dental_assistant', 'huddle:view',                  true),
  ('dental_assistant', 'huddle:edit',                  false),
  ('dental_assistant', 'analytics:financial_view',     false),
  ('dental_assistant', 'reports:financial_view',        false),
  ('dental_assistant', 'performance:office_view',       false),
  ('dental_assistant', 'performance:provider_view',     false),
  ('dental_assistant', 'inventory:view',               true),
  ('dental_assistant', 'inventory:edit',               false),

  -- ============================================================
  -- STAFF: huddle:view and inventory:view only
  -- ============================================================
  ('staff', 'huddle:view',                  true),
  ('staff', 'huddle:edit',                  false),
  ('staff', 'analytics:financial_view',     false),
  ('staff', 'reports:financial_view',        false),
  ('staff', 'performance:office_view',       false),
  ('staff', 'performance:provider_view',     false),
  ('staff', 'inventory:view',               true),
  ('staff', 'inventory:edit',               false),

  -- ============================================================
  -- DOCTOR: huddle:view, inventory:view, performance:office_view
  -- ============================================================
  ('doctor', 'huddle:view',                  true),
  ('doctor', 'huddle:edit',                  false),
  ('doctor', 'analytics:financial_view',     false),
  ('doctor', 'reports:financial_view',        false),
  ('doctor', 'performance:office_view',       true),
  ('doctor', 'performance:provider_view',     false),
  ('doctor', 'inventory:view',               true),
  ('doctor', 'inventory:edit',               false),

  -- ============================================================
  -- HYGIENIST: huddle:view and inventory:view only
  -- ============================================================
  ('hygienist', 'huddle:view',                  true),
  ('hygienist', 'huddle:edit',                  false),
  ('hygienist', 'analytics:financial_view',     false),
  ('hygienist', 'reports:financial_view',        false),
  ('hygienist', 'performance:office_view',       false),
  ('hygienist', 'performance:provider_view',     false),
  ('hygienist', 'inventory:view',               true),
  ('hygienist', 'inventory:edit',               false),

  -- ============================================================
  -- RDA: huddle:view and inventory:view only
  -- ============================================================
  ('rda', 'huddle:view',                  true),
  ('rda', 'huddle:edit',                  false),
  ('rda', 'analytics:financial_view',     false),
  ('rda', 'reports:financial_view',        false),
  ('rda', 'performance:office_view',       false),
  ('rda', 'performance:provider_view',     false),
  ('rda', 'inventory:view',               true),
  ('rda', 'inventory:edit',               false),

  -- ============================================================
  -- TREATMENT COORDINATOR: huddle:view, inventory:view
  -- ============================================================
  ('treatment_coordinator', 'huddle:view',                  true),
  ('treatment_coordinator', 'huddle:edit',                  false),
  ('treatment_coordinator', 'analytics:financial_view',     false),
  ('treatment_coordinator', 'reports:financial_view',        false),
  ('treatment_coordinator', 'performance:office_view',       false),
  ('treatment_coordinator', 'performance:provider_view',     false),
  ('treatment_coordinator', 'inventory:view',               true),
  ('treatment_coordinator', 'inventory:edit',               false)

ON CONFLICT (role, permission) DO NOTHING;
