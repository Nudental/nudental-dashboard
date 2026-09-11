-- Migration: Add office_id to back_staff_orders and seed 27 Back Staff Orders / Expenses
-- Inserts 27 items × 4 offices (108 rows) into back_staff_orders AND cost_drivers
-- Uses ON CONFLICT DO NOTHING for idempotency

-- 1. Add office_id column to back_staff_orders (nullable FK)
ALTER TABLE public.back_staff_orders
    ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_back_staff_orders_office_id ON public.back_staff_orders(office_id);

-- 2. Seed 27 Back Staff Orders / Expenses per office into back_staff_orders AND cost_drivers
DO $$
DECLARE
    brick_id       UUID;
    barnegat_id    UUID;
    eatontown_id   UUID;
    staten_id      UUID;
BEGIN
    -- Resolve office IDs by name
    SELECT id INTO brick_id       FROM public.offices WHERE name = 'Nu Dental of Brick'          LIMIT 1;
    SELECT id INTO barnegat_id    FROM public.offices WHERE name = 'Nu Dental of Barnegat'       LIMIT 1;
    SELECT id INTO eatontown_id   FROM public.offices WHERE name = 'Nu Dental of Eatontown'      LIMIT 1;
    SELECT id INTO staten_id      FROM public.offices WHERE name = 'Nu Dental of Staten Island'  LIMIT 1;

    -- =========================================================
    -- Nu Dental of Brick
    -- =========================================================
    IF brick_id IS NOT NULL THEN
        -- back_staff_orders
        INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', brick_id, true)
        ON CONFLICT DO NOTHING;

        -- cost_drivers
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', brick_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', brick_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================
    -- Nu Dental of Barnegat
    -- =========================================================
    IF barnegat_id IS NOT NULL THEN
        -- back_staff_orders
        INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', barnegat_id, true)
        ON CONFLICT DO NOTHING;

        -- cost_drivers
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', barnegat_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', barnegat_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================
    -- Nu Dental of Eatontown
    -- =========================================================
    IF eatontown_id IS NOT NULL THEN
        -- back_staff_orders
        INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', eatontown_id, true)
        ON CONFLICT DO NOTHING;

        -- cost_drivers
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', eatontown_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', eatontown_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================
    -- Nu Dental of Staten Island
    -- =========================================================
    IF staten_id IS NOT NULL THEN
        -- back_staff_orders
        INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', staten_id, true)
        ON CONFLICT DO NOTHING;

        -- cost_drivers
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Amazon',                      'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dental Laboratory Group',     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'CSI',                         'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Arestin',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Botox',                       'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Rent',                        'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'CAM and Tax Charge',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Citi Waste',                  'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Comcast',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Crest Oral-B Order',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'DentalSearch',                'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dollar Store',                'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Dues and Subscriptions',      'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'EZ Pass',                     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Rx',             'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Edge Endo',                   'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Electric',                    'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Order',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Weave Subscription',          'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Fire Prevention',             'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Gas',                         'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Got Print',                   'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Gusto Workers Compensation',  'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'HealthFirst',                 'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein One Ascend',     'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Henry Schein Supplies',       'Back Staff Orders / Expenses', staten_id, true),
            (gen_random_uuid(), 'Indeed',                      'Back Staff Orders / Expenses', staten_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Back Staff Orders / Expenses seed error: %', SQLERRM;
END $$;
