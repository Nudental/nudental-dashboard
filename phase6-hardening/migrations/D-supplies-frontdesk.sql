-- Phase 6 schema-only candidate, subject to QA and per-group release.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Existing production supply labels include this prefix; directory names do not.
-- Explicit aliases avoid fuzzy matching or any rewrite of business records.
CREATE OR REPLACE FUNCTION public.dashboard_supply_office_name(p_label text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog
AS $office$
 SELECT CASE p_label
  WHEN 'Nu Dental of Eatontown' THEN 'Eatontown'
  WHEN 'Nu Dental of Brick' THEN 'Brick'
  WHEN 'Nu Dental of Barnegat' THEN 'Barnegat'
  WHEN 'Nu Dental of Staten Island' THEN 'Staten Island'
  ELSE p_label END;
$office$;

-- Reviewed source repair 025-supply-request-access-boundary.sql
DROP POLICY IF EXISTS dashboard_supply_batch_access_boundary ON public.supply_request_batches;
CREATE POLICY dashboard_supply_batch_access_boundary
ON public.supply_request_batches AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(supply_request_batches.office_id) AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR (supply_request_batches.department_category='Front Desk'
      AND p.role IN ('admin','regional_manager') AND EXISTS (
        SELECT 1 FROM public.role_permissions review_grant WHERE review_grant.role=p.role::text
        AND review_grant.permission='workflow.approvals.view' AND review_grant.enabled=true
      )) OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission=CASE WHEN supply_request_batches.department_category='Front Desk'
        THEN 'resources.inventory.front_desk.view'
        ELSE 'resources.inventory.monthly_supply.view' END
      AND rp.enabled=true
    ))
  )
);

DROP POLICY IF EXISTS dashboard_supply_item_parent_boundary ON public.supply_request_items;
CREATE POLICY dashboard_supply_item_parent_boundary
ON public.supply_request_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_request_items.batch_id
));

-- Reviewer visibility must not grant request creation when its permission is false.
DROP POLICY IF EXISTS dashboard_supply_batch_create_permission ON public.supply_request_batches;
CREATE POLICY dashboard_supply_batch_create_permission ON public.supply_request_batches
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 requested_by=auth.uid() AND EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
  (p.role='super_admin' OR coalesce((SELECT rp.enabled FROM public.role_permissions rp
   WHERE rp.role=p.role::text AND rp.permission=CASE WHEN supply_request_batches.department_category='Front Desk'
    THEN 'request:front_desk_order' ELSE 'request:back_staff_order' END),p.role='admin'))
 )
);

