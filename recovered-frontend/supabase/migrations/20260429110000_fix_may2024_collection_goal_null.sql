-- Migration: Fix May 2024 collection_goal to NULL
-- April 2024 production goals do not exist in this dataset.
-- Per spec: May 2024 collection_goal must be NULL (not 0) so the frontend
-- can display "N/A" instead of treating it as a failed $0 goal.
-- Timestamp: 20260429110000

UPDATE public.office_goals
SET
  collections_goal = NULL,
  updated_at       = CURRENT_TIMESTAMP
WHERE month_year = '2024-05';

-- Verify: the following should return 4 rows with collections_goal = NULL
-- SELECT office_id, month_year, production_goal, collections_goal
-- FROM public.office_goals
-- WHERE month_year = '2024-05'
-- ORDER BY office_id;
