-- Historical material annotations live outside operational inventory and chart tables.
create schema usage_review;
revoke all on schema usage_review from public,anon,authenticated;
grant usage on schema usage_review to authenticated;

create table usage_review.visits (
 id uuid primary key, reference text unique not null, patient text not null, office text not null,
 day date not null, original jsonb not null, source text not null, recorded_at timestamptz not null default now(),
 added_by uuid, unique (patient,office,day)
);
create table usage_review.entries (
 visit uuid not null references usage_review.visits, event text not null, original jsonb not null,
 primary key(visit,event)
);
create table usage_review.revisions (
 visit uuid not null, event text not null, version int not null, actor uuid not null,
 reviewer text not null, at timestamptz not null default clock_timestamp(), evidence text not null,
 reason text not null, previous jsonb not null, current_values jsonb not null, restored_version int,
 primary key(visit,event,version),foreign key(visit,event) references usage_review.entries
);
alter table usage_review.visits enable row level security;
alter table usage_review.entries enable row level security;
alter table usage_review.revisions enable row level security;
revoke all on all tables in schema usage_review from public,anon,authenticated;

create function usage_review.allowed() returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.user_profiles p where p.id=auth.uid()
 and p.id in ('c54cedd6-982b-4992-a93a-4188aae288a7','b6e77501-3357-4a25-8655-66746b2eb53d')
 and p.is_active and p.is_approved and lower(p.status)='active')
