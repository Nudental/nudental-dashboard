-- Stable source-occurrence links and append-only lifecycle for historical annotations.
create table usage_review.event_sources(
 anchor text primary key, visit uuid not null, event text not null,
 actor uuid not null, reviewer text not null, linked_at timestamptz not null default clock_timestamp(),
 citation text not null, reason text not null,
 foreign key(visit,event) references usage_review.entries
);
create index event_sources_by_event on usage_review.event_sources(visit,event);
create table usage_review.event_actions(
 visit uuid not null,event text not null, seq integer not null, action text not null,
 state text not null check(state in ('On hold','Active','Voided','Linked')),
 actor uuid not null,reviewer text not null,at timestamptz not null default clock_timestamp(),
 citation text not null,reason text not null, anchors text[] not null, primary key(visit,event,seq),
 foreign key(visit,event) references usage_review.entries
);
alter table usage_review.event_sources enable row level security;
alter table usage_review.event_actions enable row level security;
revoke all on usage_review.event_sources,usage_review.event_actions from public,anon,authenticated;

create function usage_review.guard_source_entry() returns trigger language plpgsql set search_path='' as $$
begin
 if new.event like 'new:%' and not (new.original ? 'anchor') then
   raise exception 'Reload Historical usage and use the source-event preview before saving.';
 end if;
 return new;
end $$;
create trigger require_source_event before insert on usage_review.entries for each row execute function usage_review.guard_source_entry();

create function usage_review.guard_event_revision() returns trigger language plpgsql set search_path='' as $$
declare state_now text;
begin
 if new.event not like 'new:%' then return new;end if;
 select a.state into state_now from usage_review.event_actions a where a.visit=new.visit and a.event=new.event order by seq desc limit 1;
 if state_now='Voided' or new.restored_version=0 then raise exception 'Use event controls to void or restore a separate source event.';end if;
 if state_now='Active' and (new.current_values-'review_note') is distinct from (new.previous-'review_note') then
 raise exception 'Put this event on hold before changing its material fields.';end if;
 return new;
end $$;
create trigger check_event_revision before insert on usage_review.revisions for each row execute function usage_review.guard_event_revision();

