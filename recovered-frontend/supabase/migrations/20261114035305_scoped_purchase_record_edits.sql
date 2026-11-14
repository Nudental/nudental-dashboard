-- Keep vendor feed entries intact. A correction remains attached to its source row.
alter view purchasing_private.purchases rename to source_purchases;

create table purchasing_private.purchase_edits (
  source text not null,
  id uuid not null,
  office_id uuid not null references public.offices(id),
  purchased date,
  vendor text not null check (trim(vendor) <> ''),
  item text not null check (trim(item) <> ''),
  reference text,
  quantity numeric check (quantity >= 0),
  amount numeric check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  received numeric check (received >= 0),
  evidence text not null check (trim(evidence) <> ''),
  reason text not null check (trim(reason) <> ''),
  revision integer not null,
  primary key (source,id),
  check (received is null or quantity is null or received <= quantity)
);
revoke all on purchasing_private.purchase_edits from public, anon, authenticated;

create view purchasing_private.purchases as
select coalesce(e.source,s.source) as source, coalesce(e.id,s.id) as id, o.id as office_id, o.name as office_name,
  case when e.id is null then s.purchased else e.purchased end as purchased,
  case when e.id is null then s.reference else e.reference end as reference,
  coalesce(e.vendor,s.vendor) as vendor, coalesce(e.item,s.item) as item,
  case when e.id is null then s.quantity else e.quantity end as quantity,
  case when e.id is null then s.amount else e.amount end as amount,
  s.status, coalesce(e.currency,'USD') as currency, e.received, e.evidence, e.reason, coalesce(e.revision,0) as revision
from purchasing_private.source_purchases s
full join purchasing_private.purchase_edits e on e.source=s.source and e.id=s.id
join public.offices o on o.id=coalesce(e.office_id,s.office_id);

create function public.purchasing_save_purchase(
  source_kind text, record_key uuid, at_office uuid, prior jsonb, fields jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  old_row jsonb;
  new_row jsonb;
  item_input text := nullif(trim(fields->>'item'),'');
  vendor_input text := nullif(trim(fields->>'vendor'),'');
  evidence_input text := nullif(trim(fields->>'evidence'),'');
  reason_input text := nullif(trim(fields->>'reason'),'');
begin
  if not purchasing_private.can_manage() or not exists(select 1 from public.purchasing_record_offices() where id=at_office) then
    raise insufficient_privilege;
  end if;
  if record_key is null or source_kind is null or item_input is null or vendor_input is null or evidence_input is null or reason_input is null then
    raise exception 'Enter the item, vendor, evidence and reason for the record.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(source_kind||record_key::text,0));
  select to_jsonb(p) into old_row from purchasing_private.purchases p where p.id=record_key and p.source=source_kind;
  if old_row is not null and not exists(select 1 from public.purchasing_record_offices() where id=(old_row->>'office_id')::uuid) then
    raise insufficient_privilege;
  end if;
  if old_row is distinct from prior then raise exception 'The purchase changed. Refresh and reopen it.'; end if;
  if prior is null and source_kind <> 'Manual purchase' then raise exception 'Choose a manual record for a new purchase.'; end if;
  insert into purchasing_private.purchase_edits as e
    (source,id,office_id,purchased,vendor,item,reference,quantity,amount,currency,received,evidence,reason,revision)
    values(source_kind,record_key,at_office,nullif(fields->>'purchased','')::date,vendor_input,item_input,
      nullif(trim(fields->>'reference'),''),nullif(fields->>'quantity','')::numeric,nullif(fields->>'amount','')::numeric,
      upper(trim(fields->>'currency')),nullif(fields->>'received','')::numeric,evidence_input,reason_input,1)
  on conflict (source,id) do update set office_id=excluded.office_id,purchased=excluded.purchased,vendor=excluded.vendor,
    item=excluded.item,reference=excluded.reference,quantity=excluded.quantity,amount=excluded.amount,currency=excluded.currency,
    received=excluded.received,evidence=excluded.evidence,reason=excluded.reason,revision=e.revision+1;
  select to_jsonb(p) into strict new_row from purchasing_private.purchases p where p.id=record_key and p.source=source_kind;
  insert into purchasing_private.record_changes(record_id,object_type,actor,before_record,after_record)
    values(record_key,'Purchase',auth.uid(),old_row,new_row);
  return record_key;
end;
$$;
revoke all on function public.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.purchasing_save_purchase(text,uuid,uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