$$;
create function usage_review.list_visits() returns table(id uuid,reference text,patient text,chart text,patient_name text,office text,day date,open_questions int)
language sql stable security definer set search_path='' as $$
 select v.id,v.reference,v.patient,coalesce(h.current_values#>>'{chart,value}',v.original->>'chart'),coalesce(h.current_values#>>'{patient_name,value}',v.original->>'name'),v.office,v.day,jsonb_array_length(coalesce(v.original->'questions','[]'::jsonb))
 from usage_review.visits v left join lateral (select current_values from usage_review.revisions where visit=v.id and event='visit' order by version desc limit 1) h on true where usage_review.allowed() order by v.day desc,v.reference
$$;
create function usage_review.detail(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',v.id,'reference',v.reference,'patient',v.patient,'office',v.office,'day',v.day,'source',v.source,'original',v.original,
 'entries',(select jsonb_agg(jsonb_build_object('key',e.event,'original',e.original,'version',coalesce(r.version,0),
 'current',coalesce(r.current_values,e.original->'fields','{}'::jsonb),'history',coalesce((select jsonb_agg(jsonb_build_object('version',h.version,'by',h.reviewer,'at',h.at,'source',h.evidence,'reason',h.reason,'before',h.previous,'after',h.current_values,'restored',h.restored_version) order by h.version desc) from usage_review.revisions h where h.visit=e.visit and h.event=e.event),'[]'::jsonb))
 order by (e.event='visit') desc,e.event) from usage_review.entries e left join lateral
 (select * from usage_review.revisions h where h.visit=e.visit and h.event=e.event order by version desc limit 1) r on true where e.visit=v.id))
 from usage_review.visits v where v.id=target and usage_review.allowed()
$$;

create function usage_review.change(target uuid,event_key text,expected int,edits jsonb,citation text,reason text,restore_to int,commit_changes boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e usage_review.entries; v usage_review.visits; old jsonb; proposed jsonb; field text; val jsonb; current_version int;
 actor_name text; delta jsonb; existing bool; other_matches jsonb; new_event boolean;
begin
 if not usage_review.allowed() then raise insufficient_privilege; end if;
 if commit_changes is null or expected is null or expected<0 or event_key is null or length(event_key) not between 1 and 180
 or nullif(trim(citation),'') is null or length(citation)>2000 or nullif(trim(reason),'') is null or length(reason)>2000
 then raise exception 'Supply a dated source, document/page or note reference, and the reason.'; end if;
 select * into strict v from usage_review.visits where id=target for update;
 select * into e from usage_review.entries where visit=target and event=event_key; existing:=found;
 new_event:=not existing;
 if new_event and (event_key !~ '^new:[a-z0-9][a-z0-9._/-]{1,120}$' or expected<>0 or restore_to is not null)
 then raise exception 'Select an existing event or provide a stable new source event reference.'; end if;
 select h.version,h.current_values into current_version,old from usage_review.revisions h where h.visit=target and h.event=event_key order by version desc limit 1;
 current_version:=coalesce(current_version,0); old:=coalesce(old,e.original->'fields','{}'::jsonb);
 if expected<>current_version then raise exception 'This event has changed. Reload it and review the latest revision.'; end if;
 if restore_to is not null then
   if restore_to<0 or restore_to>=current_version or edits<>'{}'::jsonb then raise exception 'Choose a prior revision to restore.'; end if;
   if restore_to=0 then proposed:=coalesce(e.original->'fields','{}'::jsonb);
   else select current_values into strict proposed from usage_review.revisions h where h.visit=target and h.event=event_key and version=restore_to; end if;
 else
   if jsonb_typeof(edits) is distinct from 'object' or octet_length(edits::text)>22000 then raise exception 'Invalid field changes.'; end if;
   proposed:=old;
   for field,val in select * from jsonb_each(edits) loop
    if not (field=any(case when event_key='visit' then array['chart','patient_name','provider','review_note','placement'] else array['product','ref','lot','quantity','expiry','site','placement','review_note','kind'] end))
     or jsonb_typeof(val) is distinct from 'object' or coalesce(val->>'status','') not in ('Verified','Reported','On hold')
     or jsonb_typeof(val->'value') is distinct from 'string' or length(val->>'value')>2000
     or (val->>'status'<>'On hold' and nullif(trim(val->>'value'),'') is null)
    then raise exception 'Enter a supported field, its value and its evidence status.'; end if;
    if field='quantity' and val->>'value'<>'' and (val->>'value') !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Enter a numeric quantity; describe conflicting quantities in review notes.'; end if;
    if field='expiry' and val->>'value'<>'' then perform (val->>'value')::date; end if;
    proposed:=jsonb_set(proposed,array[field],jsonb_build_object('value',trim(val->>'value'),'status',val->>'status'),true);
   end loop;
 end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',old->k,'after',proposed->k)),'{}') into delta from
 (select jsonb_object_keys(old||proposed) k) keys where (old->k) is distinct from (proposed->k);
 if delta='{}'::jsonb then raise exception 'No field changes to save.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('visit',m.reference,'event',m.event)),'[]') into other_matches from (
  select ov.reference,oe.event from usage_review.entries oe join usage_review.visits ov on ov.id=oe.visit
  left join lateral (select h.current_values from usage_review.revisions h where h.visit=oe.visit and h.event=oe.event order by version desc limit 1) h on true
  where (oe.visit,oe.event)<>(target,event_key) and oe.event<>'visit' and nullif(trim(proposed#>>'{lot,value}'),'') is not null
  and lower(trim(coalesce(h.current_values,oe.original->'fields')#>>'{lot,value}'))=lower(trim(proposed#>>'{lot,value}'))
  order by ov.reference,oe.event limit 60) m;
 if commit_changes then
   select full_name into strict actor_name from public.user_profiles where id=auth.uid();
   if new_event then insert into usage_review.entries values(target,event_key,jsonb_build_object('fields','{}'::jsonb,'source_ref',substring(event_key from 5))); end if;
   insert into usage_review.revisions values(target,event_key,current_version+1,auth.uid(),actor_name,clock_timestamp(),trim(citation),trim(reason),old,proposed,restore_to);
 end if;
 return jsonb_build_object('version',current_version,'changes',delta,'matches',other_matches,'stock',0,'movements',0,'cost',0);
end $$;

create function usage_review.new_visit(patient_id text,office_name text,service_day date,source_ref text,commit_changes boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v usage_review.visits; who text; new_id uuid;
begin
 if not usage_review.allowed() then raise insufficient_privilege; end if;
 if patient_id is null or patient_id !~ '^[0-9]{1,25}$' or service_day is null or service_day>(now() at time zone 'America/New_York')::date
 or not exists(select 1 from public.offices where name=office_name and is_active)
 or nullif(trim(source_ref),'') is null or length(source_ref)>2000 or commit_changes is null then raise exception 'Enter the Ascend patient ID, office, service date and dated source reference.';end if;
 perform pg_advisory_xact_lock(hashtextextended(patient_id||'/'||office_name||'/'||service_day::text,44));
 select * into v from usage_review.visits where patient=patient_id and office=office_name and day=service_day;
 if found then return jsonb_build_object('id',v.id,'reference',v.reference,'matched',true); end if;
 if not commit_changes then return jsonb_build_object('matched',false,'stock',0,'cost',0);end if;
 select full_name into strict who from public.user_profiles where id=auth.uid();
 new_id:=gen_random_uuid();
 insert into usage_review.visits(id,reference,patient,office,day,original,source,added_by)
 values(new_id,'H-'||new_id::text,patient_id,office_name,service_day,jsonb_build_object('reviewer',who,'docs','[]'::jsonb,'flags','[]'::jsonb,'questions','[]'::jsonb),trim(source_ref),auth.uid()) returning * into v;
 insert into usage_review.entries values(v.id,'visit',jsonb_build_object('fields','{}'::jsonb));
 return jsonb_build_object('id',v.id,'reference',v.reference,'matched',false);
end $$;
create function public.historical_usage_visits() returns table(id uuid,reference text,patient text,chart text,patient_name text,office text,day date,open_questions int) language sql stable security invoker set search_path='' as $$select * from usage_review.list_visits()$$;
create function public.historical_usage_detail(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$select usage_review.detail(target)$$;
create function public.historical_usage_change(target uuid,event_key text,expected int,edits jsonb,citation text,reason text,restore_to int,commit_changes boolean)
returns jsonb language sql security invoker set search_path='' as $$select usage_review.change(target,event_key,expected,edits,citation,reason,restore_to,commit_changes)$$;
create function public.historical_usage_new_visit(patient_id text,office_name text,service_day date,source_ref text,commit_changes boolean)
returns jsonb language sql security invoker set search_path='' as $$select usage_review.new_visit(patient_id,office_name,service_day,source_ref,commit_changes)$$;
revoke all on all functions in schema usage_review from public,anon,authenticated;
grant execute on function usage_review.list_visits(),usage_review.detail(uuid),usage_review.change(uuid,text,int,jsonb,text,text,int,boolean),usage_review.new_visit(text,text,date,text,boolean) to authenticated;
revoke all on function public.historical_usage_visits(),public.historical_usage_detail(uuid),public.historical_usage_change(uuid,text,int,jsonb,text,text,int,boolean),public.historical_usage_new_visit(text,text,date,text,boolean) from public,anon,authenticated;
grant execute on function public.historical_usage_visits(),public.historical_usage_detail(uuid),public.historical_usage_change(uuid,text,int,jsonb,text,text,int,boolean),public.historical_usage_new_visit(text,text,date,text,boolean) to authenticated;
create table usage_review.snapshots (
 name text primary key, contents jsonb not null, refreshed_at timestamptz not null default clock_timestamp()
);
alter table usage_review.snapshots enable row level security;
revoke all on usage_review.snapshots from public, anon, authenticated;
create function usage_review.discovery() returns jsonb language sql stable security definer set search_path='' as $$
 select contents from usage_review.snapshots where name='discovery' and usage_review.allowed()
$$;
create function public.historical_usage_discovery() returns jsonb language sql stable security invoker set search_path='' as $$ select usage_review.discovery() $$;
create function usage_review.allocation() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.user_profiles where id=auth.uid() and is_active and is_approved and lower(status)='active' and has_executive_view and "dashboard:executive_overview") then raise insufficient_privilege; end if;
 select jsonb_build_object('finance',s.contents,'orders',coalesce((select jsonb_agg(to_jsonb(g)) from (
 select to_char(order_date,'YYYY-MM') as month,allocated_office as office,case when product_category='Membrane' then 'Tissue / membrane' else product_category end as kind,count(*) as lines,sum(allocated_qty) as qty,round(sum(allocated_cost)*100) as cost,count(allocated_cost) as priced
 from public.implant_grafting_order_allocations where product_category in ('Bone','Membrane','Tissue','Implant') group by 1,2,3) g),'[]'::jsonb),'usage',coalesce((
  select jsonb_agg(to_jsonb(grouped)) from (
   select u.month,u.office,u.provider,u.kind,u.product,count(*) as entries,sum(qty) as logged_qty,count(*) filter(where qty is null) as missing_qty,
    count(*) filter(where e.event is not null) as linked_entries,
    count(*) filter(where exists(select 1 from jsonb_each(coalesce(r.current_values,e.original->'fields','{}')) as f where f.value->>'status'='On hold') or jsonb_array_length(coalesce(v.original->'priority','[]'))>0) as held_entries,
    count(*) filter(where r.current_values#>>'{quantity,status}'='Verified' and r.current_values#>>'{quantity,value}' ~ '^[0-9]+([.][0-9]+)?$') as verified_entries,
    sum(case when r.current_values#>>'{quantity,status}'='Verified' and r.current_values#>>'{quantity,value}' ~ '^[0-9]+([.][0-9]+)?$' then (r.current_values#>>'{quantity,value}')::numeric end) as verified_qty
   from (
    select id,to_char(procedure_date,'YYYY-MM') as month,coalesce(nullif(trim(office_name),''),'Unassigned office') as office,coalesce(nullif(trim(provider_name),''),'Unassigned provider') as provider,
     case when lower(bone_tissue_type) like '%bone%' then 'Bone' when lower(bone_tissue_type) ~ 'tissue|membrane' then 'Tissue / membrane' else coalesce(nullif(trim(bone_tissue_type),''),'Unclassified') end as kind,
     coalesce(nullif(trim(product_name),''),'Unspecified product') as product,quantity_used::numeric as qty from public.bone_tissue_usage_log
    union all select id,to_char(procedure_date,'YYYY-MM'),coalesce(nullif(trim(office_name),''),'Unassigned office'),coalesce(nullif(trim(provider_name),''),'Unassigned provider'),'Implant',coalesce(nullif(concat_ws(' ',nullif(trim(company_name),''),nullif(trim(system_name),'')),''),'Unspecified implant'),null::numeric from public.implant_usage_logs
   ) u left join usage_review.entries e on e.event='unit:'||u.id::text left join usage_review.visits v on v.id=e.visit
   left join lateral (select h.current_values from usage_review.revisions h where h.visit=e.visit and h.event=e.event order by version desc limit 1) r on true
   group by u.month,u.office,u.provider,u.kind,u.product
  ) grouped),'[]'::jsonb)) into result from usage_review.snapshots s where s.name='finance';
 return result;
end $$;
create index usage_review_event_match on usage_review.entries(event);
create function public.material_usage_allocation() returns jsonb language sql stable security invoker set search_path='' as $$ select usage_review.allocation() $$;
revoke all on function usage_review.discovery(),public.historical_usage_discovery(),usage_review.allocation(),public.material_usage_allocation() from public,anon,authenticated;
grant execute on function usage_review.discovery(),public.historical_usage_discovery(),usage_review.allocation(),public.material_usage_allocation() to authenticated;

create table usage_review.source_files (
 reference text primary key, contents bytea not null, format text not null, actor uuid not null,
 reviewer text not null, at timestamptz not null default clock_timestamp()
);
alter table usage_review.source_files enable row level security;
revoke all on usage_review.source_files from public,anon,authenticated;
create function usage_review.evidence() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('path',reference,'at',at,'reviewer',reviewer) order by at desc),'[]'::jsonb)
 from usage_review.source_files where usage_review.allowed()
$$;
create function usage_review.archive_file(file_format text,encoded text) returns text language plpgsql security definer set search_path='' as $$
declare b bytea; file_key text; person text;
begin
 if not usage_review.allowed() then raise insufficient_privilege;end if;
 if file_format is null or file_format not in ('xlsx','pdf') or encoded is null or length(encoded) not between 8 and 11184812 then raise exception 'Select a PDF or XLSX of up to 8 MB.';end if;
 b:=decode(encoded,'base64');
 if octet_length(b)>8388608 or (file_format='xlsx' and substring(b from 1 for 4)<>decode('504b0304','hex')) or (file_format='pdf' and substring(b from 1 for 5)<>convert_to('%PDF-','UTF8')) then raise exception 'Source size or format is invalid.';end if;
 file_key:=encode(sha256(b),'hex')||'.'||file_format;
 select full_name into strict person from public.user_profiles where id=auth.uid();
 insert into usage_review.source_files(reference,contents,format,actor,reviewer) values(file_key,b,file_format,auth.uid(),person) on conflict (reference) do nothing;
 return file_key;
end $$;
create function usage_review.source_file(file_reference text) returns text language sql stable security definer set search_path='' as $$
 select encode(contents,'base64') from usage_review.source_files where reference=file_reference and usage_review.allowed()
$$;
create function public.historical_usage_evidence() returns jsonb language sql stable security invoker set search_path='' as $$ select usage_review.evidence() $$;
create function public.historical_usage_archive_file(file_format text,encoded text) returns text language sql security invoker set search_path='' as $$ select usage_review.archive_file(file_format,encoded) $$;
create function public.historical_usage_source_file(file_reference text) returns text language sql stable security invoker set search_path='' as $$ select usage_review.source_file(file_reference) $$;
revoke all on function usage_review.evidence(),public.historical_usage_evidence(),usage_review.archive_file(text,text),public.historical_usage_archive_file(text,text),usage_review.source_file(text),public.historical_usage_source_file(text) from public,anon,authenticated;
grant execute on function usage_review.evidence(),public.historical_usage_evidence(),usage_review.archive_file(text,text),public.historical_usage_archive_file(text,text),usage_review.source_file(text),public.historical_usage_source_file(text) to authenticated;


notify pgrst,'reload schema';
