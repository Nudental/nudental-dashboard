-- Migration: Update huddle_provider_blocks to support 6 blocks
-- Block 1-3: Doctor, Block 4-6: Hygienist

-- 1. Drop the old check constraint that only allows block_order IN (1,2,3)
ALTER TABLE public.huddle_provider_blocks
  DROP CONSTRAINT IF EXISTS huddle_provider_blocks_block_order_check;

-- 2. Add new check constraint allowing 1-6
ALTER TABLE public.huddle_provider_blocks
  ADD CONSTRAINT huddle_provider_blocks_block_order_check
  CHECK (block_order IN (1, 2, 3, 4, 5, 6));

-- 3. For any existing huddles that only have 3 blocks, insert blocks 4-6
-- This is done via a DO block to handle idempotency
DO $$
DECLARE
  h RECORD;
BEGIN
  FOR h IN SELECT id FROM public.huddles LOOP
    -- Insert block 4 (hygienist) if missing
    IF NOT EXISTS (
      SELECT 1 FROM public.huddle_provider_blocks
      WHERE huddle_id = h.id AND block_order = 4
    ) THEN
      INSERT INTO public.huddle_provider_blocks
        (huddle_id, block_order, block_type, provider_name, monthly_goal, monthly_actual, daily_goal, scheduled_today)
      VALUES
        (h.id, 4, 'hygienist', '', 0, 0, 0, 0);
    END IF;

    -- Insert block 5 (hygienist) if missing
    IF NOT EXISTS (
      SELECT 1 FROM public.huddle_provider_blocks
      WHERE huddle_id = h.id AND block_order = 5
    ) THEN
      INSERT INTO public.huddle_provider_blocks
        (huddle_id, block_order, block_type, provider_name, monthly_goal, monthly_actual, daily_goal, scheduled_today)
      VALUES
        (h.id, 5, 'hygienist', '', 0, 0, 0, 0);
    END IF;

    -- Insert block 6 (hygienist) if missing
    IF NOT EXISTS (
      SELECT 1 FROM public.huddle_provider_blocks
      WHERE huddle_id = h.id AND block_order = 6
    ) THEN
      INSERT INTO public.huddle_provider_blocks
        (huddle_id, block_order, block_type, provider_name, monthly_goal, monthly_actual, daily_goal, scheduled_today)
      VALUES
        (h.id, 6, 'hygienist', '', 0, 0, 0, 0);
    END IF;

    -- Also fix existing block 2 to be 'hygienist' if it was set as 'hygienist' already (no-op)
    -- Fix block 2 which was previously 'hygienist' — now block 2 should be 'doctor'
    UPDATE public.huddle_provider_blocks
      SET block_type = 'doctor'
      WHERE huddle_id = h.id AND block_order = 2;

  END LOOP;
END;
$$;
