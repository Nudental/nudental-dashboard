-- Migration: Deduplicate office entries and add unique constraint
-- Strategy: Keep MIN(id::text)::uuid as canonical for ALL duplicates, reassign all FK references, delete duplicates
-- Timestamp: 20260306170000

DO $$
DECLARE
    rec RECORD;
    canonical_id UUID;
    dup_id UUID;
BEGIN

  -- ============================================================
  -- STEP 1: Identify ALL duplicates (not just hardcoded names)
  -- ============================================================
  FOR rec IN
    SELECT
      LOWER(TRIM(name)) AS norm_name,
      MIN(id::text)::uuid AS keep_id,
      ARRAY_AGG(id ORDER BY id::text) AS all_ids
    FROM public.offices
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  LOOP
    canonical_id := rec.keep_id;
    RAISE NOTICE 'Processing office "%": keeping id=%, duplicates=%',
      rec.norm_name, canonical_id, rec.all_ids;

    -- Iterate over every duplicate (all IDs except the canonical one)
    FOREACH dup_id IN ARRAY rec.all_ids
    LOOP
      CONTINUE WHEN dup_id = canonical_id;

      RAISE NOTICE '  Reassigning duplicate id=% -> canonical id=%', dup_id, canonical_id;

      -- ============================================================
      -- STEP 2: Reassign all FK references from dup_id -> canonical_id
      -- ============================================================

      -- providers
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'providers' AND column_name = 'office_id'
      ) THEN
        UPDATE public.providers SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    providers: updated';
      END IF;

      -- user_office_assignments
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_office_assignments' AND column_name = 'office_id'
      ) THEN
        UPDATE public.user_office_assignments SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    user_office_assignments: updated';
      END IF;

      -- daily_entries
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'daily_entries' AND column_name = 'office_id'
      ) THEN
        UPDATE public.daily_entries SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    daily_entries: updated';
      END IF;

      -- revenue_entries
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'revenue_entries' AND column_name = 'office_id'
      ) THEN
        UPDATE public.revenue_entries SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    revenue_entries: updated';
      END IF;

      -- expense_entries
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'expense_entries' AND column_name = 'office_id'
      ) THEN
        UPDATE public.expense_entries SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    expense_entries: updated';
      END IF;

      -- cost_drivers
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cost_drivers' AND column_name = 'office_id'
      ) THEN
        UPDATE public.cost_drivers SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    cost_drivers: updated';
      END IF;

      -- back_staff_orders
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'back_staff_orders' AND column_name = 'office_id'
      ) THEN
        UPDATE public.back_staff_orders SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    back_staff_orders: updated';
      END IF;

      -- huddles: delete conflicting rows first to avoid unique constraint on (office_id, huddle_date)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'huddles' AND column_name = 'office_id'
      ) THEN
        -- Delete huddle rows under dup_id where a huddle for the same huddle_date already exists under canonical_id
        DELETE FROM public.huddles h_dup
        WHERE h_dup.office_id = dup_id
          AND EXISTS (
            SELECT 1 FROM public.huddles h_canon
            WHERE h_canon.office_id = canonical_id
              AND h_canon.huddle_date = h_dup.huddle_date
          );
        RAISE NOTICE '    huddles: removed conflicting duplicates';
        -- Now safely reassign remaining huddle rows
        UPDATE public.huddles SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    huddles: updated';
      END IF;

      -- office_goals
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'office_goals' AND column_name = 'office_id'
      ) THEN
        UPDATE public.office_goals SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    office_goals: updated';
      END IF;

      -- goal_achievement_history
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'goal_achievement_history' AND column_name = 'office_id'
      ) THEN
        UPDATE public.goal_achievement_history SET office_id = canonical_id WHERE office_id = dup_id;
        RAISE NOTICE '    goal_achievement_history: updated';
      END IF;

      -- ============================================================
      -- STEP 3: Delete the duplicate office row
      -- ============================================================
      DELETE FROM public.offices WHERE id = dup_id;
      RAISE NOTICE '  Deleted duplicate office id=%', dup_id;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Deduplication complete.';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Deduplication failed: %', SQLERRM;
END $$;

-- ============================================================
-- STEP 4: Add UNIQUE index on normalized name to prevent
--         future duplicates (case-insensitive, trimmed)
-- ============================================================
DROP INDEX IF EXISTS idx_offices_unique_lower_name;
CREATE UNIQUE INDEX idx_offices_unique_lower_name
  ON public.offices (LOWER(TRIM(name)));
