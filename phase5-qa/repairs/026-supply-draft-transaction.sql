-- PH5-SUPPLY-002: save a draft, its lines and audit history atomically.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Supply draft transaction requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

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

CREATE POLICY dashboard_supply_batch_audit_read_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (record_type IS DISTINCT FROM 'supply_request_batch' OR EXISTS (
  SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_audit_logs.record_id
));
CREATE POLICY dashboard_supply_batch_audit_insert_boundary
ON public.supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (record_type IS DISTINCT FROM 'supply_request_batch' OR (
  changed_by=auth.uid() AND EXISTS (
    SELECT 1 FROM public.supply_request_batches b WHERE b.id=supply_audit_logs.record_id
  )
));
COMMIT;
