-- ============================================================
-- EOD Approval Workflow Fix
-- Timestamp: 20260327000000
-- Root causes fixed:
--   1. user_has_all_office_access() excluded regional_manager/regional_clinical_manager
--   2. Status mismatch: DB default 'pending_review' vs form insert 'pending'
--   3. approval_note column missing (table has rejection_reason)
--   4. Missing submitted_at, submitter_name columns for audit trail
--   5. Missing eod_status_history audit table
--   6. UPDATE policy blocked regional managers from approving
-- ============================================================

-- ─── 1. Add missing columns to daily_entries ─────────────────────────────────
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitter_name TEXT,
  ADD COLUMN IF NOT EXISTS approver_name TEXT,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- ─── 2. Normalize status default to 'pending' ────────────────────────────────
ALTER TABLE public.daily_entries
  ALTER COLUMN status SET DEFAULT 'pending';

-- Back-fill any rows that were inserted with the old default
UPDATE public.daily_entries
  SET status = 'pending'
  WHERE status = 'pending_review';

-- ─── 3. EOD status history / audit trail table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.eod_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES public.daily_entries(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  changed_by    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changer_name  TEXT,
  changer_role  TEXT,
  note          TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eod_status_history_entry_id
  ON public.eod_status_history(entry_id);

CREATE INDEX IF NOT EXISTS idx_eod_status_history_changed_at
  ON public.eod_status_history(changed_at DESC);

ALTER TABLE public.eod_status_history ENABLE ROW LEVEL SECURITY;

-- ─── 4. Fix user_has_all_office_access to include regional roles ──────────────
-- This was the PRIMARY bug: regional_manager and regional_clinical_manager
-- were excluded, so they received zero rows from daily_entries SELECT.
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
      AND role::TEXT IN (
        'super_admin',
        'admin',
        'regional_manager',
        'regional_clinical_manager'
      )
  );
$$;

-- ─── 5. Helper: is current user a regional manager (either type) ──────────────
CREATE OR REPLACE FUNCTION public.is_regional_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::TEXT IN ('regional_manager', 'regional_clinical_manager')
  );
$$;

-- ─── 6. Replace daily_entries SELECT policy ──────────────────────────────────
-- Drops all prior conflicting SELECT policies and creates one clean policy.
DROP POLICY IF EXISTS "rbac_daily_entries_select"            ON public.daily_entries;
DROP POLICY IF EXISTS "office_strict_daily_entries_select"   ON public.daily_entries;

CREATE POLICY "eod_daily_entries_select"
  ON public.daily_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      -- super_admin, admin, regional_manager, regional_clinical_manager see ALL
      public.user_has_all_office_access()
      -- office_manager sees own office only
      OR (
        public.is_office_manager()
        AND office_id = public.current_user_office_id()
      )
      -- any other authenticated user sees their own submissions
      OR submitted_by = auth.uid()
    )
  );

-- ─── 7. Replace daily_entries UPDATE policy ──────────────────────────────────
-- Regional managers must be able to approve/reject (UPDATE status, approved_by, etc.)
DROP POLICY IF EXISTS "rbac_daily_entries_update" ON public.daily_entries;

CREATE POLICY "eod_daily_entries_update"
  ON public.daily_entries
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.user_has_all_office_access()
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

-- ─── 8. RLS for eod_status_history ───────────────────────────────────────────
DROP POLICY IF EXISTS "eod_status_history_select" ON public.eod_status_history;
CREATE POLICY "eod_status_history_select"
  ON public.eod_status_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.user_has_all_office_access()
      OR changed_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.daily_entries de
        WHERE de.id = entry_id
          AND (
            de.submitted_by = auth.uid()
            OR (public.is_office_manager() AND de.office_id = public.current_user_office_id())
          )
      )
    )
  );

DROP POLICY IF EXISTS "eod_status_history_insert" ON public.eod_status_history;
CREATE POLICY "eod_status_history_insert"
  ON public.eod_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND changed_by = auth.uid()
  );

-- ─── 9. Trigger: auto-stamp submitted_at when status becomes 'pending' ────────
CREATE OR REPLACE FUNCTION public.eod_status_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Stamp submitted_at on first submission
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status <> 'pending') THEN
    NEW.submitted_at := now();
  END IF;
  -- Stamp approved_at when approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    NEW.approved_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_eod_status_stamp ON public.daily_entries;
CREATE TRIGGER trg_eod_status_stamp
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.eod_status_stamp();

-- ─── 10. Indexes for approval queue performance ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_entries_status
  ON public.daily_entries(status);

CREATE INDEX IF NOT EXISTS idx_daily_entries_office_status
  ON public.daily_entries(office_id, status);

CREATE INDEX IF NOT EXISTS idx_daily_entries_submitted_at
  ON public.daily_entries(submitted_at DESC NULLS LAST);
