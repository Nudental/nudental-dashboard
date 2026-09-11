-- ============================================================
-- Add phone field to user_profiles
-- Migration: 20260307110000_add_phone_to_user_profiles.sql
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.phone IS 'Phone number for SMS notifications (E.164 format, e.g. +12015551234)';
