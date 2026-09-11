-- Migration: RBAC Update — Admin all-offices access, Office Manager office-scoped
-- Timestamp: 20260305180000

-- ─── 1. Extend user_role enum to include office_manager if not already present ───
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'office_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Helper: is current user an admin (not super_admin) ───────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'::public.user_role
  );
$$;

-- ─── 3. Helper: is current user an office_manager ────────────────────────────
-- NOTE: Using role::text comparison to avoid unsafe enum cast in same transaction
CREATE OR REPLACE FUNCTION public.is_office_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::text = 'office_manager'
  );
$$;

-- ─── 4. Helper: get the office_id of the current user ────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_office_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ─── 5. Update role_permissions for admin and office_manager ─────────────────
-- Admin: view_all_offices=true, edit_entries=true, view_reports=true
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
  ('admin', 'view_all_offices', true),
  ('admin', 'view_reports', true),
  ('admin', 'edit_entries', true),
  ('admin', 'approve_entries', true),
  ('admin', 'manage_users', false),
  ('admin', 'manage_categories', false),
  ('admin', 'view_audit_logs', false)
ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Office Manager: office_scoped=true, edit_entries=true, approve_entries=true, view_reports=true
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
  ('office_manager', 'view_all_offices', false),
  ('office_manager', 'office_scoped', true),
  ('office_manager', 'view_reports', true),
  ('office_manager', 'edit_entries', true),
  ('office_manager', 'approve_entries', true),
  ('office_manager', 'manage_users', false),
  ('office_manager', 'manage_categories', false),
  ('office_manager', 'view_audit_logs', false),
  ('office_manager', 'view_goals', true),
  ('office_manager', 'receive_pace_alerts', true)
ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled;

-- ─── 6. RLS on daily_entries: Admin sees all; Office Manager sees own office ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_entries'
  ) THEN

    -- SELECT: super_admin/admin see all; office_manager sees own office; staff sees own submissions
    DROP POLICY IF EXISTS "rbac_daily_entries_select" ON public.daily_entries;
    CREATE POLICY "rbac_daily_entries_select"
      ON public.daily_entries
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      );

    -- INSERT: active users can insert for their own office
    DROP POLICY IF EXISTS "rbac_daily_entries_insert" ON public.daily_entries;
    CREATE POLICY "rbac_daily_entries_insert"
      ON public.daily_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND submitted_by = auth.uid()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR office_id = public.current_user_office_id()
        )
      );

    -- UPDATE: admin/super_admin can update all; office_manager can update own office
    DROP POLICY IF EXISTS "rbac_daily_entries_update" ON public.daily_entries;
    CREATE POLICY "rbac_daily_entries_update"
      ON public.daily_entries
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      )
      WITH CHECK (
        public.is_active_user()
      );

  END IF;
END $$;

-- ─── 7. RLS on revenue_entries (if table exists) ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'revenue_entries'
  ) THEN

    DROP POLICY IF EXISTS "rbac_revenue_entries_select" ON public.revenue_entries;
    CREATE POLICY "rbac_revenue_entries_select"
      ON public.revenue_entries
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "rbac_revenue_entries_insert" ON public.revenue_entries;
    CREATE POLICY "rbac_revenue_entries_insert"
      ON public.revenue_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR office_id = public.current_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "rbac_revenue_entries_update" ON public.revenue_entries;
    CREATE POLICY "rbac_revenue_entries_update"
      ON public.revenue_entries
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      )
      WITH CHECK (public.is_active_user());

  END IF;
END $$;

-- ─── 8. RLS on expense_entries (if table exists) ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expense_entries'
  ) THEN

    DROP POLICY IF EXISTS "rbac_expense_entries_select" ON public.expense_entries;
    CREATE POLICY "rbac_expense_entries_select"
      ON public.expense_entries
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "rbac_expense_entries_insert" ON public.expense_entries;
    CREATE POLICY "rbac_expense_entries_insert"
      ON public.expense_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR office_id = public.current_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "rbac_expense_entries_update" ON public.expense_entries;
    CREATE POLICY "rbac_expense_entries_update"
      ON public.expense_entries
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.is_super_admin()
          OR public.is_admin()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR submitted_by = auth.uid()
        )
      )
      WITH CHECK (public.is_active_user());

  END IF;
END $$;

-- ─── 9. RLS on office_goals: Office Manager can read/write own office ─────────
DROP POLICY IF EXISTS "rbac_office_goals_select" ON public.office_goals;
CREATE POLICY "rbac_office_goals_select"
  ON public.office_goals
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  );

DROP POLICY IF EXISTS "rbac_office_goals_write" ON public.office_goals;
CREATE POLICY "rbac_office_goals_write"
  ON public.office_goals
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  );

-- ─── 10. RLS on goal_achievement_history: Office Manager sees own office ──────
DROP POLICY IF EXISTS "rbac_goal_achievement_select" ON public.goal_achievement_history;
CREATE POLICY "rbac_goal_achievement_select"
  ON public.goal_achievement_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  );

DROP POLICY IF EXISTS "rbac_goal_achievement_write" ON public.goal_achievement_history;
CREATE POLICY "rbac_goal_achievement_write"
  ON public.goal_achievement_history
  FOR ALL
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND (
      public.is_super_admin()
      OR public.is_admin()
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
    )
  );
