-- Promotes QA repair 016 without QA infrastructure. No existing rows are updated.
-- Existing trigger, SECURITY DEFINER privilege, and one-unit usage model retained.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
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
