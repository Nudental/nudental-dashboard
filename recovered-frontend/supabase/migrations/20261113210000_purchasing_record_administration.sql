create schema purchasing_private;
revoke all on schema purchasing_private from public,anon,authenticated;
create table public.purchasing_record_admins(user_id uuid primary key references public.user_profiles(id) on delete cascade);
alter table public.purchasing_record_admins enable row level security;
revoke all on public.purchasing_record_admins from public,anon,authenticated;
grant select on public.purchasing_record_admins to authenticated;
create policy read_own_purchasing_assignment on public.purchasing_record_admins for select to authenticated using (user_id=auth.uid() and public.dashboard_has_active_profile());
create function purchasing_private.can_manage() returns boolean language sql stable security definer set search_path='' as $$
 select public.dashboard_has_active_profile() and (exists(select 1 from public.purchasing_record_admins g where g.user_id=auth.uid()) or exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role='super_admin'));
$$;
create function public.purchasing_record_offices() returns table(id uuid,name text)
language sql stable security definer set search_path='' as $$
 select o.id,o.name from public.offices o where o.is_active and purchasing_private.can_manage() and public.user_can_access_office(o.id) order by 2;
$$;
create view purchasing_private.stock as select 'Front desk'::text kind, i.id, o.id office_id,o.name office_name, i.item_name as item_name, i.category as category, null::text reference, null::text lot, null::date expiry, i.current_qty as quantity,i.min_required as minimum,i.updated_at
  from public.front_desk_inventory i join public.offices o on i.office_location::text='Nu Dental of '||o.name
 union all
 select 'Clinical supply'::text kind, i.id, o.id office_id,o.name office_name, i.item_name as item_name, i.brand as category, i.sku reference, i.lot_number lot, i.expiration_date expiry, i.quantity_on_hand as quantity,i.minimum_level as minimum,i.updated_at
  from public.office_supply_inventory i join public.offices o on i.office_id::text='Nu Dental of '||o.name
 union all
 select 'Bone and tissue'::text kind, i.id, o.id office_id,o.name office_name, i.product_name as item_name, i.bone_tissue_type as category, i.identification_number reference, i.lot_number lot, i.expiration_date expiry, i.current_stock as quantity,i.minimum_stock_level as minimum,i.updated_at
  from public.bone_tissue_stock i join public.offices o on i.office_id=o.id
 union all
 select 'Implants'::text kind, i.id, o.id office_id,o.name office_name, i.system_name as item_name, i.company_name as category, i.sku_reference reference, i.lot_number lot, i.expiration_date expiry, i.quantity_in_stock as quantity,i.minimum_stock_level as minimum,i.updated_at
  from public.implant_inventory i join public.offices o on i.office_id=o.id;
create view purchasing_private.purchases as
 select 'Amazon order line'::text source,a.id,o.id office_id,o.name office_name,a.order_date as purchased,a.order_id::text reference,a.seller_name vendor,a.item_name as item,a.item_quantity::numeric quantity,a.item_net_total::numeric amount,a.receiving_status::text as status
 from public.front_desk_amazon_orders a join public.offices o on a.office_location::text='Nu Dental of '||o.name
 union all
 select 'Supply fulfillment',f.id,o.id,o.name,f.date_supplied,null::text,v.name,f.item_name,f.qty_supplied,f.total_cost,f.log_fulfillment_status::text
 from public.supply_fulfillment_logs f join public.offices o on f.office_id='Nu Dental of '||o.name left join public.supply_vendors v on v.id=f.vendor_id
 union all
 select 'Implant / graft order',g.id,o.id,o.name,g.order_date,g.order_number,g.vendor,g.product_name,g.allocated_qty,g.allocated_cost,g.traceability_status::text
 from public.implant_grafting_order_allocations g join public.offices o on g.allocated_office_id=o.id
 union all
 select 'Placed Amazon order',a.id,o.id,o.name,(a.placed_at at time zone 'America/New_York')::date,a.amazon_order_id,'Amazon','Placed order',null::numeric,a.estimated_total,a.status::text
 from public.amazon_order_requests a join public.offices o on a.office_id=o.id where a.placed_at is not null;
