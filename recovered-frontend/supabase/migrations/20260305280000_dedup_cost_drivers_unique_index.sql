-- Migration: Deduplicate cost_drivers and add unique index
-- Removes duplicate rows keeping only one record per unique (LOWER(name), office_id)
-- Then adds a unique index to prevent future duplicates

-- Step 1: Delete duplicates keeping the row with the minimum id (cast to text for comparison)
-- First pass: exact name match duplicates
DELETE FROM public.cost_drivers
WHERE id::text NOT IN (
  SELECT MIN(id::text)
  FROM public.cost_drivers
  GROUP BY name, office_id
);

-- Step 2: Delete case-insensitive duplicates (e.g. 'Amazon' vs 'amazon' same office)
-- Keep the row with the minimum id::text per (LOWER(name), office_id)
DELETE FROM public.cost_drivers
WHERE id::text NOT IN (
  SELECT MIN(id::text)
  FROM public.cost_drivers
  GROUP BY LOWER(name), office_id
);

-- Step 3: Add unique index on (LOWER(name), office_id) to prevent future duplicates
DROP INDEX IF EXISTS public.idx_cost_drivers_lower_name_office_id;
CREATE UNIQUE INDEX idx_cost_drivers_lower_name_office_id
  ON public.cost_drivers (LOWER(name), office_id);
