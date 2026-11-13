create function public.purchasing_receipts_without_invoice(at_office uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare res jsonb;begin if not purchasing_private.active_offices_allowed() then raise insufficient_privilege;end if;
select coalesce(jsonb_agg(to_jsonb(a) order by a.received_day desc nulls last,a.id),'[]') into res from (
select f.id,o.name as office_name,f.item_name,f.date_received as received_day,f.qty_received as qty from public.supply_fulfillment_logs f join public.purchasing_record_offices() o on f.office_id='Nu Dental of '||o.name
where (at_office is null or o.id=at_office) and (f.date_received is not null or f.qty_received>0) and not exists(select 1 from purchasing_private.invoices i cross join jsonb_array_elements(i.items) j where not i.voided and j->>'fulfillment_id'=f.id::text)) a;return res;end;$$;
create function purchasing_private.validate_fulfillment_link() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb;begin
for item in select value from jsonb_array_elements(new.items) where nullif(trim(value->>'fulfillment_id'),'') is not null loop
 if not exists(select 1 from public.supply_fulfillment_logs f join public.offices o on f.office_id='Nu Dental of '||o.name where f.id::text=item->>'fulfillment_id' and (new.office=o.name or (new.office='Shared' and exists(select 1 from jsonb_array_elements(new.splits) a where a->>'office'=o.name)))) then raise exception 'Check the fulfillment reference and its office';end if;
end loop;return new;end;$$;
create trigger verify_fulfillment_records before insert or update on purchasing_private.invoices for each row execute function purchasing_private.validate_fulfillment_link();
revoke all on function public.purchasing_receipts_without_invoice(uuid),purchasing_private.validate_fulfillment_link() from public,anon,authenticated;
grant execute on function public.purchasing_receipts_without_invoice(uuid) to authenticated;
notify pgrst,'reload schema';
