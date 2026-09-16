-- PH5-SUPPLY-006: persist the fields used by the existing manual receipt handler.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Receipt column repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
ALTER TABLE public.supply_fulfillment_logs
  ADD COLUMN qty_received integer NOT NULL DEFAULT 0 CHECK (qty_received>=0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
COMMIT;