-- Reviewed source repair 026-supply-draft-transaction.sql
CREATE OR REPLACE FUNCTION public.save_supply_request_draft(p_batch jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid := nullif(p_batch->>'id','')::uuid;
  v_before public.supply_request_batches%ROWTYPE;
  v_saved public.supply_request_batches%ROWTYPE;
  v_line public.supply_request_items%ROWTYPE;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_old_items jsonb := '[]'::jsonb;
  v_permission text;
BEGIN
  IF v_actor IS NULL OR NOT public.dashboard_has_active_profile() THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_batch) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Draft object and item array required' USING ERRCODE='22023';
  END IF;
  v_permission := CASE WHEN p_batch->>'department_category'='Front Desk'
    THEN 'request:front_desk_order' ELSE 'request:back_staff_order' END;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=v_actor AND
    (p.role='super_admin' OR coalesce((
      SELECT rp.enabled FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission=v_permission
    ), p.role='admin'))
  ) THEN
    RAISE EXCEPTION 'Supply request permission required' USING ERRCODE='42501';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    -- Only form-editable fields enter the row; identifiers and review state do not.
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'department_id', nullif(v_item->>'department_id','')::uuid,
      'subsection_id', nullif(v_item->>'subsection_id','')::uuid,
      'item_id', nullif(v_item->>'item_id','')::uuid,
      'custom_item_name', coalesce(v_item->>'custom_item_name',''),
      'current_qty_on_hand', coalesce((v_item->>'current_qty_on_hand')::integer,0),
      'requested_qty', coalesce((v_item->>'requested_qty')::integer,1),
      'unit_type', coalesce(v_item->>'unit_type','Each'),
      'priority', coalesce(v_item->>'priority','normal')::public.supply_request_priority,
      'reason_notes', coalesce(v_item->>'reason_notes',''),
      'preferred_vendor', coalesce(v_item->>'preferred_vendor','')
    ));
  END LOOP;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_before FROM public.supply_request_batches WHERE id=v_id FOR UPDATE;
    IF NOT FOUND OR (v_before.requested_by IS DISTINCT FROM v_actor
        AND NOT public.is_supply_admin_or_above()) THEN
      RAISE EXCEPTION 'Draft not editable by this account' USING ERRCODE='42501';
    END IF;
    IF v_before.batch_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Only drafts can be saved; refresh this request' USING ERRCODE='22023';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'department_id',i.department_id,'subsection_id',i.subsection_id,'item_id',i.item_id,
      'custom_item_name',coalesce(i.custom_item_name,''),
      'current_qty_on_hand',coalesce(i.current_qty_on_hand,0),'requested_qty',i.requested_qty,
      'unit_type',coalesce(i.unit_type,'Each'),'priority',coalesce(i.priority,'normal'),
      'reason_notes',coalesce(i.reason_notes,''),'preferred_vendor',coalesce(i.preferred_vendor,'')
    ) ORDER BY i.created_at,i.id),'[]'::jsonb) INTO v_old_items
    FROM public.supply_request_items i WHERE i.batch_id=v_id;
    IF v_before.office_id IS NOT DISTINCT FROM p_batch->>'office_id'
       AND v_before.request_month IS NOT DISTINCT FROM (p_batch->>'request_month')::date
       AND v_before.request_type IS NOT DISTINCT FROM coalesce(p_batch->>'request_type','monthly')
       AND v_before.department_category::text IS NOT DISTINCT FROM p_batch->>'department_category'
       AND (SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb)
            FROM jsonb_array_elements(v_old_items))
           = (SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb)
              FROM jsonb_array_elements(v_items)) THEN
      RETURN to_jsonb(v_before);
    END IF;
    UPDATE public.supply_request_batches SET office_id=p_batch->>'office_id',
      request_month=(p_batch->>'request_month')::date,
      request_type=coalesce(p_batch->>'request_type','monthly'),
      department_category=(p_batch->>'department_category')::public.supply_department_category,
      updated_at=now()
    WHERE id=v_id RETURNING * INTO v_saved;
    DELETE FROM public.supply_request_items WHERE batch_id=v_id;
  ELSE
    INSERT INTO public.supply_request_batches
      (office_id,request_month,request_type,department_category,requested_by,batch_status)
    VALUES (p_batch->>'office_id',(p_batch->>'request_month')::date,
      coalesce(p_batch->>'request_type','monthly'),
      (p_batch->>'department_category')::public.supply_department_category,v_actor,'draft')
    RETURNING * INTO v_saved;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_line := jsonb_populate_record(NULL::public.supply_request_items,v_item);
    INSERT INTO public.supply_request_items
      (batch_id,office_id,department_category,department_id,subsection_id,item_id,
       custom_item_name,current_qty_on_hand,requested_qty,unit_type,priority,reason_notes,preferred_vendor)
    VALUES (v_saved.id,v_saved.office_id,v_saved.department_category,v_line.department_id,
      v_line.subsection_id,v_line.item_id,v_line.custom_item_name,v_line.current_qty_on_hand,
      v_line.requested_qty,v_line.unit_type,v_line.priority,v_line.reason_notes,v_line.preferred_vendor);
  END LOOP;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (v_saved.id,'supply_request_batch',CASE WHEN v_id IS NULL THEN 'draft_created' ELSE 'draft_updated' END,
    v_actor,CASE WHEN v_id IS NULL THEN NULL ELSE jsonb_build_object('batch',to_jsonb(v_before),'items',v_old_items) END,
    jsonb_build_object('batch',to_jsonb(v_saved),'items',v_items));
  RETURN to_jsonb(v_saved);
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_supply_request_draft(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_supply_request_draft(jsonb,jsonb) TO authenticated;

DROP POLICY IF EXISTS dashboard_supply_batch_audit_read_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_supply_batch_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'supply_request_batch' OR EXISTS (
  SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_audit_logs.record_id
));
DROP POLICY IF EXISTS dashboard_supply_batch_audit_insert_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_supply_batch_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'supply_request_batch' OR (
  changed_by=auth.uid() AND EXISTS (
    SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_audit_logs.record_id
  )
));

