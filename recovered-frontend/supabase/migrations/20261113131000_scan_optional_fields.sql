create or replace function staff_scan_private.record_movement(movement jsonb,request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); target uuid:=(movement->>'officeId')::uuid;
 identifier text:=trim(coalesce(movement->>'identificationNumber','')); lot text:=trim(coalesce(movement->>'lotNumber',''));
 qty integer:=(movement->>'quantity')::integer; action text:=movement->>'action';
 location_name text; staff_name text; provider_label text; item public.bone_tissue_stock%rowtype;
 item_id uuid; n integer; expiry date:=nullif(movement->>'expirationDate','')::date;
begin
 if not coalesce(staff_scan_private.allowed(target),false) then raise exception 'Office is outside your scan assignment' using errcode='42501'; end if;
 if request_id is null or action is null or action not in ('receive','consume') or qty is null or qty<1 or qty>10000 or (identifier='' and lot='') then raise exception 'Check item, lot and quantity'; end if;
 select o.name into strict location_name from public.offices o where o.id=target;
 select p.full_name into strict staff_name from public.user_profiles p where p.id=actor;
 insert into staff_scan_private.receipts values(actor,request_id,target) on conflict do nothing;
 if not found then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,0));
 select count(*),(array_agg(s.id))[1] into n,item_id from public.bone_tissue_stock s where s.office_id=target and
 (lot='' or coalesce(s.lot_number,'')=lot) and (identifier='' or coalesce(s.identification_number,'')=identifier);
 if n>1 then raise exception 'Multiple stock records match. Ask Maia to reconcile the lot.'; end if;
 if n=1 then select * into strict item from public.bone_tissue_stock where id=item_id for update; end if;
 if action='receive' then
   if n=0 then
     if trim(coalesce(movement->>'productName',''))='' then raise exception 'Enter the product name'; end if;
     insert into public.bone_tissue_stock(office_id,office_name,identification_number,lot_number,product_name,bone_tissue_type,expiration_date,current_stock,last_restocked_by,last_restocked_by_name,last_restocked_at,restock_history)
      values(target,location_name,identifier,lot,movement->>'productName',coalesce(movement->>'boneType',''),expiry,0,actor,staff_name,now(),'[]') returning id into item_id;
   end if;
   update public.bone_tissue_stock set current_stock=coalesce(current_stock,0)+qty,last_restocked_by=actor,last_restocked_by_name=staff_name,last_restocked_at=now(),updated_at=now(),expiration_date=coalesce(expiry,expiration_date),restock_history=coalesce(restock_history,'[]')||jsonb_build_array(jsonb_build_object('action','received','quantity',qty,'by',staff_name,'by_id',actor,'at',now(),'scan_method',movement->>'scanMethod')) where id=item_id;
 else
   if n<>1 or coalesce(item.current_stock,0)<qty then raise exception 'No matching stock or insufficient quantity in this office'; end if;
   if trim(coalesce(movement->>'patientName',''))='' or nullif(movement->>'procedureDate','') is null then raise exception 'Enter the patient and procedure date'; end if;
   select p.name into provider_label from public.providers p where p.id=(movement->>'providerId')::uuid and p.is_active;
   if provider_label is null then raise exception 'Choose an active provider'; end if;
   update public.bone_tissue_stock set current_stock=current_stock-qty,updated_at=now() where id=item_id;
   insert into public.bone_tissue_usage_log(office_id,office_name,provider_id,provider_name,staff_id,staff_name,patient_name,patient_chart_number,procedure_date,bone_tissue_type,product_name,identification_number,lot_number,expiration_date,quantity_used,scan_method,notes,created_by,created_by_name)
     values(target,location_name,(movement->>'providerId')::uuid,provider_label,actor,staff_name,movement->>'patientName',coalesce(movement->>'patientChartNumber',''),(movement->>'procedureDate')::date,item.bone_tissue_type,item.product_name,item.identification_number,item.lot_number,item.expiration_date,qty,coalesce(movement->>'scanMethod','manual'),coalesce(movement->>'notes',''),actor,staff_name);
 end if;
end; $$;

