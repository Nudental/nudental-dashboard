-- Recording workspace for vendor obligations. The historical tracker remains independent until an agreed migration.
create table purchasing_private.invoice_categories(name text primary key check (length(trim(name)) between 1 and 100));
create unique index invoice_category_name_ci on purchasing_private.invoice_categories(lower(trim(name)));
create table purchasing_private.invoices (
 id uuid primary key, vendor text not null check(trim(vendor)<>''), number text, order_ref text, description text, category text references purchasing_private.invoice_categories(name),
 invoice_day date, due_day date, service_from date, service_to date, currency text not null check(currency ~ '^[A-Z]{3}$'),
 subtotal numeric(14,2) not null check(subtotal>=0), tax numeric(14,2) not null check(tax>=0), fees numeric(14,2) not null check(fees>=0),
 office text not null, splits jsonb not null, items jsonb not null, evidence text, notes text, review_note text,
 approval text not null check(approval in ('Not reviewed','Needs information','Awaiting Dr. G','Approved','Declined')),
 approval_source text, voided boolean not null default false, duplicate_note text,
 version integer not null default 1, created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (service_to is null or service_from is null or service_to>=service_from)
);
create table purchasing_private.invoice_events (
 id uuid primary key,kind text not null check(kind in ('Payment','Credit')),vendor text not null,currency text not null,day date not null,
 amount numeric(14,2) not null check(amount>0),method text,reference text,evidence text,confidence text not null check(confidence in ('Reported','Confirmed')),
 reconciled boolean not null,bank_evidence text, allocations jsonb not null,recorded_by uuid not null,created_at timestamptz not null default now(),
 revision integer not null default 1, correction_note text,
 check(confidence<>'Confirmed' or nullif(trim(evidence),'') is not null),
 check(not reconciled or (confidence='Confirmed' and nullif(trim(bank_evidence),'') is not null))
);
create table purchasing_private.invoice_receipts (
 id uuid primary key,invoice_id uuid not null references purchasing_private.invoices,item_key text not null,office text not null,day date not null,
 received integer not null check(received>=0),cancelled integer not null check(cancelled>=0), evidence text,recorded_by uuid not null,created_at timestamptz not null default now(),
 check(received+cancelled>0)
);
create table purchasing_private.record_changes(id bigint generated always as identity primary key, record_id uuid,object_type text,actor uuid not null,changed_at timestamptz not null default clock_timestamp(),before_record jsonb,after_record jsonb);
create function purchasing_private.active_offices_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select purchasing_private.can_manage() and not exists(select 1 from public.offices o where o.is_active and not public.user_can_access_office(o.id));
$$;
create function purchasing_private.vendor_key(label text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(lower(coalesce(label,'')),'[^a-z0-9]','','g');
$$;
create function purchasing_private.jtext(obj jsonb,k text) returns text language sql immutable set search_path='' as $$select nullif(trim(obj->>k),'');$$;
create function public.save_vendor_invoice(k uuid, expected_version int, entry jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old purchasing_private.invoices; n purchasing_private.invoices; actor uuid=auth.uid(); gross numeric; links jsonb; category_name text; office_name text; line jsonb; candidates jsonb;
begin
 if not purchasing_private.active_offices_allowed() then raise insufficient_privilege;end if;
 if k is null then raise exception 'Missing record identifier';end if;
 perform pg_advisory_xact_lock(hashtextextended('nu-purchasing-invoice-records',0));
 select * into old from purchasing_private.invoices where id=k for update;
 if old.version is distinct from expected_version then raise exception 'This invoice changed. Refresh and reopen it.';end if;
 n=jsonb_populate_record(null::purchasing_private.invoices, entry);
 n.id=k;n.vendor=trim(n.vendor);n.number=nullif(trim(n.number),'');n.order_ref=nullif(trim(n.order_ref),'');n.currency=upper(trim(n.currency));
 n.tax=coalesce(n.tax,0);n.fees=coalesce(n.fees,0);n.voided=coalesce(n.voided,false);n.approval=coalesce(n.approval,'Not reviewed');
 n.splits=coalesce(n.splits,'[]');n.items=coalesce(n.items,'[]');
 if coalesce(n.approval in ('Approved','Declined'),false) and nullif(trim(n.approval_source),'') is null then raise exception 'Record Dr. G’s decision reference first';end if;
 if old.id is not null and (old.currency<>n.currency or old.voided<>n.voided or purchasing_private.vendor_key(old.vendor)<>purchasing_private.vendor_key(n.vendor)) and exists(select 1 from purchasing_private.invoice_events e cross join jsonb_array_elements(e.allocations) a where a->>'invoice_id'=k::text) then raise exception 'Correct linked payment or credit allocations before changing the vendor, currency or void status';end if;
 gross=n.subtotal+n.tax+n.fees;
 if jsonb_typeof(n.splits)<>'array' or jsonb_typeof(n.items)<>'array' then raise exception 'Invalid allocations or items';end if;
 if n.office='Shared' then
  if jsonb_array_length(n.splits)<2 or exists(select 1 from jsonb_array_elements(n.splits) a where not exists(select 1 from public.purchasing_record_offices() o where o.name=a->>'office') or nullif(a->>'amount','') is null or (a->>'amount')::numeric<=0 or (a->>'amount')::numeric<>round((a->>'amount')::numeric,2)) or
   (select sum((a->>'amount')::numeric) from jsonb_array_elements(n.splits) a) is distinct from gross or (select count(distinct a->>'office') from jsonb_array_elements(n.splits) a)<>jsonb_array_length(n.splits)
   then raise exception 'Use distinct offices and split the full invoice total exactly';end if;
 elsif n.office is null or (n.office<>'Unassigned' and not exists(select 1 from public.purchasing_record_offices() o where o.name=n.office)) or jsonb_array_length(n.splits)<>0 then raise exception 'Choose an office, Shared or Unassigned';end if;
 for line in select value from jsonb_array_elements(n.items) loop
  if nullif(trim(line->>'item'),'') is null or nullif(line->>'ordered','') is null or (line->>'ordered')::int<=0 or nullif(line->>'key','') is null then raise exception 'Each inventory item needs a name and positive ordered quantity';end if;
 end loop;
 if (select count(distinct a->>'key') from jsonb_array_elements(n.items) a)<>jsonb_array_length(n.items) then raise exception 'Duplicate item identity';end if;
 if exists(select 1 from purchasing_private.invoice_receipts r where r.invoice_id=k group by r.item_key having sum(r.received+r.cancelled)>coalesce((select (a->>'ordered')::int from jsonb_array_elements(n.items) a where a->>'key'=r.item_key),0)) then raise exception 'Ordered quantity must cover recorded receipts and cancellations';end if;
 if exists(select 1 from purchasing_private.invoice_receipts r where r.invoice_id=k and not (n.office=r.office or (n.office='Shared' and exists(select 1 from jsonb_array_elements(n.splits) a where a->>'office'=r.office)))) then raise exception 'Review existing receipt offices before reallocation';end if;
 select coalesce(jsonb_agg(jsonb_build_object('vendor',i.vendor,'number',i.number,'office',i.office,'id',i.id)), '[]') into candidates
 from purchasing_private.invoices i where i.id<>k and not i.voided and purchasing_private.vendor_key(i.vendor)=purchasing_private.vendor_key(n.vendor)
 and ( (n.number is not null and lower(trim(i.number))=lower(n.number)) or (n.order_ref is not null and lower(trim(i.order_ref))=lower(n.order_ref))
 or (i.currency=n.currency and i.subtotal+i.tax+i.fees=gross and (abs(i.invoice_day-n.invoice_day)<=7 or (i.service_from=n.service_from and i.service_to=n.service_to))));
 if jsonb_array_length(candidates)>0 and nullif(trim(n.duplicate_note),'') is null then return jsonb_build_object('duplicates',candidates);end if;
 n.version=coalesce(old.version,0)+1;n.created_by=coalesce(old.created_by,actor);n.created_at=coalesce(old.created_at,now());n.updated_at=clock_timestamp();
 n.category=nullif(trim(n.category),'');
 if n.category is not null then insert into purchasing_private.invoice_categories values(n.category) on conflict do nothing;
 select name into strict category_name from purchasing_private.invoice_categories where lower(trim(name))=lower(n.category);n.category=category_name;end if;
 insert into purchasing_private.invoices select n.* on conflict(id) do update set vendor=excluded.vendor,number=excluded.number,order_ref=excluded.order_ref,description=excluded.description,category=excluded.category,
 invoice_day=excluded.invoice_day,due_day=excluded.due_day,service_from=excluded.service_from,service_to=excluded.service_to,currency=excluded.currency,subtotal=excluded.subtotal,tax=excluded.tax,fees=excluded.fees,office=excluded.office,splits=excluded.splits,items=excluded.items,evidence=excluded.evidence,notes=excluded.notes,review_note=excluded.review_note,approval=excluded.approval,approval_source=excluded.approval_source,voided=excluded.voided,duplicate_note=excluded.duplicate_note,version=excluded.version,updated_at=excluded.updated_at;
 insert into purchasing_private.record_changes(record_id,object_type,actor,before_record,after_record) values(k,'Invoice',actor,case when old.id is not null then to_jsonb(old) end,to_jsonb(n));
 return jsonb_build_object('id',k,'version',n.version);
end;$$;
create function public.record_vendor_event(k uuid, expected_revision int, entry jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare old purchasing_private.invoice_events; n purchasing_private.invoice_events; total numeric;
begin
 if not purchasing_private.active_offices_allowed() then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('nu-purchasing-invoice-records',0));
 select * into old from purchasing_private.invoice_events where id=k for update;
 if old.revision is distinct from expected_revision then raise exception 'Payment or credit changed. Refresh before saving';end if;
 n=jsonb_populate_record(null::purchasing_private.invoice_events,entry);n.vendor=trim(n.vendor);n.currency=upper(n.currency);
 if k is null or nullif(n.vendor,'') is null or n.currency !~ '^[A-Z]{3}$' or jsonb_typeof(n.allocations) is distinct from 'array' or n.amount<=0 then raise exception 'Enter the vendor, currency and amount';end if;
 if old.id is not null and nullif(trim(n.correction_note),'') is null then raise exception 'Explain the correction for the audit history';end if;
 if exists(select 1 from jsonb_array_elements(n.allocations) a where
   (a->>'amount') is null or (a->>'amount')::numeric<=0 or round((a->>'amount')::numeric,2)<>(a->>'amount')::numeric or not exists(select 1 from purchasing_private.invoices i where i.id=(a->>'invoice_id')::uuid and not i.voided and i.currency=n.currency and purchasing_private.vendor_key(i.vendor)=purchasing_private.vendor_key(n.vendor))) or
   (select count(distinct a->>'invoice_id') from jsonb_array_elements(n.allocations) a)<>jsonb_array_length(n.allocations) then raise exception 'Choose distinct open invoice records for the same vendor and currency and valid amounts';end if;
 select coalesce(sum((a->>'amount')::numeric),0) into total from jsonb_array_elements(n.allocations) a;
 if total<>0 and total<>n.amount then raise exception 'Allocate the full payment or credit, or leave it unapplied';end if;
 if exists(select 1 from purchasing_private.invoice_events e where e.id<>k and e.kind=n.kind and purchasing_private.vendor_key(e.vendor)=purchasing_private.vendor_key(n.vendor) and n.reference is not null and lower(trim(e.reference))=lower(trim(n.reference)) and e.amount=n.amount and e.currency=n.currency) then raise exception 'This reference and amount are already recorded. Review the existing payment or credit';end if;
 n.id=k;n.recorded_by=coalesce(old.recorded_by,auth.uid());n.created_at=coalesce(old.created_at,clock_timestamp());n.revision=coalesce(old.revision,0)+1;n.reconciled=coalesce(n.reconciled,false);
 insert into purchasing_private.invoice_events select n.* on conflict(id) do update set kind=n.kind,vendor=n.vendor,currency=n.currency,day=n.day,amount=n.amount,method=n.method,reference=n.reference,evidence=n.evidence,confidence=n.confidence,reconciled=n.reconciled,bank_evidence=n.bank_evidence,allocations=n.allocations,revision=n.revision,correction_note=n.correction_note;
 insert into purchasing_private.record_changes(record_id,object_type,actor,before_record,after_record) values(k,n.kind,auth.uid(),case when old.id is not null then to_jsonb(old) end,to_jsonb(n));return k;
end;$$;
create function public.record_vendor_receipt(k uuid, entry jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare n purchasing_private.invoice_receipts;i purchasing_private.invoices;ordered int;used int;
begin
 if not purchasing_private.active_offices_allowed() then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('nu-purchasing-invoice-records',0));n=jsonb_populate_record(null::purchasing_private.invoice_receipts,entry);n.id=k;n.recorded_by=auth.uid();n.created_at=clock_timestamp();
 select * into strict i from purchasing_private.invoices where id=n.invoice_id and not voided;
 select (a->>'ordered')::int into strict ordered from jsonb_array_elements(i.items) a where a->>'key'=n.item_key;
 if not (i.office=n.office or (i.office='Shared' and exists(select 1 from jsonb_array_elements(i.splits) a where a->>'office'=n.office))) or not exists(select 1 from public.purchasing_record_offices() o where o.name=n.office) then raise exception 'Use an allocated receiving office';end if;
 select coalesce(sum(received+cancelled),0) into used from purchasing_private.invoice_receipts where invoice_id=i.id and item_key=n.item_key;
 if n.received+n.cancelled+used>ordered then raise exception 'Received and cancelled quantities exceed the quantity ordered';end if;
 insert into purchasing_private.invoice_receipts select n.*;
 insert into purchasing_private.record_changes(record_id,object_type,actor,after_record) values(k,'Delivery',auth.uid(),to_jsonb(n));return k;
end;$$;
create function public.vendor_invoice_register() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare data jsonb; begin if not purchasing_private.active_offices_allowed() then raise insufficient_privilege;end if;
 select jsonb_build_object(
 'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.updated_at desc) from purchasing_private.invoices i),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.day desc,e.created_at desc) from purchasing_private.invoice_events e),'[]'),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.day desc,r.created_at desc) from purchasing_private.invoice_receipts r),'[]'),
 'changes',coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('actor_name',p.full_name) order by a.id desc) from purchasing_private.record_changes a left join public.user_profiles p on p.id=a.actor),'[]'),
 'categories',coalesce((select jsonb_agg(c.name order by c.name) from purchasing_private.invoice_categories c),'[]')) into data;return data;end;$$;
revoke all on all tables in schema purchasing_private from public,anon,authenticated;
revoke all on all functions in schema purchasing_private from public,anon,authenticated;
revoke all on function public.save_vendor_invoice(uuid,int,jsonb),public.record_vendor_event(uuid,int,jsonb),public.record_vendor_receipt(uuid,jsonb),public.vendor_invoice_register() from public,anon,authenticated;
grant execute on function public.save_vendor_invoice(uuid,int,jsonb),public.record_vendor_event(uuid,int,jsonb),public.record_vendor_receipt(uuid,jsonb),public.vendor_invoice_register() to authenticated;
notify pgrst,'reload schema';
