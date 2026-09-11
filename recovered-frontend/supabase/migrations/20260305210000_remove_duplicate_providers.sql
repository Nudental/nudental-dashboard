-- Migration: Remove duplicate provider records
-- Keep only the record with the MIN(id) per unique (name, provider_type, office_id) combination

DO $$
BEGIN
  -- Delete duplicate providers, keeping the one with the lowest id per group
  DELETE FROM public.providers
  WHERE id NOT IN (
    SELECT MIN(id::text)::uuid
    FROM public.providers
    GROUP BY name, provider_type, office_id
  );

  RAISE NOTICE 'Duplicate provider records removed successfully.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error removing duplicates: %', SQLERRM;
END $$;