create function public.purchasing_records(section text, at_office uuid, term text default '', page_no integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not purchasing_private.can_manage() then raise insufficient_privilege;end if;
 if at_office is not null and not exists(select 1 from public.purchasing_record_offices() where id=at_office) then raise insufficient_privilege;end if;
 if page_no is null or page_no<0 then raise exception 'Choose a valid page';end if;
 if section='Inventory' then
  with found as materialized(select s.* from purchasing_private.stock s join public.purchasing_record_offices() o on o.id=s.office_id
    where (at_office is null or o.id=at_office) and strpos(lower(concat_ws(' ',s.item_name,s.category,s.reference,s.lot,s.kind)),lower(coalesce(term,'')))>0),
  page as (select * from found order by office_name,item_name,id,kind limit 50 offset page_no::bigint*50)
  select jsonb_build_object('count',(select count(*) from found),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by office_name,item_name,id,kind) from page p),'[]')) into result;
 elsif section='Purchases' then
  with found as materialized(select a.* from purchasing_private.purchases a join public.purchasing_record_offices() o on o.id=a.office_id
    where (at_office is null or o.id=at_office) and strpos(lower(concat_ws(' ',a.item,a.vendor,a.reference,a.source)),lower(coalesce(term,'')))>0),
  page as (select * from found order by purchased desc nulls last,source,id limit 50 offset page_no::bigint*50)
  select jsonb_build_object('count',(select count(*) from found),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by purchased desc nulls last,source,id) from page p),'[]')) into result;
 else raise exception 'Select inventory or purchases';end if;
 return result;
