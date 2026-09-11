-- Migration: Office-Level RLS Data Isolation
-- Ensures all data tables enforce office_id filtering at the database level
-- Timestamp: 20260314000000

-- ─── 1. Helper: Check if current user has all-office access (super_admin or admin) ───
CREATE OR REPLACE FUNCTION public.user_has_all_office_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::TEXT IN ('super_admin', 'admin')
  );
$$;

-- ─── 2. Helper: Get office_id for current user (returns NULL for all-office users) ───
CREATE OR REPLACE FUNCTION public.get_user_office_id()
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

-- ─── 3. RLS on huddles table ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'huddles'
  ) THEN
    ALTER TABLE public.huddles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "office_rls_huddles_select" ON public.huddles;
    CREATE POLICY "office_rls_huddles_select"
      ON public.huddles
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.get_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddles_insert" ON public.huddles;
    CREATE POLICY "office_rls_huddles_insert"
      ON public.huddles
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.get_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddles_update" ON public.huddles;
    CREATE POLICY "office_rls_huddles_update"
      ON public.huddles
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.get_user_office_id()
        )
      )
      WITH CHECK (
        public.is_active_user()
      );

    DROP POLICY IF EXISTS "office_rls_huddles_delete" ON public.huddles;
    CREATE POLICY "office_rls_huddles_delete"
      ON public.huddles
      FOR DELETE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.get_user_office_id()
        )
      );
  END IF;
END $$;

-- ─── 4. RLS on huddle_provider_blocks (via huddle office_id) ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'huddle_provider_blocks'
  ) THEN
    ALTER TABLE public.huddle_provider_blocks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "office_rls_huddle_provider_blocks_select" ON public.huddle_provider_blocks;
    CREATE POLICY "office_rls_huddle_provider_blocks_select"
      ON public.huddle_provider_blocks
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddle_provider_blocks_insert" ON public.huddle_provider_blocks;
    CREATE POLICY "office_rls_huddle_provider_blocks_insert"
      ON public.huddle_provider_blocks
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddle_provider_blocks_update" ON public.huddle_provider_blocks;
    CREATE POLICY "office_rls_huddle_provider_blocks_update"
      ON public.huddle_provider_blocks
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      )
      WITH CHECK (public.is_active_user());

    DROP POLICY IF EXISTS "office_rls_huddle_provider_blocks_delete" ON public.huddle_provider_blocks;
    CREATE POLICY "office_rls_huddle_provider_blocks_delete"
      ON public.huddle_provider_blocks
      FOR DELETE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );
  END IF;
END $$;

-- ─── 5. RLS on huddle_checklist_items (via huddle office_id) ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'huddle_checklist_items'
  ) THEN
    ALTER TABLE public.huddle_checklist_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "office_rls_huddle_checklist_items_select" ON public.huddle_checklist_items;
    CREATE POLICY "office_rls_huddle_checklist_items_select"
      ON public.huddle_checklist_items
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddle_checklist_items_insert" ON public.huddle_checklist_items;
    CREATE POLICY "office_rls_huddle_checklist_items_insert"
      ON public.huddle_checklist_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );

    DROP POLICY IF EXISTS "office_rls_huddle_checklist_items_update" ON public.huddle_checklist_items;
    CREATE POLICY "office_rls_huddle_checklist_items_update"
      ON public.huddle_checklist_items
      FOR UPDATE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      )
      WITH CHECK (public.is_active_user());

    DROP POLICY IF EXISTS "office_rls_huddle_checklist_items_delete" ON public.huddle_checklist_items;
    CREATE POLICY "office_rls_huddle_checklist_items_delete"
      ON public.huddle_checklist_items
      FOR DELETE
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR EXISTS (
            SELECT 1 FROM public.huddles h
            WHERE h.id = huddle_id
              AND h.office_id = public.get_user_office_id()
          )
        )
      );
  END IF;
END $$;

-- ─── 6. Strengthen daily_entries RLS: staff must match their own office_id ────
-- Replaces existing rbac_daily_entries_select to enforce strict office isolation
-- for staff/doctor roles (not just submitted_by)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_entries'
  ) THEN
    DROP POLICY IF EXISTS "office_strict_daily_entries_select" ON public.daily_entries;
    CREATE POLICY "office_strict_daily_entries_select"
      ON public.daily_entries
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
          OR (
            NOT public.is_office_manager()
            AND NOT public.user_has_all_office_access()
            AND office_id = public.current_user_office_id()
          )
        )
      );
  END IF;
END $$;

-- ─── 7. RLS on office_goals (if exists) ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'office_goals'
  ) THEN
    ALTER TABLE public.office_goals ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "office_rls_office_goals_select" ON public.office_goals;
    CREATE POLICY "office_rls_office_goals_select"
      ON public.office_goals
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.current_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "office_rls_office_goals_write" ON public.office_goals;
    CREATE POLICY "office_rls_office_goals_write"
      ON public.office_goals
      FOR ALL
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
        )
      )
      WITH CHECK (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR (
            public.is_office_manager()
            AND office_id = public.current_user_office_id()
          )
        )
      );
  END IF;
END $$;

-- ─── 8. RLS on providers: staff/office_manager see only their office ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'providers'
  ) THEN
    ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "office_rls_providers_select" ON public.providers;
    CREATE POLICY "office_rls_providers_select"
      ON public.providers
      FOR SELECT
      TO authenticated
      USING (
        public.is_active_user()
        AND (
          public.user_has_all_office_access()
          OR office_id = public.current_user_office_id()
        )
      );

    DROP POLICY IF EXISTS "office_rls_providers_write" ON public.providers;
    CREATE POLICY "office_rls_providers_write"
      ON public.providers
      FOR ALL
      TO authenticated
      USING (
        public.is_active_user()
        AND public.is_admin_or_above()
      )
      WITH CHECK (
        public.is_active_user()
        AND public.is_admin_or_above()
      );
  END IF;
END $$;
