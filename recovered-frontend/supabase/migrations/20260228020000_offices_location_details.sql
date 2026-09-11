-- Migration: Add location detail columns to offices table and seed data
-- Adds: phone, fax, email, website fields

-- 1. Add new columns to offices table
ALTER TABLE public.offices
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fax TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';

-- 2. Seed / update the 4 Nu Dental locations with full details
DO $$
DECLARE
  eatontown_id UUID;
  brick_id UUID;
  barnegat_id UUID;
  statenisland_id UUID;
BEGIN
  -- Eatontown
  SELECT id INTO eatontown_id FROM public.offices WHERE name ILIKE '%eatontown%' LIMIT 1;
  IF eatontown_id IS NOT NULL THEN
    UPDATE public.offices SET
      address     = '178 NJ-35, Unit 6, Eatontown, NJ 07724',
      phone       = '(732) 945-7999',
      fax         = '(732) 945-7999',
      email       = 'eatontown@thenudental.com',
      website     = 'https://www.thenudental.com/',
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = eatontown_id;
  ELSE
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (
      gen_random_uuid(),
      'Nu Dental of Eatontown',
      '178 NJ-35, Unit 6, Eatontown, NJ 07724',
      '(732) 945-7999',
      '(732) 945-7999',
      'eatontown@thenudental.com',
      'https://www.thenudental.com/',
      true
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Brick
  SELECT id INTO brick_id FROM public.offices WHERE name ILIKE '%brick%' LIMIT 1;
  IF brick_id IS NOT NULL THEN
    UPDATE public.offices SET
      address     = '1683 NJ-88, Ste C, Brick Township, NJ',
      phone       = '(732) 475-7535',
      fax         = '(732) 534-3205',
      email       = 'brick@thenudental.com',
      website     = 'https://www.thebrickdentalcare.com/',
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = brick_id;
  ELSE
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (
      gen_random_uuid(),
      'Nu Dental of Brick',
      '1683 NJ-88, Ste C, Brick Township, NJ',
      '(732) 475-7535',
      '(732) 534-3205',
      'brick@thenudental.com',
      'https://www.thebrickdentalcare.com/',
      true
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Barnegat
  SELECT id INTO barnegat_id FROM public.offices WHERE name ILIKE '%barnegat%' LIMIT 1;
  IF barnegat_id IS NOT NULL THEN
    UPDATE public.offices SET
      address     = '770 Lighthouse Dr, Unit 192B, Barnegat, NJ 08005',
      phone       = '(609) 879-0036',
      fax         = '(609) 879-0039',
      email       = 'barnegat@thenudental.com',
      website     = 'https://www.thenudentalbarnegat.com/',
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = barnegat_id;
  ELSE
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (
      gen_random_uuid(),
      'Nu Dental of Barnegat',
      '770 Lighthouse Dr, Unit 192B, Barnegat, NJ 08005',
      '(609) 879-0036',
      '(609) 879-0039',
      'barnegat@thenudental.com',
      'https://www.thenudentalbarnegat.com/',
      true
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Staten Island
  SELECT id INTO statenisland_id FROM public.offices WHERE name ILIKE '%staten%' LIMIT 1;
  IF statenisland_id IS NOT NULL THEN
    UPDATE public.offices SET
      address     = '76 Pond St, Staten Island, NY 10309',
      phone       = '(718) 568-0405',
      fax         = '(718) 568-0366',
      email       = 'statenisland@thenudental.com',
      website     = 'https://www.thenudentalsi.com/',
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = statenisland_id;
  ELSE
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (
      gen_random_uuid(),
      'Nu Dental of Staten Island',
      '76 Pond St, Staten Island, NY 10309',
      '(718) 568-0405',
      '(718) 568-0366',
      'statenisland@thenudental.com',
      'https://www.thenudentalsi.com/',
      true
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Offices seed failed: %', SQLERRM;
END $$;
