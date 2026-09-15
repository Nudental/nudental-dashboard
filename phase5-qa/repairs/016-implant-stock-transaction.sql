-- PH5-IMPLANT-005: reject insufficient stock within the usage insert transaction.
-- Existing one-unit-per-usage schema, roles, and linked-office guard are retained.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Implant stock transaction requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;
CREATE OR REPLACE FUNCTION public.implant_auto_deduct_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.item_status = 'used' AND NEW.implant_inventory_id IS NOT NULL THEN
    UPDATE public.implant_inventory
    SET quantity_in_stock = quantity_in_stock - 1,
        item_status = CASE WHEN quantity_in_stock = 1
          THEN 'used'::public.implant_inventory_status ELSE item_status END,
        updated_at = now()
    WHERE id = NEW.implant_inventory_id
      AND item_status = 'in_stock' AND quantity_in_stock >= 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient in-stock inventory; usage was not saved' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMIT;
