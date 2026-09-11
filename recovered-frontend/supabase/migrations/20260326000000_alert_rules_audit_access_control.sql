-- Migration: Alert Rules for Suspicious Activity & Audit Access Controls
-- Creates alert_rules table, suspicious_activity_events table,
-- and enforces role-based RLS on audit_logs

-- ─── 1. Alert Rules Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  -- rule_type: mass_deletion | after_hours | bulk_export | failed_login | rapid_role_change
  description TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  threshold_count INTEGER DEFAULT 5,
  threshold_minutes INTEGER DEFAULT 10,
  -- after_hours: business_start_hour / business_end_hour (0-23)
  business_start_hour INTEGER DEFAULT 8,
  business_end_hour INTEGER DEFAULT 18,
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  recipient_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- scope: 'all' | specific office_id
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_rule_type ON public.alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON public.alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_office_id ON public.alert_rules(office_id);

-- ─── 2. Suspicious Activity Events Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suspicious_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  -- severity: low | medium | high | critical
  triggered_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  event_count INTEGER DEFAULT 1,
  time_window_minutes INTEGER DEFAULT 10,
  details JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suspicious_events_rule_type ON public.suspicious_activity_events(rule_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_user ON public.suspicious_activity_events(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_created ON public.suspicious_activity_events(created_at);
CREATE INDEX IF NOT EXISTS idx_suspicious_events_resolved ON public.suspicious_activity_events(resolved);

-- ─── 3. Add change_summary column to audit_logs if missing ───────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS change_summary TEXT;

-- ─── 4. Helper functions for role-based audit access ─────────────────────────

-- Returns the current user's role from user_profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns the current user's office_id from user_profiles
CREATE OR REPLACE FUNCTION public.get_current_user_office_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns true if current user is super_admin or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$;

-- Returns true if current user is office_manager
CREATE OR REPLACE FUNCTION public.is_office_manager_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'office_manager'
  );
$$;

-- ─── 5. Enable RLS on new tables ─────────────────────────────────────────────
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspicious_activity_events ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS Policies: alert_rules ────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_alert_rules" ON public.alert_rules;
CREATE POLICY "admins_manage_alert_rules"
ON public.alert_rules
FOR ALL
TO authenticated
USING (public.is_admin_or_above())
WITH CHECK (public.is_admin_or_above());

-- ─── 7. RLS Policies: suspicious_activity_events ─────────────────────────────
DROP POLICY IF EXISTS "admins_view_suspicious_events" ON public.suspicious_activity_events;
CREATE POLICY "admins_view_suspicious_events"
ON public.suspicious_activity_events
FOR SELECT
TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "admins_manage_suspicious_events" ON public.suspicious_activity_events;
CREATE POLICY "admins_manage_suspicious_events"
ON public.suspicious_activity_events
FOR ALL
TO authenticated
USING (public.is_admin_or_above())
WITH CHECK (public.is_admin_or_above());

-- ─── 8. Role-Based RLS on audit_logs ─────────────────────────────────────────
-- Staff: see only their own actions
-- Office Manager: see all actions in their office (via user_profiles.office_id join)
-- Admin / Super Admin: see all

-- Drop existing permissive policy if any
DROP POLICY IF EXISTS "audit_logs_select_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_role_based_select" ON public.audit_logs;

CREATE POLICY "audit_logs_role_based_select"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  -- Admins and super_admins see everything
  public.is_admin_or_above()
  OR
  -- Office managers see logs from users in their office
  (
    public.is_office_manager_role()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles actor
      WHERE actor.id = audit_logs.user_id
      AND actor.office_id = public.get_current_user_office_id()
    )
  )
  OR
  -- Staff see only their own actions
  audit_logs.user_id = auth.uid()
);

-- Keep insert open for the trigger (SECURITY DEFINER trigger handles this)
DROP POLICY IF EXISTS "audit_logs_trigger_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_trigger_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ─── 9. Seed default alert rules ─────────────────────────────────────────────
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.user_profiles
  WHERE role IN ('super_admin', 'admin')
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO public.alert_rules (name, rule_type, description, enabled, threshold_count, threshold_minutes, notify_email, notify_in_app, created_by)
  VALUES
    ('Mass Deletion Alert', 'mass_deletion', 'Triggers when a user deletes more than 5 records within 10 minutes', true, 5, 10, true, true, admin_id),
    ('After-Hours Access Alert', 'after_hours', 'Triggers when a user accesses the system outside business hours (8am-6pm)', true, 1, 1, true, true, admin_id),
    ('Bulk Export Alert', 'bulk_export', 'Triggers when a user performs more than 3 export actions within 15 minutes', true, 3, 15, true, true, admin_id),
    ('Failed Login Alert', 'failed_login', 'Triggers when there are 5 or more failed login attempts within 10 minutes', true, 5, 10, true, true, admin_id),
    ('Rapid Role Change Alert', 'rapid_role_change', 'Triggers when user roles are changed more than 3 times within 30 minutes', true, 3, 30, true, true, admin_id)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed alert rules skipped: %', SQLERRM;
END $$;

-- ─── 10. Indexes for audit_logs role-based queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