-- Reviewed source repair 028-supply-fulfillment-access-boundary.sql
DROP POLICY IF EXISTS dashboard_fulfillment_access_boundary ON public.supply_fulfillment_logs;
CREATE POLICY dashboard_fulfillment_access_boundary
ON public.supply_fulfillment_logs AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(supply_fulfillment_logs.office_id) AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
);

-- Reviewed source repair 029-supply-fulfillment-audit.sql
CREATE OR REPLACE FUNCTION public.dashboard_audit_supply_fulfillment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NEW; END IF;
  INSERT INTO public.supply_audit_logs
    (record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    'supply_fulfillment_log',lower(TG_OP),auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_audit_supply_fulfillment() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_fulfillment_audit ON public.supply_fulfillment_logs;
CREATE TRIGGER trg_dashboard_fulfillment_audit
AFTER INSERT OR UPDATE OR DELETE ON public.supply_fulfillment_logs
FOR EACH ROW EXECUTE FUNCTION public.dashboard_audit_supply_fulfillment();

DROP POLICY IF EXISTS dashboard_fulfillment_audit_read_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_fulfillment_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'supply_fulfillment_log' OR (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(coalesce(supply_audit_logs.new_values->>'office_id',supply_audit_logs.old_values->>'office_id'))
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
));
DROP POLICY IF EXISTS dashboard_fulfillment_audit_insert_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_fulfillment_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'supply_fulfillment_log');

-- Reviewed source repair 032-front-desk-catalog-access.sql
DROP POLICY IF EXISTS dashboard_front_desk_catalog_access_boundary ON public.front_desk_inventory;
CREATE POLICY dashboard_front_desk_catalog_access_boundary
ON public.front_desk_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(front_desk_inventory.office_location::text)
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true
    ))
  )
);

-- Reviewed source repair 033-front-desk-catalog-audit.sql
-- No historical events are invented and no audit access rules are changed.
CREATE OR REPLACE FUNCTION public.dashboard_audit_front_desk_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values,changed_fields)
  VALUES (
    auth.uid(),TG_OP,'front_desk_inventory',
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN TG_OP='UPDATE' THEN ARRAY(
      SELECT n.key FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
      WHERE n.value IS DISTINCT FROM o.value ORDER BY n.key
    ) ELSE NULL END
  );
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_audit_front_desk_catalog() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_front_desk_catalog_audit ON public.front_desk_inventory;
CREATE TRIGGER trg_dashboard_front_desk_catalog_audit
AFTER INSERT OR UPDATE OR DELETE ON public.front_desk_inventory
FOR EACH ROW EXECUTE FUNCTION public.dashboard_audit_front_desk_catalog();

-- Reviewed source repair 034-front-desk-order-access.sql
-- Match the existing read-only history UI plus its explicit Mark Closed roles.
ALTER POLICY fdao_service_policy ON public.front_desk_amazon_orders TO service_role;
ALTER POLICY fdao_select_policy ON public.front_desk_amazon_orders TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o WHERE o.name=public.dashboard_supply_office_name(front_desk_amazon_orders.office_location::text)
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true
    ))
  )
);
DROP POLICY IF EXISTS dashboard_front_desk_order_update ON public.front_desk_amazon_orders;
CREATE POLICY dashboard_front_desk_order_update
ON public.front_desk_amazon_orders FOR UPDATE TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o WHERE o.name=public.dashboard_supply_office_name(front_desk_amazon_orders.office_location::text)
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND p.role IN ('super_admin','admin','office_manager','regional_clinical_manager')
    AND (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
      AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true
    ))
  )
);

-- Reviewed source repair 035-clinical-stock-access.sql
DROP POLICY IF EXISTS dashboard_clinical_stock_access_boundary ON public.office_supply_inventory;
CREATE POLICY dashboard_clinical_stock_access_boundary
ON public.office_supply_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(office_supply_inventory.office_id) AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
)
WITH CHECK (
  last_updated_by=auth.uid()
  AND public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(office_supply_inventory.office_id) AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
);

