-- Migration: Remove fake/demo providers from all offices
-- Removes: Dr. Sarah Mitchell, Dr. James Chen, Dr. Maria Rodriguez, Sara Johnson (hygienist), Michael Williams (hygienist)
-- Real providers seeded in 20260305170000_seed_providers_all_offices.sql remain intact

DO $$
BEGIN
  -- Remove fake/demo doctors
  DELETE FROM public.providers
  WHERE name IN (
    'Dr. Sarah Mitchell',
    'Dr. James Chen',
    'Dr. Maria Rodriguez'
  )
  AND provider_type = 'doctor'::public.provider_type;

  -- Remove fake/demo hygienists
  DELETE FROM public.providers
  WHERE name IN (
    'Sara Johnson',
    'Michael Williams'
  )
  AND provider_type = 'hygienist'::public.provider_type;

  RAISE NOTICE 'Fake/demo providers removed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Provider cleanup encountered an issue: %', SQLERRM;
END $$;
