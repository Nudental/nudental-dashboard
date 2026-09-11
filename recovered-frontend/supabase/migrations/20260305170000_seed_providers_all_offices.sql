-- Migration: Seed providers (doctors & hygienists) across all 4 Nu Dental offices
-- Adds 8 doctors + 12 hygienists to each of the 4 offices (80 rows total)
-- Uses ON CONFLICT DO NOTHING to be fully idempotent

-- 1. Create a unique index on (name, provider_type, office_id) to support ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_name_type_office
  ON public.providers (name, provider_type, office_id);

-- 2. Seed providers for all offices
DO $$
DECLARE
  eatontown_id   UUID;
  brick_id       UUID;
  barnegat_id    UUID;
  statenisland_id UUID;
BEGIN
  -- Resolve office IDs
  SELECT id INTO eatontown_id    FROM public.offices WHERE name ILIKE '%eatontown%'    LIMIT 1;
  SELECT id INTO brick_id        FROM public.offices WHERE name ILIKE '%brick%'         LIMIT 1;
  SELECT id INTO barnegat_id     FROM public.offices WHERE name ILIKE '%barnegat%'      LIMIT 1;
  SELECT id INTO statenisland_id FROM public.offices WHERE name ILIKE '%staten%'        LIMIT 1;

  -- If offices do not exist yet, insert them so providers can reference them
  IF eatontown_id IS NULL THEN
    eatontown_id := gen_random_uuid();
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (eatontown_id, 'Nu Dental of Eatontown', '178 NJ-35, Unit 6, Eatontown, NJ 07724',
            '(732) 945-7999', '(732) 945-7999', 'eatontown@thenudental.com',
            'https://www.thenudental.com/', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF brick_id IS NULL THEN
    brick_id := gen_random_uuid();
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (brick_id, 'Nu Dental of Brick', '1683 NJ-88, Ste C, Brick Township, NJ',
            '(732) 475-7535', '(732) 534-3205', 'brick@thenudental.com',
            'https://www.thebrickdentalcare.com/', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF barnegat_id IS NULL THEN
    barnegat_id := gen_random_uuid();
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (barnegat_id, 'Nu Dental of Barnegat', '770 Lighthouse Dr, Unit 192B, Barnegat, NJ 08005',
            '(609) 879-0036', '(609) 879-0039', 'barnegat@thenudental.com',
            'https://www.thenudentalbarnegat.com/', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF statenisland_id IS NULL THEN
    statenisland_id := gen_random_uuid();
    INSERT INTO public.offices (id, name, address, phone, fax, email, website, is_active)
    VALUES (statenisland_id, 'Nu Dental of Staten Island', '76 Pond St, Staten Island, NY 10309',
            '(718) 568-0405', '(718) 568-0366', 'statenisland@thenudental.com',
            'https://www.thenudentalsi.com/', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ----------------------------------------------------------------
  -- DOCTORS  (provider_type = 'doctor') for all 4 offices
  -- ----------------------------------------------------------------
  INSERT INTO public.providers (id, name, provider_type, office_id, is_active)
  SELECT gen_random_uuid(), p.name, 'doctor'::public.provider_type, o.office_id, true
  FROM (
    VALUES
      ('Dr. Admasu Gizachew'),
      ('Dr. Alan Schwartz'),
      ('Dr. Glenn Marie'),
      ('Dr. Amtul Siddiqui'),
      ('Dr. Norman Margolies'),
      ('Dr. Jeffrey C Rigby'),
      ('Dr. Mark Henin'),
      ('Dr. John Fitzpatrick')
  ) AS p(name)
  CROSS JOIN (
    VALUES
      (eatontown_id),
      (brick_id),
      (barnegat_id),
      (statenisland_id)
  ) AS o(office_id)
  WHERE o.office_id IS NOT NULL
  ON CONFLICT (name, provider_type, office_id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- HYGIENISTS  (provider_type = 'hygienist') for all 4 offices
  -- ----------------------------------------------------------------
  INSERT INTO public.providers (id, name, provider_type, office_id, is_active)
  SELECT gen_random_uuid(), p.name, 'hygienist'::public.provider_type, o.office_id, true
  FROM (
    VALUES
      ('Sheryl Dubman'),
      ('Tracy Bushman'),
      ('Rawan Abuzahrieh'),
      ('Christina Schembari'),
      ('Kat Soto'),
      ('Tamara Clark'),
      ('Crystal Sullivan'),
      ('Aleasha Rainey'),
      ('Brick Temp Hygiene'),
      ('Eatontown Temp Hygiene'),
      ('Barnegat Temp Hygiene'),
      ('Staten Island Temp Hygiene')
  ) AS p(name)
  CROSS JOIN (
    VALUES
      (eatontown_id),
      (brick_id),
      (barnegat_id),
      (statenisland_id)
  ) AS o(office_id)
  WHERE o.office_id IS NOT NULL
  ON CONFLICT (name, provider_type, office_id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Provider seed failed: %', SQLERRM;
END $$;
