-- PH5-QA-SUPPLY-007: the copied Front Desk enum rejects synthetic QA offices.
-- Extend only the isolated QA enum and keep both dependent tables QA-only.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Synthetic Front Desk offices require isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
ALTER TYPE public.front_desk_office_location ADD VALUE 'QA / Office A';
ALTER TYPE public.front_desk_office_location ADD VALUE 'QA / Office B';
ALTER TABLE public.front_desk_inventory
  ADD CONSTRAINT front_desk_inventory_qa_office
  CHECK (office_location::text IN ('QA / Office A', 'QA / Office B'));
ALTER TABLE public.front_desk_amazon_orders
  ADD CONSTRAINT front_desk_amazon_orders_qa_office
  CHECK (office_location::text IN ('QA / Office A', 'QA / Office B'));
COMMIT;
