-- Migration: Reseed office production goals (May 2024 – Dec 2026)
-- Collection goal = 95% of previous month's production goal per office
-- Unique key: office_id + month_year (YYYY-MM text)
-- Timestamp: 20260429100000

-- ─── Ensure unique constraint exists on office_id + month_year ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'office_goals'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'office_goals_office_id_month_year_key'
  ) THEN
    ALTER TABLE public.office_goals
      ADD CONSTRAINT office_goals_office_id_month_year_key UNIQUE (office_id, month_year);
  END IF;
END $$;

-- ─── Upsert production goals ─────────────────────────────────────────────────
-- Office UUIDs:
--   Eatontown    : 220372a5-afae-49c9-8a0c-f4c0717ff352
--   Brick        : 54626997-57c2-4934-8743-1dabb4d176f4
--   Barnegat     : 1c719b5b-fd77-4da8-a1b9-2209f1cea63e
--   Staten Island: b0abcc46-55e8-4529-a28f-eedf41c1d72e

INSERT INTO public.office_goals
  (office_id, month_year, monthly_target, production_goal, collections_goal, new_patients_goal, updated_at)
VALUES
  -- ── May 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-05', 83000, 83000, 0, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-05', 85000, 85000, 0, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-05', 90000, 90000, 0, 0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-05', 10000, 10000, 0, 0, CURRENT_TIMESTAMP),
  -- ── Jun 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-06', 75000, 75000, 78850,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-06', 80000, 80000, 80750,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-06', 85000, 85000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-06',     0,     0,  9500,  0, CURRENT_TIMESTAMP),
  -- ── Jul 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-07', 75000, 75000, 71250,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-07', 80000, 80000, 76000,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-07', 87000, 87000, 80750,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-07', 13000, 13000,     0,  0, CURRENT_TIMESTAMP),
  -- ── Aug 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-08', 80000, 80000, 71250,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-08', 78000, 78000, 76000,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-08', 90000, 90000, 82650,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-08', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Sep 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-09', 80000, 80000, 76000,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-09', 78000, 78000, 74100,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-09', 90000, 90000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-09', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Oct 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-10', 80000, 80000, 76000,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-10', 78000, 78000, 74100,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-10', 90000, 90000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-10', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Nov 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-11', 80000, 80000, 76000,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-11', 78000, 78000, 74100,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-11', 90000, 90000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-11', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Dec 2024 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2024-12', 80000, 80000, 76000,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2024-12', 78000, 78000, 74100,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2024-12', 90000, 90000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2024-12', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Jan 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-01', 83334, 83334, 76000,  0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-01', 83334, 83334, 74100,  0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-01',100000,100000, 85500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-01', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Feb 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-02', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-02', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-02',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-02', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Mar 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-03', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-03', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-03',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-03', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Apr 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-04', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-04', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-04',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-04', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── May 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-05', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-05', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-05',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-05', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Jun 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-06', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-06', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-06',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-06', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Jul 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-07', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-07', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-07',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-07', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Aug 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-08', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-08', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-08',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-08', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Sep 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-09', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-09', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-09',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-09', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Oct 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-10', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-10', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-10',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-10', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Nov 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-11', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-11', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-11',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-11', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Dec 2025 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2025-12', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2025-12', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2025-12',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2025-12', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Jan 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-01', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-01', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-01',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-01', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Feb 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-02', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-02', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-02',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-02', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Mar 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-03', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-03', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-03',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-03', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Apr 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-04', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-04', 83334, 83334, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-04',100000,100000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-04', 13000, 13000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── May 2026 ──────────────────────────────────────────────────────────────
  -- collection_goal = 95% of Apr 2026 production_goal
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-05', 91668, 91668, 79167.30, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-05', 91668, 91668, 79167.30, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-05',110000,110000, 95000,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-05', 20000, 20000, 12350,  0, CURRENT_TIMESTAMP),
  -- ── Jun 2026 ──────────────────────────────────────────────────────────────
  -- collection_goal = 95% of May 2026 production_goal
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-06', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-06', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-06',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-06', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Jul 2026 ──────────────────────────────────────────────────────────────
  -- collection_goal = 95% of Jun 2026 production_goal
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-07', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-07', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-07',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-07', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Aug 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-08', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-08', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-08',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-08', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Sep 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-09', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-09', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-09',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-09', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Oct 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-10', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-10', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-10',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-10', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Nov 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-11', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-11', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-11',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-11', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP),
  -- ── Dec 2026 ──────────────────────────────────────────────────────────────
  ('220372a5-afae-49c9-8a0c-f4c0717ff352', '2026-12', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('54626997-57c2-4934-8743-1dabb4d176f4', '2026-12', 91668, 91668, 87084.60, 0, CURRENT_TIMESTAMP),
  ('1c719b5b-fd77-4da8-a1b9-2209f1cea63e', '2026-12',110000,110000,104500,  0, CURRENT_TIMESTAMP),
  ('b0abcc46-55e8-4529-a28f-eedf41c1d72e', '2026-12', 20000, 20000, 19000,  0, CURRENT_TIMESTAMP)
ON CONFLICT (office_id, month_year)
DO UPDATE SET
  monthly_target    = EXCLUDED.monthly_target,
  production_goal   = EXCLUDED.production_goal,
  collections_goal  = EXCLUDED.collections_goal,
  updated_at        = CURRENT_TIMESTAMP;

-- ─── NOTE on May 2024 collection_goal ────────────────────────────────────────
-- April 2024 production goals do not exist in this dataset.
-- Per the spec: if April 2024 production goal does not exist, leave May 2024
-- collection_goal as 0 (null/blank). No April 2024 numbers were invented.
-- May 2024 collection_goal is intentionally set to 0 for all offices.
