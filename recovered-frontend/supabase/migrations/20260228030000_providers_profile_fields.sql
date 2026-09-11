-- Add profile fields to providers table
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS specialization TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS license_number TEXT DEFAULT '';
