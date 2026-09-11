-- Migration: Add username and must_change_password to user_profiles
-- Supports username-based login flow with forced first-login password change

-- Add username column (nullable initially to not break existing rows)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add must_change_password flag for first-login enforcement
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Backfill username from email prefix for existing users (safe default)
UPDATE public.user_profiles
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL;

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_unique
ON public.user_profiles (LOWER(username))
WHERE username IS NOT NULL;

-- Create index for fast username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username
ON public.user_profiles (username);

-- Function: lookup email by username (used by login flow)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE LOWER(username) = LOWER(p_username)
  LIMIT 1;
  RETURN v_email;
END;
$$;