DROP POLICY IF EXISTS dashboard_clinical_history_access_boundary ON public.supply_inventory_history;
CREATE POLICY dashboard_clinical_history_access_boundary
ON public.supply_inventory_history AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(supply_inventory_history.office_id) AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
)
WITH CHECK (
  changed_by=auth.uid()
  AND public.dashboard_has_active_profile()
  AND EXISTS (SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(supply_inventory_history.office_id) AND public.user_can_access_office(o.id))
  AND EXISTS (SELECT 1 FROM public.office_supply_inventory i
    WHERE i.id=supply_inventory_history.inventory_id AND i.office_id=supply_inventory_history.office_id)
  AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND (p.role='super_admin' OR EXISTS (SELECT 1 FROM public.role_permissions rp
      WHERE rp.role=p.role::text AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true)))
);

-- Reviewed source repair 036-clinical-stock-create-history.sql
CREATE OR REPLACE FUNCTION public.dashboard_audit_initial_supply_stock()
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
REVOKE ALL ON FUNCTION public.dashboard_audit_initial_supply_stock() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_initial_supply_stock_history ON public.office_supply_inventory;
CREATE TRIGGER trg_dashboard_initial_supply_stock_history
AFTER INSERT ON public.office_supply_inventory
FOR EACH ROW EXECUTE FUNCTION public.dashboard_audit_initial_supply_stock();

-- Reviewed source repair 037-supply-receipt-transaction.sql
CREATE OR REPLACE FUNCTION public.receive_supply_receipt(p_payload jsonb)
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

-- Reviewed source repair 038-urgent-request-audit-simulation.sql
CREATE OR REPLACE FUNCTION public.dashboard_audit_urgent_supply_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at')=(to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    'urgent_supply_request',lower(TG_OP),auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_audit_urgent_supply_request() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_urgent_request_audit ON public.urgent_supply_requests;
CREATE TRIGGER trg_dashboard_urgent_request_audit
AFTER INSERT OR UPDATE OR DELETE ON public.urgent_supply_requests
FOR EACH ROW EXECUTE FUNCTION public.dashboard_audit_urgent_supply_request();

DROP POLICY IF EXISTS dashboard_urgent_audit_read_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_urgent_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'urgent_supply_request' OR (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(coalesce(supply_audit_logs.new_values->>'office_id',supply_audit_logs.old_values->>'office_id'))
      AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
        AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
));
DROP POLICY IF EXISTS dashboard_urgent_audit_insert_boundary ON public.supply_audit_logs;
CREATE POLICY dashboard_urgent_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'urgent_supply_request');

-- Reviewed source repair 039-urgent-request-access-boundary.sql
-- Restrict urgent requests to the existing active-account, page and office scope.
DROP POLICY IF EXISTS dashboard_urgent_request_access_boundary ON public.urgent_supply_requests;
CREATE POLICY dashboard_urgent_request_access_boundary
ON public.urgent_supply_requests AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.dashboard_has_active_profile()
  AND EXISTS (
    SELECT 1 FROM public.offices o
    WHERE o.name=public.dashboard_supply_office_name(urgent_supply_requests.office_id) AND public.user_can_access_office(o.id)
  )
  AND EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
    (p.role='super_admin' OR EXISTS (
      SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
        AND rp.permission='resources.inventory.monthly_supply.view' AND rp.enabled=true
    ))
  )
);

-- Reviewed source repair 040-front-desk-review-boundary.sql
-- The existing restrictive account/page/office policy remains mandatory.
DROP POLICY IF EXISTS dashboard_front_desk_reviewer_update ON public.supply_request_batches;
CREATE POLICY dashboard_front_desk_reviewer_update
ON public.supply_request_batches FOR UPDATE TO authenticated
USING (department_category='Front Desk' AND EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
    AND p.role IN ('super_admin','admin','regional_manager')
));

CREATE OR REPLACE FUNCTION public.dashboard_guard_front_desk_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_review_changed boolean;
  v_request_editor boolean;
