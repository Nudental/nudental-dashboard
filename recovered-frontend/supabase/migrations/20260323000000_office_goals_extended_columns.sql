-- Migration: Add production_goal, collections_goal, new_patients_goal to office_goals
-- Timestamp: 20260323000000

ALTER TABLE public.office_goals
  ADD COLUMN IF NOT EXISTS production_goal numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collections_goal numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_patients_goal integer DEFAULT 0;

-- Backfill production_goal from monthly_target if it exists
UPDATE public.office_goals
SET production_goal = monthly_target
WHERE production_goal = 0 AND monthly_target > 0;
