-- Migration: Add office_id to cost_drivers and seed Payroll/Gusto entries
-- Adds office_id FK column and inserts 24 cost driver entries grouped under 'Payroll / Gusto'

-- 1. Add office_id column to cost_drivers (nullable FK)
ALTER TABLE public.cost_drivers
    ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cost_drivers_office_id ON public.cost_drivers(office_id);

-- 2. Seed 24 Payroll / Gusto cost driver entries per office
DO $$
DECLARE
    brick_id       UUID;
    barnegat_id    UUID;
    eatontown_id   UUID;
    staten_id      UUID;
BEGIN
    -- Resolve office IDs by name
    SELECT id INTO brick_id       FROM public.offices WHERE name = 'Nu Dental of Brick'         LIMIT 1;
    SELECT id INTO barnegat_id    FROM public.offices WHERE name = 'Nu Dental of Barnegat'      LIMIT 1;
    SELECT id INTO eatontown_id   FROM public.offices WHERE name = 'Nu Dental of Eatontown'     LIMIT 1;
    SELECT id INTO staten_id      FROM public.offices WHERE name = 'Nu Dental of Staten Island'  LIMIT 1;

    -- Nu Dental of Brick
    IF brick_id IS NOT NULL THEN
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Gusto Payroll',                'Payroll / Gusto', brick_id, true),
            (gen_random_uuid(), 'Gusto Payroll Tax',            'Payroll / Gusto', brick_id, true),
            (gen_random_uuid(), 'Gusto Payroll Reimbursements', 'Payroll / Gusto', brick_id, true),
            (gen_random_uuid(), 'Gusto Payroll Individuals',    'Payroll / Gusto', brick_id, true),
            (gen_random_uuid(), 'Gusto Invoice',                'Payroll / Gusto', brick_id, true),
            (gen_random_uuid(), 'Payroll Total',                'Payroll / Gusto', brick_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Nu Dental of Barnegat
    IF barnegat_id IS NOT NULL THEN
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Gusto Payroll',                'Payroll / Gusto', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Payroll Tax',            'Payroll / Gusto', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Payroll Reimbursements', 'Payroll / Gusto', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Payroll Individuals',    'Payroll / Gusto', barnegat_id, true),
            (gen_random_uuid(), 'Gusto Invoice',                'Payroll / Gusto', barnegat_id, true),
            (gen_random_uuid(), 'Payroll Total',                'Payroll / Gusto', barnegat_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Nu Dental of Eatontown
    IF eatontown_id IS NOT NULL THEN
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Gusto Payroll',                'Payroll / Gusto', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Payroll Tax',            'Payroll / Gusto', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Payroll Reimbursements', 'Payroll / Gusto', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Payroll Individuals',    'Payroll / Gusto', eatontown_id, true),
            (gen_random_uuid(), 'Gusto Invoice',                'Payroll / Gusto', eatontown_id, true),
            (gen_random_uuid(), 'Payroll Total',                'Payroll / Gusto', eatontown_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Nu Dental of Staten Island
    IF staten_id IS NOT NULL THEN
        INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
        VALUES
            (gen_random_uuid(), 'Gusto Payroll',                'Payroll / Gusto', staten_id, true),
            (gen_random_uuid(), 'Gusto Payroll Tax',            'Payroll / Gusto', staten_id, true),
            (gen_random_uuid(), 'Gusto Payroll Reimbursements', 'Payroll / Gusto', staten_id, true),
            (gen_random_uuid(), 'Gusto Payroll Individuals',    'Payroll / Gusto', staten_id, true),
            (gen_random_uuid(), 'Gusto Invoice',                'Payroll / Gusto', staten_id, true),
            (gen_random_uuid(), 'Payroll Total',                'Payroll / Gusto', staten_id, true)
        ON CONFLICT DO NOTHING;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Payroll/Gusto seed error: %', SQLERRM;
END $$;