end;$$;
create function public.purchasing_save_stock(kind text, at_office uuid, record_key uuid, prior jsonb, fields jsonb, reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare office_name text; item_label text=trim(fields->>'item_name');group_label text=nullif(trim(fields->>'category'),'');
 ref text=nullif(trim(fields->>'reference'),'');lot_code text=nullif(trim(fields->>'lot'),'');expires date=nullif(fields->>'expiry','')::date;
 qty integer=(fields->>'quantity')::integer;minimum_qty integer=(fields->>'minimum')::integer;
 old_row jsonb;new_row jsonb;affected integer=1;
begin
 if not purchasing_private.can_manage() then raise insufficient_privilege;end if;
 select o.name into strict office_name from public.purchasing_record_offices() o where o.id=at_office;
 if record_key is null or nullif(item_label,'') is null or qty is null or qty<0 or minimum_qty is null or minimum_qty<0 or nullif(trim(reason),'') is null then raise exception 'Enter an item, nonnegative stock levels and a reason';end if;
 if kind='Front desk' and group_label is null then raise exception 'Enter a front desk category';end if;
 if kind='Bone and tissue' and ref is null then raise exception 'Enter the package identifier';end if;
 perform pg_advisory_xact_lock(hashtextextended(record_key::text,0));
 select to_jsonb(s) into old_row from purchasing_private.stock s where s.kind=purchasing_save_stock.kind and s.id=record_key and s.office_id=at_office;
 if old_row is distinct from prior then raise exception 'This record changed. Refresh before saving.';end if;
 case kind
  when 'Front desk' then
    if old_row is null then
      insert into public.front_desk_inventory(id,office_location,item_name,category,current_qty,min_required) values (record_key,('Nu Dental of '||office_name)::public.front_desk_office_location,item_label,group_label,qty,minimum_qty);
    else
      update public.front_desk_inventory i set item_name=item_label,category=group_label,current_qty=qty,min_required=minimum_qty,updated_at=clock_timestamp()
        where i.id=record_key and i.office_location=('Nu Dental of '||office_name)::public.front_desk_office_location and i.updated_at is not distinct from (old_row->>'updated_at')::timestamptz
        and i.current_qty is not distinct from (old_row->>'quantity')::integer;
      get diagnostics affected=row_count;
    end if;
 when 'Clinical supply' then
    if old_row is null then
      insert into public.office_supply_inventory(id,office_id,item_name,brand,sku,lot_number,expiration_date,quantity_on_hand,minimum_level) values (record_key,('Nu Dental of '||office_name),item_label,group_label,ref,lot_code,expires,qty,minimum_qty);
    else
      update public.office_supply_inventory i set item_name=item_label,brand=group_label,sku=ref,lot_number=lot_code,expiration_date=expires,quantity_on_hand=qty,minimum_level=minimum_qty,updated_at=clock_timestamp()
        where i.id=record_key and i.office_id=('Nu Dental of '||office_name) and i.updated_at is not distinct from (old_row->>'updated_at')::timestamptz
        and i.quantity_on_hand is not distinct from (old_row->>'quantity')::integer;
      get diagnostics affected=row_count;
    end if;
 when 'Bone and tissue' then
    if old_row is null then
      insert into public.bone_tissue_stock(id,office_id,product_name,bone_tissue_type,identification_number,lot_number,expiration_date,current_stock,minimum_stock_level,office_name) values (record_key,at_office,item_label,coalesce(group_label,''),ref,lot_code,expires,qty,minimum_qty,office_name);
    else
      update public.bone_tissue_stock i set product_name=item_label,bone_tissue_type=coalesce(group_label,''),identification_number=ref,lot_number=lot_code,expiration_date=expires,current_stock=qty,minimum_stock_level=minimum_qty,updated_at=clock_timestamp()
        where i.id=record_key and i.office_id=at_office and i.updated_at is not distinct from (old_row->>'updated_at')::timestamptz
        and i.current_stock is not distinct from (old_row->>'quantity')::integer;
      get diagnostics affected=row_count;
    end if;
 when 'Implants' then
    if old_row is null then
      insert into public.implant_inventory(id,office_id,system_name,company_name,sku_reference,lot_number,expiration_date,quantity_in_stock,minimum_stock_level,office_name) values (record_key,at_office,item_label,group_label,ref,lot_code,expires,qty,minimum_qty,office_name);
    else
      update public.implant_inventory i set system_name=item_label,company_name=group_label,sku_reference=ref,lot_number=lot_code,expiration_date=expires,quantity_in_stock=qty,minimum_stock_level=minimum_qty,updated_at=clock_timestamp()
        where i.id=record_key and i.office_id=at_office and i.updated_at is not distinct from (old_row->>'updated_at')::timestamptz
        and i.quantity_in_stock is not distinct from (old_row->>'quantity')::integer;
      get diagnostics affected=row_count;
    end if;
 else raise exception 'Unknown stock type';end case;
 if affected<>1 then raise exception 'Stock changed. Refresh before saving.';end if;
 select to_jsonb(s) into strict new_row from purchasing_private.stock s where s.kind=purchasing_save_stock.kind and s.id=record_key and s.office_id=at_office;
 insert into public.audit_logs(user_id,action,table_name,record_id,old_values,new_values,change_summary) values(auth.uid(),case when prior is null then 'INSERT' else 'UPDATE' end,'purchasing_stock',record_key,old_row,new_row,trim(reason));
 if kind='Clinical supply' and prior is not null and (prior->>'quantity')::integer is distinct from qty then
 insert into public.supply_inventory_history(inventory_id,office_id,change_type,old_qty,new_qty,change_qty,changed_by,change_reason) values(record_key,'Nu Dental of '||office_name,'adjustment',(prior->>'quantity')::int,qty,qty-coalesce((prior->>'quantity')::int,0),auth.uid(),reason);
 end if;
 return record_key;
end;$$;
revoke all on all functions in schema purchasing_private from public,anon,authenticated;
revoke all on function public.purchasing_record_offices(),public.purchasing_records(text,uuid,text,integer),public.purchasing_save_stock(text,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.purchasing_record_offices(),public.purchasing_records(text,uuid,text,integer),public.purchasing_save_stock(text,uuid,uuid,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
