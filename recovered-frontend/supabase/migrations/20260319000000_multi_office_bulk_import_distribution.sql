-- Multi-Office Bulk Import & Automated Data Distribution
-- Ensures proper indexing and views for multi-office data routing

-- 1. Ensure the unique constraint for upsert exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_entries_office_date_provider_uq'
  ) THEN
    ALTER TABLE public.daily_entries
      ADD CONSTRAINT daily_entries_office_date_provider_uq
      UNIQUE (office_id, entry_date, provider_name);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- constraint may already exist from previous migration
END;
$$;

-- 2. Index for fast office+date lookups (used by Morning Huddle yesterday actuals)
CREATE INDEX IF NOT EXISTS idx_daily_entries_office_date
  ON public.daily_entries (office_id, entry_date DESC);

-- 3. Index for provider_name lookups across offices
CREATE INDEX IF NOT EXISTS idx_daily_entries_provider_name
  ON public.daily_entries (provider_name, office_id);

-- 4. Ensure regional roles can access daily_entries across offices
-- regional_manager and regional_clinical_manager get read access to all offices
DO $$
BEGIN
  -- Insert regional_manager permissions if not present
  INSERT INTO public.role_permissions (role, permission, enabled)
  VALUES
    ('regional_manager', 'dashboard:executive_overview', true),
    ('regional_manager', 'performance:office_view', true),
    ('regional_manager', 'performance:provider_view', true),
    ('regional_manager', 'analytics:financial_view', true),
    ('regional_clinical_manager', 'performance:provider_view', true),
    ('regional_clinical_manager', 'analytics:financial_view', true)
  ON CONFLICT (role, permission) DO NOTHING;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;

-- 5. Add provider_view permission to role_permissions if table has unique constraint
DO $$
BEGIN
  INSERT INTO public.role_permissions (role, permission, enabled)
  VALUES
    ('admin', 'performance:provider_view', true)
  ON CONFLICT (role, permission) DO NOTHING;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;
