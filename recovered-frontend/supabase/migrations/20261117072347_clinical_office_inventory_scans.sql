-- Clinical stock movements. Patient demographics come from the staff-confirmed Ascend appointment.
create schema clinical_scan;
revoke all on schema clinical_scan from public, anon, authenticated;
grant usage on schema clinical_scan to authenticated, service_role;

create function clinical_scan.allowed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select public.dashboard_has_active_profile() and public.user_can_access_office(target)
    and exists(select from public.offices where id=target and is_active)
    and (public.is_implant_admin_or_above() or staff_scan_private.allowed(target)
      or exists(select from supply_routing.inventory_access() where office_id=target and area='Clinical'))
$$;

create function public.clinical_scan_offices() returns table(id uuid,name text)
language sql stable security definer set search_path='' as $$
  select o.id,o.name from public.offices o where clinical_scan.allowed(o.id) order by o.name
$$;

alter table public.bone_tissue_usage_log add column clinical_scan_id uuid;
create unique index bt_usage_clinical_scan_id on public.bone_tissue_usage_log(clinical_scan_id) where clinical_scan_id is not null;

-- Only the trusted Dentrix lookup may issue a short-lived appointment confirmation.
create table clinical_scan.confirmations(
  id uuid primary key default gen_random_uuid(), actor uuid not null, office uuid not null,
  visit jsonb not null, expires_at timestamptz not null default now()+interval '20 minutes'
);
create index clinical_scan_expiration on clinical_scan.confirmations(expires_at);
create function public.issue_clinical_scan_confirmation(actor uuid, office uuid, visit jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  if actor is null or office is null or nullif(visit->>'appointmentId','') is null
    or nullif(visit->>'patientId','') is null or nullif(visit->>'providerName','') is null
    or nullif(visit->>'date','') is null then raise exception 'Incomplete visit'; end if;
  delete from clinical_scan.confirmations where expires_at<now();
  insert into clinical_scan.confirmations(actor,office,visit) values(actor,office,visit) returning id into token;
  return token;
end $$;

create table clinical_scan.movements(
  id uuid primary key, actor uuid not null, office uuid not null, category text not null, action text not null,
  stock_id uuid, quantity int not null, on_hand int, appointment text, patient text, provider text,
  procedure_id text, procedure_label text, site text, usage_ids uuid[], content jsonb not null, created_at timestamptz not null default now()
);
alter table clinical_scan.confirmations enable row level security;
alter table clinical_scan.movements enable row level security;
-- Stock is per office, item and lot. A manufacturer may ship multiple lots of the same item.
create unique index idx_bts_office_item_lot on public.bone_tissue_stock(office_id,identification_number,coalesce(lot_number,''));
drop index public.idx_bts_product_office;

-- Legacy inventory forms also post a Used status. Deduct only the matching lot.
create or replace function public.bti_auto_deduct_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; item uuid;
begin
  if new.item_status='Used' and (tg_op='INSERT' or old.item_status is distinct from 'Used') and nullif(new.identification_number,'') is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(new.office_id::text,''),0));
    select array_agg(s.id) into ids from public.bone_tissue_stock s where s.identification_number=new.identification_number
      and s.office_id is not distinct from new.office_id and (nullif(new.lot_number,'') is null or s.lot_number=new.lot_number);
    if cardinality(ids)>1 then raise exception 'Enter the lot number to select the correct stock'; end if;
    item:=ids[1];
    if item is null and nullif(new.lot_number,'') is not null then
      select s.id into item from public.bone_tissue_stock s where s.identification_number=new.identification_number
        and s.office_id is not distinct from new.office_id and coalesce(s.lot_number,'')='';
    end if;
    update public.bone_tissue_stock set current_stock=current_stock-1,updated_at=now() where id=item and current_stock>0;
  end if;
  return new;
end $$;

create function clinical_scan.stock_matches(target uuid, kind text, identifier text, lot text)
returns table(id uuid,label text,on_hand int,expiry date) language sql stable security definer set search_path='' as $$
  select s.id,s.product_name,s.current_stock,s.expiration_date from public.bone_tissue_stock s
  where kind='graft' and s.office_id=target and (identifier='' or s.identification_number=identifier or (lot='' and s.lot_number=identifier)) and (lot='' or s.lot_number=lot)
  union all
  select i.id,concat_ws(' / ',nullif(i.company_name,''),nullif(i.system_name,''),nullif(i.platform_size_name,'')),i.quantity_in_stock,i.expiration_date
  from public.implant_inventory i where kind='implant' and i.office_id=target and i.item_status in ('in_stock','used')
    and (identifier='' or i.identification_number=identifier or (lot='' and i.lot_number=identifier)) and (lot='' or i.lot_number=lot)
$$;

