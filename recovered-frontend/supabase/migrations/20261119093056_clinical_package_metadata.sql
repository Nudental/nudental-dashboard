
-- Add package metadata without changing existing quantities or historical usage.
alter table public.implant_inventory add column package_details jsonb not null default '{}';
alter table public.bone_tissue_stock add column package_details jsonb not null default '{}';

create function public.clinical_scan_package_details(target uuid,kind text,stock_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare details jsonb;
begin
  if not clinical_scan.allowed(target) then raise exception 'Office access denied' using errcode='42501'; end if;
  if kind='implant' then
    select i.package_details || jsonb_strip_nulls(jsonb_build_object('product',nullif(i.company_name,''),'system',nullif(i.system_name,''),
      'platform',nullif(i.platform_size_name,''),'diameter',nullif(i.diameter_label,''),'length',nullif(i.length_label,''),
      'sku',nullif(i.sku_reference,''),'expiry',i.expiration_date)) into details
      from public.implant_inventory i where i.id=stock_id and i.office_id=target;
  elsif kind='graft' then
    select s.package_details || jsonb_strip_nulls(jsonb_build_object('product',nullif(s.product_name,''),'type',nullif(s.bone_tissue_type,''),
      'donor',nullif(s.donor_id,''),'expiry',s.expiration_date)) into details
      from public.bone_tissue_stock s where s.id=stock_id and s.office_id=target;
  end if;
  return coalesce(details,'{}');
end $$;

-- Keep the existing atomic movement, actor attribution, visit verification and retry behavior.
create function public.record_clinical_office_scan_v2(movement jsonb,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  target uuid:=(movement->>'office')::uuid;
  kind text:=movement->>'category'; operation text:=movement->>'action';
  details jsonb; existing jsonb; k text; stock uuid; result jsonb; previous clinical_scan.movements%rowtype;
begin
  if not clinical_scan.allowed(target) then raise exception 'Office access denied' using errcode='42501'; end if;
  if request_id is null then raise exception 'A request ID is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text,92));
  select * into previous from clinical_scan.movements where id=request_id;
  if found then
    return public.record_clinical_office_scan(movement,request_id);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target::text,0));
  if operation='receive' then
    if movement->>'detailsConfirmed' is distinct from 'true'
      or nullif(trim(movement->>'product'),'') is null or nullif(trim(movement->>'sku'),'') is null
      or nullif(trim(movement->>'lot'),'') is null or nullif(trim(movement->>'expiry'),'') is null
      then raise exception 'Confirm the product, reference, lot, expiration, size and quantity against the package label'; end if;
    if kind='implant' then
      foreach k in array array['system','platform','diameter','length'] loop
        if nullif(trim(movement->>k),'') is null then raise exception 'Enter implant % from the label',k; end if;
      end loop;
    elsif kind='graft' then
      if nullif(trim(movement->>'manufacturer'),'') is null then raise exception 'Enter manufacturer or tissue bank'; end if;
      if nullif(trim(movement->>'size'),'') is null and not (
        coalesce(nullif(movement->>'volume','')::numeric,0)>0 and coalesce(movement->>'volumeUnit','') in ('cc','mL','g','mg'))
        then raise exception 'Enter graft dimensions or volume/weight with its unit'; end if;
    end if;
    if nullif(movement->>'manufactured','')::date > (movement->>'expiry')::date then raise exception 'Manufacture date is after expiration'; end if;
    if nullif(movement->>'unitCost','')::numeric < 0 then raise exception 'Cost cannot be negative'; end if;
    select coalesce(jsonb_object_agg(key,value),'{}') into details from jsonb_each(movement)
      where key=any(array['product','system','platform','sku','type','gtin','serial','manufactured','diameter','length','surface','collar',
        'manufacturer','size','volume','volumeUnit','particleSize','donor','sterility'])
      and jsonb_typeof(value) in ('string','number') and trim(value#>>'{}')<>'';
    select m.id into stock from clinical_scan.stock_matches(target,kind,trim(movement->>'identifier'),trim(movement->>'lot')) m limit 1;
    if stock is not null then
      existing:=public.clinical_scan_package_details(target,kind,stock);
      for k in select jsonb_object_keys(details) loop
        if nullif(trim(existing->>k),'') is not null and lower(trim(existing->>k))<>lower(trim(details->>k))
          then raise exception 'Package % conflicts with the saved office lot. Check the label before receiving.',k; end if;
      end loop;
    end if;
  end if;
  result:=public.record_clinical_office_scan(movement,request_id);
  if operation='receive' then
    select m.stock_id into strict stock from clinical_scan.movements m where m.id=request_id and m.actor=auth.uid();
    if kind='implant' then
      update public.implant_inventory set package_details=package_details||details,
        diameter_label=movement->>'diameter',length_label=movement->>'length'
        where id=stock and office_id=target;
    else
      update public.bone_tissue_stock set package_details=package_details||details,donor_id=coalesce(nullif(movement->>'donor',''),donor_id)
        where id=stock and office_id=target;
    end if;
  end if;
  return result;
end $$;

revoke all on function public.clinical_scan_package_details(uuid,text,uuid),public.record_clinical_office_scan_v2(jsonb,uuid) from public,anon;
grant execute on function public.clinical_scan_package_details(uuid,text,uuid),public.record_clinical_office_scan_v2(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
