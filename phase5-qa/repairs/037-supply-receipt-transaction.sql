-- PH5-SUPPLY-017: apply receipt totals and linked stock atomically, once.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Receipt transaction requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.receive_supply_receipt(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_log public.supply_fulfillment_logs%ROWTYPE;
  v_stock public.office_supply_inventory%ROWTYPE;
  v_request public.supply_request_items%ROWTYPE;
  v_qty integer;
  v_delta integer;
  v_date date;
  v_changed integer := 0;
  v_unchanged integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.dashboard_has_active_profile()
     OR NOT public.is_supply_admin_or_above() THEN
    RAISE EXCEPTION 'Supply receipt write permission required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Receipt object and item array required' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 100
     OR (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_payload->'items'))
        <> jsonb_array_length(p_payload->'items') THEN
    RAISE EXCEPTION 'One to 100 distinct receipt records required' USING ERRCODE='22023';
  END IF;
  v_date := coalesce(nullif(p_payload->>'date_received','')::date,current_date);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') ORDER BY value->>'id' LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR coalesce(v_item->>'received_qty','') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'A whole received quantity is required' USING ERRCODE='22023';
    END IF;
    v_qty := (v_item->>'received_qty')::integer;
    IF v_qty<=0 THEN RAISE EXCEPTION 'Received quantity must be positive' USING ERRCODE='22023'; END IF;
    SELECT * INTO v_log FROM public.supply_fulfillment_logs
      WHERE id=(v_item->>'id')::uuid FOR UPDATE;
    IF NOT FOUND OR v_log.office_id IS DISTINCT FROM p_payload->>'office_id' THEN
      RAISE EXCEPTION 'Receipt record unavailable for this office or account' USING ERRCODE='42501';
    END IF;
    IF v_log.log_fulfillment_status='cancelled' THEN
      RAISE EXCEPTION 'Cancelled receipts cannot be received' USING ERRCODE='22023';
    END IF;
    v_delta := v_qty-coalesce(v_log.qty_received,0);
    IF v_delta=0 THEN v_unchanged:=v_unchanged+1; CONTINUE; END IF;
    IF v_delta<0 OR v_log.log_fulfillment_status='completed' THEN
      RAISE EXCEPTION 'Receipt total changed or is already complete; refresh before continuing' USING ERRCODE='22023';
    END IF;

    -- Stored links and quantities are authoritative; ignore client-supplied links.
    IF v_log.item_id IS NOT NULL THEN
      SELECT * INTO STRICT v_stock FROM public.office_supply_inventory
        WHERE item_id=v_log.item_id AND office_id=v_log.office_id FOR UPDATE;
      UPDATE public.office_supply_inventory SET
        quantity_on_hand=coalesce(v_stock.quantity_on_hand,0)+v_delta,
        last_supplied_date=v_date,last_supplied_quantity=v_delta,
        last_updated_by=v_actor,updated_at=now() WHERE id=v_stock.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Linked stock update denied' USING ERRCODE='42501'; END IF;
      INSERT INTO public.supply_inventory_history
        (inventory_id,office_id,change_type,old_qty,new_qty,change_qty,changed_by,change_reason)
      VALUES (v_stock.id,v_log.office_id,'supplied',coalesce(v_stock.quantity_on_hand,0),
        coalesce(v_stock.quantity_on_hand,0)+v_delta,v_delta,v_actor,'Received: '||v_log.item_name);
    END IF;
    IF v_log.request_item_id IS NOT NULL THEN
      SELECT i.* INTO STRICT v_request FROM public.supply_request_items i
        JOIN public.supply_request_batches b ON b.id=i.batch_id
        WHERE i.id=v_log.request_item_id AND b.office_id=v_log.office_id FOR UPDATE OF i;
      UPDATE public.supply_request_items SET
        fulfilled_qty=coalesce(v_request.fulfilled_qty,0)+v_delta,
        item_status=CASE WHEN coalesce(v_request.fulfilled_qty,0)+v_delta>=v_request.requested_qty
          THEN 'fulfilled'::public.supply_request_item_status ELSE 'partially_fulfilled'::public.supply_request_item_status END
        WHERE id=v_request.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Linked request update denied' USING ERRCODE='42501'; END IF;
    END IF;
    UPDATE public.supply_fulfillment_logs SET qty_received=v_qty,date_received=v_date,
      received_by=v_actor,tracking_notes=nullif(p_payload->>'notes',''),updated_at=now(),
      log_fulfillment_status=CASE WHEN v_qty>=coalesce(v_log.qty_supplied,0)
        THEN 'completed'::public.fulfillment_status ELSE 'partial'::public.fulfillment_status END
      WHERE id=v_log.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt update denied' USING ERRCODE='42501'; END IF;
    v_changed:=v_changed+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'updated_items',v_changed,'unchanged_items',v_unchanged);
END;
$fn$;
REVOKE ALL ON FUNCTION public.receive_supply_receipt(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_supply_receipt(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
