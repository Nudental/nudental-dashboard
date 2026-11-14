-- Inventory follows the live request assignments and uses the existing stock ledger.
create function supply_routing.inventory_access()
returns table(office_id uuid, office_name text, area text)
language sql stable security definer set search_path='' as $$
 select distinct s.office_id, s.office_name,
  case when s.route='amazon' then 'Front desk' else 'Clinical' end
 from supply_routing.submit_options s where s.user_id=auth.uid()
 union
 select o.id,o.name,case when me.id=supply_routing.reviewer('amazon') then 'Front desk' else 'Clinical' end
 from supply_routing.staff me cross join public.offices o
 where me.id=auth.uid() and me.id in (supply_routing.reviewer('amazon'),supply_routing.reviewer('dental'),supply_routing.reviewer('edgeendo'))
 and o.is_active and o.name in ('Barnegat','Brick','Eatontown','Staten Island')
$$;

create function supply_routing.inventory_items(target uuid, section text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare site text; result jsonb;
begin
 select a.office_name into site from supply_routing.inventory_access() a where a.office_id=target and a.area=section;
 if site is null then raise insufficient_privilege using message='This office or inventory area is outside your assignment.'; end if;
 select coalesce(jsonb_agg(to_jsonb(items) order by items.name,items.kind,items.id),'[]'::jsonb) into result from (
  select s.id,s.item_name as name,s.kind,s.category,s.reference,s.quantity,s.minimum
  from purchasing_private.stock s where s.office_id=target and
   ((section='Front desk' and s.kind='Front desk') or (section='Clinical' and s.kind in ('Clinical supply','Implants','Bone and tissue')))
  union all
  select c.id,c.name,'Clinical catalog',c.brand,c.sku,null::numeric,null::numeric
  from public.supply_items c where section='Clinical' and c.is_active and c.department_category::text='Back Staff'
   and (c.office_id is null or public.dashboard_supply_office_name(c.office_id)=site)
   and not exists(select 1 from public.office_supply_inventory s where s.item_id=c.id and public.dashboard_supply_office_name(s.office_id)=site)
 ) items;
 return result;
end $$;
create function public.routed_supply_inventory_access() returns table(office_id uuid,office_name text,area text)
language sql stable security invoker set search_path='' as $$select * from supply_routing.inventory_access() order by office_name,area$$;
create function public.routed_supply_inventory_items(target uuid,section text) returns jsonb
language sql stable security invoker set search_path='' as $$select supply_routing.inventory_items(target,section)$$;
revoke all on function supply_routing.inventory_access(),supply_routing.inventory_items(uuid,text),
 public.routed_supply_inventory_access(),public.routed_supply_inventory_items(uuid,text) from public,anon,authenticated;
grant execute on function supply_routing.inventory_access(),supply_routing.inventory_items(uuid,text),
 public.routed_supply_inventory_access(),public.routed_supply_inventory_items(uuid,text) to authenticated;
notify pgrst,'reload schema';
