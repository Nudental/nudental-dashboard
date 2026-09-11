-- Migration: Office Manager Role, Notifications/Alerts Table
-- Adds office_manager role support, notifications table for alert center

-- 1. Add office_manager role permissions
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
    ('office_manager', 'view_reports', true),
    ('office_manager', 'edit_entries', true),
    ('office_manager', 'manage_users', false),
    ('office_manager', 'approve_entries', true),
    ('office_manager', 'manage_categories', false),
    ('office_manager', 'view_audit_logs', false),
    ('office_manager', 'view_goals', true),
    ('office_manager', 'receive_pace_alerts', true)
ON CONFLICT (role, permission) DO NOTHING;

-- 2. Add approval fields to daily_entries if not present
ALTER TABLE public.daily_entries
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';

-- 3. NOTIFICATIONS / ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- 'pace_alert' | 'entry_approved' | 'entry_rejected' | 'entry_submitted' | 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_office_id ON public.notifications(office_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_entries_approved_by ON public.daily_entries(approved_by);

-- 5. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for notifications
DROP POLICY IF EXISTS "users_read_own_notifications" ON public.notifications;
CREATE POLICY "users_read_own_notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
CREATE POLICY "users_update_own_notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_notifications" ON public.notifications;
CREATE POLICY "service_insert_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
CREATE POLICY "users_delete_own_notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