create function usage_review.event_info(target uuid) returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_object_agg(e.event,jsonb_build_object('state',a.state,'sources',coalesce(s.refs,'[]'),'actions',a.history)),'{}')
from usage_review.entries e
cross join lateral (select (array_agg(h.state order by h.seq desc))[1] state,jsonb_agg(jsonb_build_object('seq',h.seq,'action',h.action,'state',h.state,'by',h.reviewer,'at',h.at,'source',h.citation,'reason',h.reason,'anchors',h.anchors) order by h.seq desc) history from usage_review.event_actions h where h.visit=e.visit and h.event=e.event) a
left join lateral (select jsonb_agg(anchor order by anchor) refs from usage_review.event_sources where visit=e.visit and event=e.event) s on true
where e.visit=target and a.state is not null and usage_review.allowed()
$$;
create function usage_review.event_step(target uuid, operation text, event_key text, source_refs text[], material text, lot text, citation text, reason text, preview_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v usage_review.visits; entry usage_review.entries; k text; refs text[]; anchor text; compare_refs text[]; prev text; dest text; before_fields jsonb; after_fields jsonb;
 claims jsonb; potential_matches jsonb; result jsonb; signature text; person text; rev int; logseq int; field_lot text;
begin
 if not usage_review.allowed() then raise insufficient_privilege;end if;
 if operation is null or operation not in ('create','attach','void','restore','confirm','hold') or nullif(btrim(citation),'') is null or length(citation)>2000 or nullif(btrim(reason),'') is null or length(reason)>2000 then raise exception 'Supply a dated source citation and a reason for the action.';end if;
 if coalesce(cardinality(source_refs),0)>24 then raise exception 'Use up to 24 source occurrences at a time.';end if;
 if exists(select from unnest(source_refs) s where s is null or length(s)>160 or lower(btrim(s)) !~ '^(note:[a-z0-9_-]+|doc:[a-z0-9_-]+|file:[a-f0-9]{64})/p[1-9][0-9]{0,4}/use[1-9][0-9]{0,3}$') then raise exception 'Use a note, document or archived file reference with a page and occurrence number.';end if;
 select coalesce(array_agg(distinct lower(btrim(s)) order by lower(btrim(s))),'{}'::text[]) into refs from unnest(source_refs) s;
 if (operation in ('create','attach'))<>(cardinality(refs)>0) then raise exception 'Provide source occurrence references for creation or evidence linking.';end if;
 if exists(select from unnest(refs) r where r like 'file:%' and not exists(select from usage_review.source_files f where split_part(f.reference,'.',1)=substring(split_part(r,'/',1) from 6))) then raise exception 'Archive the source file before using its reference.';end if;
 if operation='create' and (nullif(btrim(material),'') is null or length(material)>140 or length(coalesce(lot,''))>240) then raise exception 'Describe the material or enter Unknown material.';end if;
 -- Every lifecycle operation rechecks source ownership and candidate matches under the same lock.
 perform pg_advisory_xact_lock(187361248, 1567);
 select * into strict v from usage_review.visits where id=target for update;
 anchor:=lower(btrim(source_refs[1]));
 k:=case when operation='create' then 'new:'||anchor else event_key end;
 select * into entry from usage_review.entries where visit=target and event=k;
 if operation<>'create' and (entry.event is null or (operation='attach' and k not like 'new:%' and k not like 'unit:%') or (operation<>'attach' and k not like 'new:%')) then raise exception 'Select the existing material event.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('reference',vv.reference,'target',s.visit,'event',s.event,'source',s.anchor) order by s.anchor),'[]') into claims
 from usage_review.event_sources s join usage_review.visits vv on vv.id=s.visit where s.anchor=any(refs);
 if (operation='create' and (jsonb_array_length(claims)>0 or entry.event is not null)) or
 (operation='attach' and exists(select from usage_review.event_sources s where s.anchor=any(refs) and (s.visit,s.event)<>(target,k))) then
 return jsonb_build_object('blocked',true,'message','A source occurrence already belongs to a historical event. Open its record to review or link further evidence.','owners',claims);
 end if;
 if operation='attach' and jsonb_array_length(claims)=cardinality(refs) then return jsonb_build_object('blocked',true,'message','These sources are already linked. No additional event or revision is needed.','owners',claims);end if;
 select h.seq,h.state into logseq,prev from usage_review.event_actions h where h.visit=target and h.event=k order by h.seq desc limit 1;
 prev:=coalesce(prev,case when operation='create' then 'Absent' else 'Linked' end);logseq:=coalesce(logseq,0);
 dest:=case operation when 'create' then 'On hold' when 'void' then 'Voided' when 'restore' then 'On hold' when 'confirm' then 'Active' when 'hold' then 'On hold' else prev end;
 if (operation='restore' and prev<>'Voided') or (operation='confirm' and prev<>'On hold') or (operation='hold' and prev<>'Active') or (operation='void' and prev not in ('On hold','Active')) or (operation='attach' and prev='Voided') then raise exception 'This action does not apply to the current event state. Refresh the visit.';end if;
 select h.version,h.current_values into rev,before_fields from usage_review.revisions h where h.visit=target and h.event=k order by version desc limit 1;
 rev:=coalesce(rev,0);before_fields:=coalesce(before_fields,entry.original->'fields','{}'::jsonb);
 after_fields:=before_fields;
 if operation='create' then
  after_fields:=jsonb_build_object('kind',jsonb_build_object('value',btrim(material),'status','Reported'));
  if nullif(btrim(lot),'') is not null then after_fields:=after_fields||jsonb_build_object('lot',jsonb_build_object('value',btrim(lot),'status','Reported'));end if;
 end if;
 select coalesce(array_agg(distinct ref),'{}'::text[]) into compare_refs from (
 select unnest(refs) ref union select es.anchor from usage_review.event_sources es where es.visit=target and es.event=k) known;
 field_lot:=nullif(regexp_replace(lower(after_fields#>>'{lot,value}'),'[^a-z0-9]','','g'),'');
 select coalesce(jsonb_agg(jsonb_build_object('reference',m.reference,'target',m.id,'event',m.event,'label',m.label,'why',m.why) order by m.reference,m.event),'[]') into potential_matches from (
 select vv.reference,vv.id,e.event,coalesce(e.original->>'title',e.original->>'source_ref',e.event) label,
 concat_ws(' / ',case when vv.id=target then 'Same encounter' end,case when matches.by_lot then 'Same lot' end,case when matches.by_page then 'Same source page' end) why
 from usage_review.entries e join usage_review.visits vv on vv.id=e.visit
 left join lateral(select current_values from usage_review.revisions where visit=e.visit and event=e.event order by version desc limit 1) h on true
 cross join lateral(select field_lot is not null and field_lot in (regexp_replace(lower(e.original#>>'{fields,lot,value}'),'[^a-z0-9]','','g'),regexp_replace(lower(h.current_values#>>'{lot,value}'),'[^a-z0-9]','','g')) by_lot,
 exists(select from jsonb_array_elements(coalesce(e.original->'sources','[]')) a,unnest(compare_refs) ref where split_part(ref,'/use',1)='doc:'||lower(a->>'id')||'/p'||(a->>'page')) or
 exists(select from usage_review.event_sources s,unnest(compare_refs) ref where (s.visit,s.event)=(e.visit,e.event) and split_part(ref,'/use',1)=split_part(s.anchor,'/use',1)) by_page) matches
 where (e.event like 'unit:%' or e.event like 'new:%') and (vv.id,e.event)<>(target,k) and (vv.id=target or matches.by_lot or matches.by_page)
 ) m;
 select full_name into strict person from public.user_profiles where id=auth.uid();
 result:=jsonb_build_object('operation',operation,'key',k,'reference',v.reference,'before',prev,'after',dest,'fieldsBefore',before_fields,'fieldsAfter',after_fields,'matches',potential_matches,'sources',compare_refs,'requestedSources',refs,'reviewer',person,'source',btrim(citation),'reason',btrim(reason),'stock',0,'movements',0,'receipts',0,'cost',0,'fieldVersion',rev,'eventVersion',logseq);
 signature:=encode(sha256(convert_to(result::text,'utf8')),'hex');
 if preview_token is null then return result||jsonb_build_object('token',signature);end if;
 if preview_token<>signature then raise exception 'The event or its possible matches changed. Preview again before saving.';end if;
 if operation='create' then
  insert into usage_review.entries values(target,k,jsonb_build_object('title',btrim(material),'type','Separate historical source event','anchor',anchor,'source_ref',anchor,'fields','{}'::jsonb));
 end if;
 foreach anchor in array refs loop
  insert into usage_review.event_sources(anchor,visit,event,actor,reviewer,citation,reason) values(anchor,target,k,auth.uid(),person,btrim(citation),btrim(reason)) on conflict do nothing;
 end loop;
 insert into usage_review.event_actions values(target,k,logseq+1,operation,dest,auth.uid(),person,clock_timestamp(),btrim(citation),btrim(reason),refs);
 if operation='create' then insert into usage_review.revisions values(target,k,1,auth.uid(),person,clock_timestamp(),btrim(citation),btrim(reason),'{}',after_fields,null);end if;
 return result||jsonb_build_object('saved',true);
end $$;

create function public.historical_usage_event_step(target uuid,operation text,event_key text,source_refs text[],material text,lot text,citation text,reason text,preview_token text)
returns jsonb language sql security invoker set search_path='' as $$ select usage_review.event_step(target,operation,event_key,source_refs,material,lot,citation,reason,preview_token) $$;
create function public.historical_usage_event_info(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select usage_review.event_info(target) $$;
create function usage_review.event_demo() returns jsonb language sql stable security definer set search_path='' as $$ select contents from usage_review.snapshots where name='source-event-demonstration' and usage_review.allowed() $$;
create function public.historical_usage_event_demo() returns jsonb language sql stable security invoker set search_path='' as $$ select usage_review.event_demo() $$;
revoke all on function usage_review.guard_source_entry(),usage_review.guard_event_revision(),usage_review.event_info(uuid),usage_review.event_step(uuid,text,text,text[],text,text,text,text,text),usage_review.event_demo(),public.historical_usage_event_info(uuid),public.historical_usage_event_step(uuid,text,text,text[],text,text,text,text,text),public.historical_usage_event_demo() from public,anon,authenticated;
grant execute on function usage_review.event_info(uuid),usage_review.event_step(uuid,text,text,text[],text,text,text,text,text),usage_review.event_demo(),public.historical_usage_event_info(uuid),public.historical_usage_event_step(uuid,text,text,text[],text,text,text,text,text),public.historical_usage_event_demo() to authenticated;
notify pgrst,'reload schema';
