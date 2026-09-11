-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2D STEP 1: Role Permission Audit Log
-- Creates a dedicated, immutable audit table for Role Editor permission changes.
--
-- Scope:
--   - New table only: public.role_permission_audit_log
--   - RLS enabled; INSERT super_admin only; SELECT admin + super_admin
--   - No UPDATE policy; No DELETE policy (append-only)
--   - Four indexes for query performance
--
-- No existing tables, RLS policies, role_permissions values, auth/users,
-- frontend code, nav behavior, or page guards are changed by this migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Create Table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permission_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_role     TEXT        NOT NULL,
  permission_key  TEXT        NOT NULL,
  old_enabled     BOOLEAN     NOT NULL,
  new_enabled     BOOLEAN     NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'role_editor',
  save_batch_id   UUID        NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.role_permission_audit_log ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS Policies ─────────────────────────────────────────────────────────
-- INSERT: super_admin only
-- Audit rows may only be written by super_admin (the only role that can reach
-- the Role Editor). Uses the existing trusted helper public.is_super_admin().
DROP POLICY IF EXISTS "super_admin_insert_role_permission_audit" ON public.role_permission_audit_log;
CREATE POLICY "super_admin_insert_role_permission_audit"
ON public.role_permission_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- SELECT: admin and super_admin
-- Both admin and super_admin may read audit history for compliance review.
-- Uses the existing trusted helper public.is_admin_or_above().
DROP POLICY IF EXISTS "admin_read_role_permission_audit" ON public.role_permission_audit_log;
CREATE POLICY "admin_read_role_permission_audit"
ON public.role_permission_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin_or_above());

-- No UPDATE policy — audit rows are immutable.
-- No DELETE policy — audit rows are append-only.

-- ─── 4. Indexes ──────────────────────────────────────────────────────────────
-- Composite index for per-key history queries
CREATE INDEX IF NOT EXISTS idx_rpal_target_role_permission_key
  ON public.role_permission_audit_log (target_role, permission_key);

-- Index for per-save-batch rollback queries
CREATE INDEX IF NOT EXISTS idx_rpal_save_batch_id
  ON public.role_permission_audit_log (save_batch_id);

-- Index for per-actor audit queries
CREATE INDEX IF NOT EXISTS idx_rpal_actor_id
  ON public.role_permission_audit_log (actor_id);

-- Index for chronological queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_rpal_changed_at_desc
  ON public.role_permission_audit_log (changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run manually to confirm)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Confirm table exists with correct columns:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'role_permission_audit_log'
--    ORDER BY ordinal_position;
--
-- 2. Confirm RLS is enabled:
--    SELECT relname, relrowsecurity
--    FROM pg_class
--    WHERE relname = 'role_permission_audit_log';
--
-- 3. Confirm policies exist (expect 2 rows: insert + select):
--    SELECT policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE tablename = 'role_permission_audit_log';
--
-- 4. Confirm indexes exist (expect 4 rows):
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'role_permission_audit_log';
--
-- ─────────────────────────────────────────────────────────────────────────────