create function public.clinical_scan_stock(target uuid,kind text,identifier text,lot text)
returns table(id uuid,label text,on_hand int,expiry date) language plpgsql stable security definer set search_path='' as $$
begin
  if not clinical_scan.allowed(target) then raise exception 'Office access denied' using errcode='42501'; end if;
  if coalesce(trim(identifier),'')='' and coalesce(trim(lot),'')='' then return; end if;
  return query select * from clinical_scan.stock_matches(target,kind,coalesce(trim(identifier),''),coalesce(trim(lot),'')) limit 2;
end $$;

create function public.record_clinical_office_scan(movement jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); target uuid:=(movement->>'office')::uuid; kind text:=movement->>'category';
  operation text:=movement->>'action'; qty int:=(movement->>'quantity')::integer;
  identifier text:=coalesce(trim(movement->>'identifier'),''); lot text:=coalesce(trim(movement->>'lot'),'');
  expiry date:=nullif(movement->>'expiry','')::date; label text:=trim(movement->>'product'); notes text:=coalesce(trim(movement->>'notes'),'');
  actor_name text; office_name_value text; found_ids uuid[]; stock uuid; remaining int; used_ids uuid[]:='{}'; visit jsonb;
  bone public.bone_tissue_stock%rowtype; imp public.implant_inventory%rowtype; prior clinical_scan.movements%rowtype;
  prior_units integer; rec_id uuid; history jsonb; local_provider uuid;
