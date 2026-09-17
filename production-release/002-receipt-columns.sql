-- Production adaptation of QA repair 030. Historical quantity/time stays unknown.
-- No business-row backfill; defaults apply only to future inserts.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.supply_fulfillment_logs
  ADD COLUMN IF NOT EXISTS qty_received integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.supply_fulfillment_logs
  ALTER COLUMN qty_received SET DEFAULT 0,
  ALTER COLUMN updated_at SET DEFAULT now();
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.supply_fulfillment_logs'::regclass
                 AND conname='supply_fulfillment_logs_qty_received_nonnegative') THEN
    ALTER TABLE public.supply_fulfillment_logs
      ADD CONSTRAINT supply_fulfillment_logs_qty_received_nonnegative CHECK(qty_received>=0);
  END IF;
END;
$constraint$;
COMMIT;
