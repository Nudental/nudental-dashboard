create table purchasing_private.purchase_categories (
  source text not null, id uuid not null, category text not null check(length(trim(category)) between 1 and 100),
  primary key (source,id), foreign key (source,id) references purchasing_private.purchase_edits(source,id)
);
revoke all on purchasing_private.purchase_categories from public,anon,authenticated;

-- Keep the original scoped save, concurrency checks and audit in the same transaction.
alter function public.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) set schema purchasing_private;
revoke all on function purchasing_private.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
create function public.purchasing_save_purchase(source_kind text, record_key uuid, at_office uuid, prior jsonb, fields jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare old_category text; new_category text; saved uuid;
begin
  saved=purchasing_private.purchasing_save_purchase(source_kind,record_key,at_office,prior-'category',fields);
  if fields ? 'category' then
    select category into old_category from purchasing_private.purchase_categories where source=source_kind and id=saved;
    new_category=nullif(trim(fields->>'category'),'');
    if old_category is distinct from new_category then
      if new_category is null then
        delete from purchasing_private.purchase_categories where source=source_kind and id=saved;
      else
        insert into purchasing_private.purchase_categories values(source_kind,saved,new_category)
        on conflict(source,id) do update set category=excluded.category;
      end if;
      insert into purchasing_private.record_changes(record_id,object_type,actor,before_record,after_record)
        values(saved,'Purchase category',auth.uid(),jsonb_build_object('category',old_category),jsonb_build_object('category',new_category));
    end if;
  end if;
  return saved;
end;
$$;
revoke all on function public.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) to authenticated;

alter function public.purchasing_records(text,uuid,text,integer) set schema purchasing_private;
revoke all on function purchasing_private.purchasing_records(text,uuid,text,integer) from public,anon,authenticated;
create function public.purchasing_records(section text,at_office uuid,term text default '',page_no integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare data jsonb; enriched jsonb;
begin
  data=purchasing_private.purchasing_records(section,at_office,term,page_no);
  if section='Purchases' then
    select coalesce(jsonb_agg(r.item || jsonb_build_object('category',c.category) order by r.n),'[]') into enriched
    from jsonb_array_elements(data->'rows') with ordinality as r(item,n)
    left join purchasing_private.purchase_categories c on c.source=r.item->>'source' and c.id=(r.item->>'id')::uuid;
    data=jsonb_set(data,'{rows}',enriched);
  end if;
  return data;
end;
$$;
revoke all on function public.purchasing_records(text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.purchasing_records(text,uuid,text,integer) to authenticated;
-- One read-only snapshot across purchase, invoice and payment evidence.
create function public.supply_spending_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not purchasing_private.active_offices_allowed() then raise insufficient_privilege; end if;
  select jsonb_build_object(
    'purchases',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object(
        'category',coalesce(c.category,a.front_desk_category::text,d.name,g.product_category::text),
        'order_status',a.amazon_order_status::text))
      from purchasing_private.purchases p
      left join purchasing_private.purchase_categories c on c.source=p.source and c.id=p.id
      left join public.front_desk_amazon_orders a on p.source='Amazon order line' and a.id=p.id
      left join public.supply_fulfillment_logs f on p.source='Supply fulfillment' and f.id=p.id
      left join public.supply_departments d on d.id=f.department_id
      left join public.implant_grafting_order_allocations g on p.source='Implant / graft order' and g.id=p.id),'[]'),
    'invoices',coalesce((select jsonb_agg(to_jsonb(i)-'created_by'-'approval_source'-'notes'-'review_note') from purchasing_private.invoices i where not i.voided),'[]'),
    'events',coalesce((select jsonb_agg(to_jsonb(e)-'recorded_by'-'bank_evidence'-'correction_note') from purchasing_private.invoice_events e),'[]'),
    'as_of',statement_timestamp()) into result;
  return result;
end;
$$;
revoke all on function public.supply_spending_snapshot() from public,anon,authenticated;
grant execute on function public.supply_spending_snapshot() to authenticated;
notify pgrst,'reload schema';
