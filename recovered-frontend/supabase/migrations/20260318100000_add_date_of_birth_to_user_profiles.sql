-- Migration: Add date_of_birth to user_profiles
-- Safe, additive migration — does not alter or remove any existing columns

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Index for birthday queries (month + day comparisons)
CREATE INDEX IF NOT EXISTS idx_user_profiles_dob
  ON public.user_profiles (date_of_birth)
  WHERE date_of_birth IS NOT NULL;