BEGIN
  -- Maintenance/import operations retain their existing service-only boundary.
  IF v_actor IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.department_category='Front Desk' AND (
      NEW.requested_by IS DISTINCT FROM v_actor OR NEW.batch_status IS DISTINCT FROM 'draft'
      OR NEW.reviewer_id IS NOT NULL OR nullif(btrim(NEW.reviewer_notes),'') IS NOT NULL
    ) THEN RAISE EXCEPTION 'Create your own draft before submission' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.department_category IS DISTINCT FROM 'Front Desk'
     AND NEW.department_category IS DISTINCT FROM 'Front Desk' THEN RETURN NEW; END IF;
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.department_category IS DISTINCT FROM OLD.department_category THEN
    RAISE EXCEPTION 'Request owner and category cannot be changed' USING ERRCODE='42501';
  END IF;
  -- The additional reviewer UPDATE policy grants review only. Preserve request
  -- editing for accounts with the existing page + request permissions.
  SELECT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=v_actor AND (
    p.role='super_admin' OR (
      EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
        AND rp.permission='resources.inventory.front_desk.view' AND rp.enabled=true)
      AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role=p.role::text
        AND rp.permission='request:front_desk_order' AND rp.enabled=true)
    )
  )) INTO v_request_editor;
  IF NOT v_request_editor AND (
    (to_jsonb(NEW)-ARRAY['reviewer_id','reviewer_notes','batch_status','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reviewer_id','reviewer_notes','batch_status','updated_at'])
    OR (NEW.batch_status IS DISTINCT FROM OLD.batch_status AND NOT (
      OLD.batch_status IN ('submitted','under_review')
      AND NEW.batch_status IN ('under_review','approved','rejected')
    ))
  ) THEN
    RAISE EXCEPTION 'Review permission does not grant request editing or fulfillment' USING ERRCODE='42501';
  END IF;
  -- Receipt fulfillment keeps its existing writer/transaction rules.
  IF OLD.batch_status IN ('approved','partially_fulfilled')
     AND NEW.batch_status IN ('partially_fulfilled','fulfilled')
     AND NEW.reviewer_id IS NOT DISTINCT FROM OLD.reviewer_id
     AND NEW.reviewer_notes IS NOT DISTINCT FROM OLD.reviewer_notes THEN RETURN NEW; END IF;
  v_review_changed := NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
    OR NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes
    OR (NEW.batch_status IS DISTINCT FROM OLD.batch_status
      AND NOT (OLD.batch_status='draft' AND NEW.batch_status='submitted'));
  IF NOT v_review_changed THEN RETURN NEW; END IF;
  IF NOT public.dashboard_has_active_profile() OR OLD.requested_by IS NOT DISTINCT FROM v_actor
     OR NOT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=v_actor
       AND p.role IN ('super_admin','admin','regional_manager')) THEN
    RAISE EXCEPTION 'Regional Manager/Admin review required; self-review is not allowed' USING ERRCODE='42501';
  END IF;
  IF (to_jsonb(NEW)-ARRAY['reviewer_id','reviewer_notes','batch_status','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reviewer_id','reviewer_notes','batch_status','updated_at']) THEN
    RAISE EXCEPTION 'Review cannot change request contents or office' USING ERRCODE='42501';
  END IF;
  IF NEW.reviewer_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Reviewer must be the signed-in account' USING ERRCODE='42501';
  END IF;
  IF NEW.batch_status IS DISTINCT FROM OLD.batch_status AND NOT (
    OLD.batch_status IN ('submitted','under_review') AND NEW.batch_status IN ('under_review','approved','rejected')
  ) THEN RAISE EXCEPTION 'Request state no longer permits this action' USING ERRCODE='22023'; END IF;
  IF NEW.batch_status='rejected' AND nullif(btrim(NEW.reviewer_notes),'') IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.supply_audit_logs(record_id,record_type,action,changed_by,old_values,new_values)
  VALUES (NEW.id,'supply_request_batch','status_'||NEW.batch_status::text,v_actor,
    to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dashboard_guard_front_desk_review() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_front_desk_review_guard ON public.supply_request_batches;
CREATE TRIGGER trg_dashboard_front_desk_review_guard
BEFORE INSERT OR UPDATE ON public.supply_request_batches
FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_front_desk_review();

COMMIT;