begin
  if not clinical_scan.allowed(target) then raise exception 'Office access denied' using errcode='42501'; end if;
  if request_id is null or kind is null or kind not in ('graft','implant') or operation is null or operation not in ('receive','consume')
    or qty is null or qty not between 1 and 1000 or (identifier='' and lot='') then raise exception 'Check item, office and whole quantity'; end if;
  select full_name into strict actor_name from public.user_profiles where id=actor_id;
  select name into strict office_name_value from public.offices where id=target;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text,92));
  select * into prior from clinical_scan.movements where id=request_id;
  if found then
    if prior.actor<>actor_id or prior.content<>movement then raise exception 'This request has already been used'; end if;
    return jsonb_build_object('onHand',prior.on_hand,'quantity',prior.quantity,'id',request_id);
  end if;
  if operation='consume' then
    delete from clinical_scan.confirmations c where c.id=(movement->>'confirmation')::uuid and c.actor=actor_id
      and c.office=target and c.expires_at>now() returning c.visit into visit;
    if not found then raise exception 'Find and confirm this office visit again'; end if;
    select (array_agg(p.id))[1] into local_provider from public.providers p
      where p.is_active and lower(trim(p.name))=lower(trim(visit->>'providerName')) having count(*)=1;
  end if;
  if visit is not null then
    notes:=concat_ws(' · ',nullif(visit->>'procedureLabel',''),case when nullif(visit->>'site','') is not null then 'Site '||(visit->>'site') end,nullif(notes,''));
  end if;
  select coalesce(notes,'') into notes;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,0));
  select array_agg(m.id) into found_ids from clinical_scan.stock_matches(target,kind,identifier,lot) m;
  if cardinality(found_ids)>1 then raise exception 'Multiple stock records match. Specify the item ID and lot.'; end if;
  stock:=found_ids[1];
  if operation='consume' and stock is null then raise exception 'This item is not on hand in the selected office'; end if;
  history:=jsonb_build_object('action','received','quantity',qty,'by',actor_name,'by_id',actor_id,'at',now(),'scan_method',movement->>'method','notes',notes);
  if operation='consume' then
    select coalesce(sum(quantity),0) into prior_units from clinical_scan.movements m 
      where m.office=target and m.stock_id=stock and m.category=kind and m.appointment=visit->>'appointmentId' and m.action='consume';
    if prior_units<>coalesce((movement->>'priorUnits')::int,0) then
      raise exception 'Already recorded for this visit and lot: % unit(s).',prior_units;
    end if;
  end if;
  if kind='graft' then
    if stock is not null then select * into strict bone from public.bone_tissue_stock where id=stock for update; end if;
    if operation='receive' then
      if stock is null then
        if nullif(label,'') is null or coalesce(movement->>'type','') not in ('Bone','Tissue','Membrane','PRF') then raise exception 'Enter product name and material type'; end if;
        insert into public.bone_tissue_stock(office_id,office_name,identification_number,lot_number,product_name,bone_tissue_type,current_stock)
          values(target,office_name_value,identifier,lot,label,movement->>'type',0) returning id into stock;
      elsif expiry is not null and bone.expiration_date is not null and expiry<>bone.expiration_date then raise exception 'Expiration conflicts with this lot'; end if;
      update public.bone_tissue_stock set current_stock=current_stock+qty, expiration_date=coalesce(expiry,expiration_date),
        last_restocked_at=now(),last_restocked_by=actor_id,last_restocked_by_name=actor_name,updated_at=now(),
        restock_history=coalesce(restock_history,'[]')||jsonb_build_array(history) where id=stock returning current_stock into remaining;
    else
      update public.bone_tissue_stock set current_stock=current_stock-qty,updated_at=now() where id=stock and current_stock>=qty returning current_stock into remaining;
      if not found then raise exception 'Insufficient stock in this office'; end if;
      insert into public.bone_tissue_usage_log(clinical_scan_id,office_id,office_name,provider_id,provider_name,staff_id,staff_name,patient_name,patient_chart_number,procedure_date,
        bone_tissue_type,product_name,identification_number,lot_number,expiration_date,quantity_used,scan_method,notes,created_by,created_by_name)
        values(request_id,target,office_name_value,local_provider,visit->>'providerName',actor_id,actor_name,visit->>'patientName',coalesce(visit->>'chartNumber',''),(visit->>'date')::date,
        bone.bone_tissue_type,bone.product_name,bone.identification_number,bone.lot_number,bone.expiration_date,qty,movement->>'method',notes,actor_id,actor_name) returning id into rec_id;
      used_ids:=array[rec_id];
    end if;
  else
    if stock is not null then select * into strict imp from public.implant_inventory where id=stock for update; end if;
    if operation='receive' then
      if stock is null then
        if nullif(label,'') is null then raise exception 'Enter the implant company or product'; end if;
        insert into public.implant_inventory(office_id,office_name,identification_number,lot_number,company_name,system_name,platform_size_name,sku_reference,
          expiration_date,notes,quantity_in_stock,item_status,created_by,updated_by) values(target,office_name_value,nullif(identifier,''),nullif(lot,''),label,
          movement->>'system',movement->>'platform',movement->>'sku',expiry,notes,qty,'in_stock',actor_id,actor_id) returning id,quantity_in_stock into stock,remaining;
      else
        if expiry is not null and imp.expiration_date is not null and expiry<>imp.expiration_date then raise exception 'Expiration conflicts with this lot'; end if;
        update public.implant_inventory set quantity_in_stock=coalesce(quantity_in_stock,0)+qty,item_status='in_stock',updated_by=actor_id,
          updated_at=now(),expiration_date=coalesce(expiry,expiration_date) where id=stock returning quantity_in_stock into remaining;
      end if;
    else
      if imp.item_status<>'in_stock' or coalesce(imp.quantity_in_stock,0)<qty then raise exception 'Insufficient stock in this office'; end if;
      -- Each usage row triggers the existing single-unit stock deduction.
      with units as (
        insert into public.implant_usage_logs(office_id,office_name,implant_inventory_id,provider_id,provider_name,patient_name,patient_chart_number,procedure_date,
          staff_assistant_id,staff_assistant_name,tooth_site_number,company_id,company_name,system_id,system_name,platform_size_id,platform_size_name,length_id,length_label,
          diameter_id,diameter_label,identification_number,lot_number,procedure_notes,item_status,created_by)
        select target,office_name_value,stock,local_provider,visit->>'providerName',visit->>'patientName',coalesce(visit->>'chartNumber',''),(visit->>'date')::date,
          actor_id,actor_name,visit->>'site',imp.company_id,imp.company_name,imp.system_id,imp.system_name,imp.platform_size_id,imp.platform_size_name,imp.length_id,imp.length_label,
          imp.diameter_id,imp.diameter_label,imp.identification_number,imp.lot_number,notes,'used',actor_id from generate_series(1,qty) returning id
      ) select array_agg(id) into used_ids from units;
      select quantity_in_stock into strict remaining from public.implant_inventory where id=stock;
    end if;
    insert into public.implant_audit_logs(record_id,record_type,action,changed_by,changed_by_name,new_values)
      values(stock,'inventory',(case when operation='receive' then 'restocked' else 'used' end)::public.implant_audit_action,actor_id,actor_name,jsonb_build_object('quantity',qty,'new_total',remaining,'scan',request_id));
  end if;
  insert into clinical_scan.movements(id,actor,office,category,action,stock_id,quantity,on_hand,appointment,patient,provider,procedure_id,procedure_label,site,usage_ids,content)
    values(request_id,actor_id,target,kind,operation,stock,qty,remaining,visit->>'appointmentId',visit->>'patientId',visit->>'providerId',visit->>'procedureId',visit->>'procedureLabel',visit->>'site',used_ids,movement);
  return jsonb_build_object('onHand',remaining,'quantity',qty,'id',request_id);
end $$;
revoke all on all functions in schema clinical_scan from public,anon,authenticated;
revoke all on all tables in schema clinical_scan from public,anon,authenticated;
revoke all on function public.issue_clinical_scan_confirmation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_clinical_scan_confirmation(uuid,uuid,jsonb) to service_role;
revoke all on function public.clinical_scan_offices(),public.clinical_scan_stock(uuid,text,text,text),public.record_clinical_office_scan(jsonb,uuid) from public,anon;
grant execute on function public.clinical_scan_offices(),public.clinical_scan_stock(uuid,text,text,text),public.record_clinical_office_scan(jsonb,uuid) to authenticated;
