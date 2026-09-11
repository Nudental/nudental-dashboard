-- Migration: Add theme column to user_profiles for user theme preferences

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'Nu Dental Brand';
