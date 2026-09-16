-- PH5-QA-SUPPLY-002: copied supply constraints contain production office names.
-- In isolated QA only, retain the same two-office validation for synthetic data.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Synthetic supply offices require isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
ALTER TABLE public.office_supply_inventory DROP CONSTRAINT chk_osi_office_id,
  ADD CONSTRAINT chk_osi_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.order_requests DROP CONSTRAINT chk_order_requests_office_name,
  ADD CONSTRAINT chk_order_requests_office_name CHECK (office_name IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.supply_fulfillment_logs DROP CONSTRAINT chk_sfl_office_id,
  ADD CONSTRAINT chk_sfl_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.supply_inventory_history DROP CONSTRAINT chk_sih_office_id,
  ADD CONSTRAINT chk_sih_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.supply_request_batches DROP CONSTRAINT chk_srb_office_id,
  ADD CONSTRAINT chk_srb_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.supply_request_items DROP CONSTRAINT chk_sri_office_id,
  ADD CONSTRAINT chk_sri_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.urgent_supply_requests DROP CONSTRAINT chk_usr_office_id,
  ADD CONSTRAINT chk_usr_office_id CHECK (office_id IN ('QA / Office A', 'QA / Office B'));
COMMIT;
