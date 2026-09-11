-- ============================================================
-- Migration: Fix misclassified supply item department_category
-- Scope: DATA ONLY — no schema changes, no code changes
-- Target: 5 clinical items incorrectly tagged 'Front Desk'
--         due to broad keyword matching in initial seed migration
-- ============================================================

-- ============================================================
-- STEP 1: DRY-RUN — Show current state before any changes
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== DRY-RUN: Current department_category for 5 target items ===';
    RAISE NOTICE 'id | name | department_id | subsection_id | department_category';
    RAISE NOTICE '-------------------------------------------------------------------';

    FOR r IN
        SELECT
            si.id,
            si.name,
            si.department_id,
            si.subsection_id,
            si.department_category::TEXT AS department_category
        FROM public.supply_items si
        WHERE si.name IN (
            'Articulating Paper',
            'Paper Points',
            'Indicator Tape',
            'Teflon Tape',
            'Air/Water Syringe Tips'
        )
        ORDER BY si.name
    LOOP
        RAISE NOTICE 'id=% | name=% | dept=% | subsect=% | category=%',
            r.id, r.name, r.department_id, r.subsection_id, r.department_category;
    END LOOP;

    -- Report any duplicates
    FOR r IN
        SELECT si.name, COUNT(*) AS cnt
        FROM public.supply_items si
        WHERE si.name IN (
            'Articulating Paper',
            'Paper Points',
            'Indicator Tape',
            'Teflon Tape',
            'Air/Water Syringe Tips'
        )
        GROUP BY si.name
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'DUPLICATE DETECTED: name=% has % rows', r.name, r.cnt;
    END LOOP;

    -- Report any items NOT found
    IF NOT EXISTS (SELECT 1 FROM public.supply_items WHERE name = 'Articulating Paper') THEN
        RAISE NOTICE 'NOT FOUND: Articulating Paper';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.supply_items WHERE name = 'Paper Points') THEN
        RAISE NOTICE 'NOT FOUND: Paper Points';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.supply_items WHERE name = 'Indicator Tape') THEN
        RAISE NOTICE 'NOT FOUND: Indicator Tape';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.supply_items WHERE name = 'Teflon Tape') THEN
        RAISE NOTICE 'NOT FOUND: Teflon Tape';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.supply_items WHERE name = 'Air/Water Syringe Tips') THEN
        RAISE NOTICE 'NOT FOUND: Air/Water Syringe Tips — item may already be Back Staff or does not exist';
    END IF;
END $$;

-- ============================================================
-- STEP 2: UPDATE — Set department_category = 'Back Staff'
--         Only for exact name matches that are currently 'Front Desk'
--         No other columns are touched.
-- ============================================================

UPDATE public.supply_items
SET department_category = 'Back Staff'::public.supply_department_category
WHERE name = 'Articulating Paper'
  AND department_category = 'Front Desk'::public.supply_department_category;

UPDATE public.supply_items
SET department_category = 'Back Staff'::public.supply_department_category
WHERE name = 'Paper Points'
  AND department_category = 'Front Desk'::public.supply_department_category;

UPDATE public.supply_items
SET department_category = 'Back Staff'::public.supply_department_category
WHERE name = 'Indicator Tape'
  AND department_category = 'Front Desk'::public.supply_department_category;

UPDATE public.supply_items
SET department_category = 'Back Staff'::public.supply_department_category
WHERE name = 'Teflon Tape'
  AND department_category = 'Front Desk'::public.supply_department_category;

UPDATE public.supply_items
SET department_category = 'Back Staff'::public.supply_department_category
WHERE name = 'Air/Water Syringe Tips'
  AND department_category = 'Front Desk'::public.supply_department_category;

-- ============================================================
-- STEP 3: VERIFICATION — Confirm all 5 items are now Back Staff
-- ============================================================
DO $$
DECLARE
    r RECORD;
    updated_count INT := 0;
BEGIN
    RAISE NOTICE '=== VERIFICATION: department_category after update ===';
    RAISE NOTICE 'id | name | department_category';
    RAISE NOTICE '----------------------------------------------';

    FOR r IN
        SELECT
            si.id,
            si.name,
            si.department_category::TEXT AS department_category
        FROM public.supply_items si
        WHERE si.name IN (
            'Articulating Paper',
            'Paper Points',
            'Indicator Tape',
            'Teflon Tape',
            'Air/Water Syringe Tips'
        )
        ORDER BY si.name
    LOOP
        RAISE NOTICE 'id=% | name=% | category=%',
            r.id, r.name, r.department_category;

        IF r.department_category = 'Back Staff' THEN
            updated_count := updated_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '--- %/5 items confirmed as Back Staff ---', updated_count;

    IF updated_count < 5 THEN
        RAISE NOTICE 'WARNING: Not all 5 items are Back Staff. Check for missing or already-correct items above.';
    ELSE
        RAISE NOTICE 'SUCCESS: All 5 items are now department_category = Back Staff';
    END IF;

    RAISE NOTICE '=== No schema changes. No code changes. No request history modified. ===';
END $$;
