-- Add provider_name column to daily_entries for storing custom (freetext) provider names
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS provider_name text NULL DEFAULT NULL;

COMMENT ON COLUMN public.daily_entries.provider_name IS 'Freetext provider name — populated when provider_id is NULL (custom entry) or as a display name for existing providers';
