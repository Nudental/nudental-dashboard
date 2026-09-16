-- PH5-AUDIT-011: record initial stock atomically; existing adjustment logging remains.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Initial clinical stock history requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION dashboard_qa.audit_initial_supply_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  INSERT INTO public.supply_inventory_history
    (inventory_id,office_id,change_type,old_qty,new_qty,change_qty,changed_by,change_reason)
  VALUES (NEW.id,NEW.office_id,'adjustment',0,coalesce(NEW.quantity_on_hand,0),
    coalesce(NEW.quantity_on_hand,0),auth.uid(),'Initial stock record');
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.audit_initial_supply_stock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_initial_supply_stock_history
AFTER INSERT ON public.office_supply_inventory
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.audit_initial_supply_stock();
COMMIT;
