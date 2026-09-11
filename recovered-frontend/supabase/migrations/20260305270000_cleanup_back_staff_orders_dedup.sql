-- Migration: Deduplicate back_staff_orders and cost_drivers, assign office_id to NULL rows
-- 1) Remove duplicates keeping only MIN(id::text) per (name, office_id)
-- 2) For rows with NULL office_id, insert one row per office (4 offices)

DO $$
DECLARE
    brick_id       UUID;
    barnegat_id    UUID;
    eatontown_id   UUID;
    staten_id      UUID;
    r              RECORD;
BEGIN
    -- Resolve office IDs
    SELECT id INTO brick_id       FROM public.offices WHERE name = 'Nu Dental of Brick'         LIMIT 1;
    SELECT id INTO barnegat_id    FROM public.offices WHERE name = 'Nu Dental of Barnegat'      LIMIT 1;
    SELECT id INTO eatontown_id   FROM public.offices WHERE name = 'Nu Dental of Eatontown'     LIMIT 1;
    SELECT id INTO staten_id      FROM public.offices WHERE name = 'Nu Dental of Staten Island' LIMIT 1;

    -- ================================================================
    -- STEP 1: Deduplicate back_staff_orders
    -- Keep only the row with MIN(id::text) per (name, office_id)
    -- ================================================================
    DELETE FROM public.back_staff_orders
    WHERE id NOT IN (
        SELECT MIN(id::text)::uuid
        FROM public.back_staff_orders
        GROUP BY name, office_id
    );

    -- ================================================================
    -- STEP 2: Deduplicate cost_drivers
    -- Keep only the row with MIN(id::text) per (name, office_id)
    -- ================================================================
    DELETE FROM public.cost_drivers
    WHERE id NOT IN (
        SELECT MIN(id::text)::uuid
        FROM public.cost_drivers
        GROUP BY name, office_id
    );

    -- ================================================================
    -- STEP 3: For back_staff_orders rows with NULL office_id,
    -- insert one row per office (4 offices) then delete the NULL row
    -- ================================================================
    FOR r IN
        SELECT DISTINCT name, category, is_active
        FROM public.back_staff_orders
        WHERE office_id IS NULL
    LOOP
        -- Insert for each office if not already present
        IF brick_id IS NOT NULL THEN
            INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, brick_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF barnegat_id IS NOT NULL THEN
            INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, barnegat_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF eatontown_id IS NOT NULL THEN
            INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, eatontown_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF staten_id IS NOT NULL THEN
            INSERT INTO public.back_staff_orders (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, staten_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Delete the NULL office_id rows from back_staff_orders
    DELETE FROM public.back_staff_orders WHERE office_id IS NULL;

    -- ================================================================
    -- STEP 4: For cost_drivers rows with NULL office_id,
    -- insert one row per office (4 offices) then delete the NULL row
    -- ================================================================
    FOR r IN
        SELECT DISTINCT name, category, is_active
        FROM public.cost_drivers
        WHERE office_id IS NULL
    LOOP
        IF brick_id IS NOT NULL THEN
            INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, brick_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF barnegat_id IS NOT NULL THEN
            INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, barnegat_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF eatontown_id IS NOT NULL THEN
            INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, eatontown_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
        IF staten_id IS NOT NULL THEN
            INSERT INTO public.cost_drivers (id, name, category, office_id, is_active)
            VALUES (gen_random_uuid(), r.name, r.category, staten_id, r.is_active)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Delete the NULL office_id rows from cost_drivers
    DELETE FROM public.cost_drivers WHERE office_id IS NULL;

    -- ================================================================
    -- STEP 5: Final dedup pass after inserts
    -- ================================================================
    DELETE FROM public.back_staff_orders
    WHERE id NOT IN (
        SELECT MIN(id::text)::uuid
        FROM public.back_staff_orders
        GROUP BY name, office_id
    );

    DELETE FROM public.cost_drivers
    WHERE id NOT IN (
        SELECT MIN(id::text)::uuid
        FROM public.cost_drivers
        GROUP BY name, office_id
    );

END $$;
