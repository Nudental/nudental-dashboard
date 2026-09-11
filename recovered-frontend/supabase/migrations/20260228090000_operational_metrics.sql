-- Migration: Operational Metrics columns for Daily Entry Form
-- Timestamp: 20260228090000

-- Add operational metrics columns to daily_entries (or revenue_entries) table
-- We add to revenue_entries since that's what the app uses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'revenue_entries'
  ) THEN
    ALTER TABLE public.revenue_entries
      ADD COLUMN IF NOT EXISTS new_patients integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS no_shows integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS treatment_presented numeric(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS treatment_accepted numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Create daily_entries table if it doesn't exist (standalone operational metrics store)
CREATE TABLE IF NOT EXISTS public.daily_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  provider_type text,
  production numeric(12,2) DEFAULT 0,
  collection numeric(12,2) DEFAULT 0,
  expense_category text,
  expense_amount numeric(12,2) DEFAULT 0,
  new_patients integer DEFAULT 0,
  no_shows integer DEFAULT 0,
  treatment_presented numeric(12,2) DEFAULT 0,
  treatment_accepted numeric(12,2) DEFAULT 0,
  notes text,
  status text DEFAULT 'pending_review',
  submitted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_entries_office_date ON public.daily_entries(office_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_submitted_by ON public.daily_entries(submitted_by);
CREATE INDEX IF NOT EXISTS idx_daily_entries_status ON public.daily_entries(status);

-- Enable RLS
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "daily_entries_select" ON public.daily_entries;
CREATE POLICY "daily_entries_select"
  ON public.daily_entries
  FOR SELECT
  USING (
    public.is_active_user()
  );

DROP POLICY IF EXISTS "daily_entries_insert" ON public.daily_entries;
CREATE POLICY "daily_entries_insert"
  ON public.daily_entries
  FOR INSERT
  WITH CHECK (
    public.is_active_user()
    AND submitted_by = auth.uid()
  );

DROP POLICY IF EXISTS "daily_entries_update" ON public.daily_entries;
CREATE POLICY "daily_entries_update"
  ON public.daily_entries
  FOR UPDATE
  USING (
    public.is_active_user()
    AND (
      submitted_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin')
      )
    )
  )
  WITH CHECK (
    public.is_active_user()
  );

-- Updated_at trigger for daily_entries
DROP TRIGGER IF EXISTS trg_daily_entries_updated_at ON public.daily_entries;
CREATE TRIGGER trg_daily_entries_updated_at
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Create goal_achievement_history table for leaderboard
CREATE TABLE IF NOT EXISTS public.goal_achievement_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  monthly_target numeric(12,2) DEFAULT 0,
  total_collected numeric(12,2) DEFAULT 0,
  goal_achieved boolean DEFAULT false,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(office_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_goal_achievement_office ON public.goal_achievement_history(office_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievement_month ON public.goal_achievement_history(month_year);

ALTER TABLE public.goal_achievement_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goal_achievement_select" ON public.goal_achievement_history;
CREATE POLICY "goal_achievement_select"
  ON public.goal_achievement_history
  FOR SELECT
  USING (public.is_active_user());

DROP POLICY IF EXISTS "goal_achievement_write" ON public.goal_achievement_history;
CREATE POLICY "goal_achievement_write"
  ON public.goal_achievement_history
  FOR ALL
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );
