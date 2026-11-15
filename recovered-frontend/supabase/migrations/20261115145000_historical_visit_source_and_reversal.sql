-- New historical actions and source reservations retain every original visit and entry.
create table usage_review.visit_source_claims (
  source_key text primary key,
  visit uuid not null references usage_review.visits(id),
  actor uuid not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create index visit_source_claims_by_visit on usage_review.visit_source_claims(visit);
create table usage_review.visit_actions (
  visit uuid not null references usage_review.visits(id),
  seq integer not null,
  action text not null check(action in ('create','void','restore')),
  actor uuid not null,
  reviewer text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  citation text not null,
  reason text not null,
  primary key(visit,seq)
);
alter table usage_review.visit_source_claims enable row level security;
alter table usage_review.visit_actions enable row level security;
revoke all on usage_review.visit_source_claims, usage_review.visit_actions from public,anon,authenticated;

create function usage_review.visit_source_keys(citation text) returns text[]
language sql immutable set search_path='' as $f$
 with input as (select lower(coalesce(citation,'')) s), keys(k) as (
 select 'source:'||m[1] from input,lateral regexp_matches(s,'(?:clinical[ -]+note|native[ -]+note|note|document|doc|slip)[[:space:]:#-]*(?:id[[:space:]:#-]*)?([0-9]{8,25})\M','g') m
 union select 'discovery:'||m[1] from input,lateral regexp_matches(s,'\m(d-[0-9a-f]{12})\M','g') m
 union select 'file:'||m[1] from input,lateral regexp_matches(s,'\m([0-9a-f]{64})\M','g') m
 union select 'source:'||trim(s) from input where trim(s) ~ '^[0-9]{8,25}$'
 ) select coalesce(array_agg(k order by k),'{}'::text[]) from keys
$f$;

create or replace function usage_review.new_visit(patient_id text,office_name text,service_day date,source_ref text,commit_changes boolean) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare
  v usage_review.visits; existing uuid; found_source uuid; candidate jsonb; item jsonb;
  ids text[]; cited text[]; candidate_ids text[]; who text; who_id uuid:=auth.uid();
  zero_effect jsonb:='{"stock":0,"movements":0,"receipts":0,"cost":0}';
begin
  if not usage_review.allowed() then raise insufficient_privilege; end if;
  if patient_id is null or patient_id !~ '^[0-9]{1,25}$' or service_day is null or service_day>(now() at time zone 'America/New_York')::date
     or not exists(select from public.offices where name=office_name and is_active) or nullif(trim(source_ref),'') is null or length(source_ref)>2000 or commit_changes is null
  then raise exception 'Enter the Ascend patient ID, office, service date and dated source reference.'; end if;
  perform pg_advisory_xact_lock(187361248,1567);
  cited:=usage_review.visit_source_keys(source_ref);
  ids:=cited;
  for item in select c from usage_review.snapshots s cross join lateral jsonb_array_elements(s.contents->'candidates') c where s.name='discovery'
  loop
    candidate_ids:=usage_review.visit_source_keys(concat_ws(' ',item->>'reference',(item->'sources')::text));
    if cited && candidate_ids then
      if item->>'patient' is distinct from patient_id or item->>'day' is distinct from service_day::text or
         (exists(select from public.offices where name=item->>'office') and item->>'office'<>office_name) then
        raise exception 'This source is linked to a different encounter. Check the restricted discovery record before proceeding.';
      end if;
      if candidate is not null and candidate->>'reference'<>item->>'reference' then raise exception 'Multiple discovery records match. Reconcile the source first.'; end if;
      candidate:=item; ids:=ids||candidate_ids;
    end if;
  end loop;
  if exists(select from unnest(cited) k where k like 'discovery:%' and (candidate is null or k<>'discovery:'||lower(candidate->>'reference'))) then
    raise exception 'Discovery reference not found. Check the reference in YTD discovery.';end if;
  if exists(select from unnest(cited) k where k like 'file:%' and not exists(select from usage_review.source_files f where split_part(f.reference,'.',1)=substr(k,6))) then
    raise exception 'Archive the evidence file before using its reference.';end if;
  select id into existing from usage_review.visits where (patient,office,day)=(patient_id,office_name,service_day);
  for found_source in
    select visit from usage_review.visit_source_claims where source_key=any(ids)
    union select visit from usage_review.event_sources where usage_review.visit_source_keys(anchor)&&ids
    union select old.id from usage_review.visits old where usage_review.visit_source_keys(old.source)&&ids
    or exists(select from jsonb_array_elements(coalesce(old.original->'docs','[]')) d where ('source:'||(d->>'id'))=any(ids))
  loop
    if found_source is distinct from existing then raise exception 'This source already belongs to a historical visit. Review the existing encounter.';end if;
  end loop;
  if existing is not null then
    select * into strict v from usage_review.visits where id=existing;
    return zero_effect||jsonb_build_object('id',v.id,'reference',v.reference,'matched',true);
  end if;
  if cardinality(ids)=0 then raise exception 'Include an Ascend note or document ID, a discovery reference, or an archived file reference.';end if;
  if not commit_changes then return zero_effect||jsonb_build_object('matched',false);end if;
  select full_name into strict who from public.user_profiles where id=who_id;
  existing:=gen_random_uuid();
  insert into usage_review.visits(id,reference,patient,office,day,original,source,added_by)
    values(existing,'H-'||existing::text,patient_id,office_name,service_day,jsonb_build_object('reviewer',who,'docs','[]'::jsonb,'flags','[]'::jsonb,'questions','[]'::jsonb),trim(source_ref),who_id) returning * into v;
  insert into usage_review.visit_source_claims(source_key,visit,actor) select distinct k,v.id,who_id from unnest(ids) k;
  insert into usage_review.entries values(v.id,'visit',jsonb_build_object('fields','{}'::jsonb));
  insert into usage_review.visit_actions(visit,seq,action,actor,reviewer,citation,reason) values(v.id,1,'create',who_id,who,trim(source_ref),'Added a separate historical review visit.');
  return zero_effect||jsonb_build_object('id',v.id,'reference',v.reference,'matched',false);
end $f$;

create function usage_review.shell_voided(target uuid) returns boolean language sql stable set search_path='' as $f$
 select coalesce((select action='void' from usage_review.visit_actions where visit=target order by seq desc limit 1),false)
$f$;

create function usage_review.shell_info(target uuid) returns jsonb language sql stable security definer set search_path='' as $f$
 select jsonb_build_object('state',case when usage_review.shell_voided(target) then 'Voided' else 'Open' end,
 'version',coalesce((select max(seq) from usage_review.visit_actions where visit=target),0),
 'actions',coalesce((select jsonb_agg(jsonb_build_object('seq',seq,'action',action,'by',reviewer,'at',recorded_at,'source',citation,'reason',reason) order by seq desc) from usage_review.visit_actions where visit=target),'[]'::jsonb))
 from usage_review.visits v where v.id=target and v.added_by is not null and v.reference like 'H-%' and usage_review.allowed()
$f$;
create function public.historical_usage_shell_info(target uuid) returns jsonb language sql stable security invoker set search_path='' as $f$ select usage_review.shell_info(target) $f$;

create function usage_review.shell_action(target uuid,operation text,expected integer,citation text,reason text,save boolean) returns jsonb
language plpgsql security definer set search_path='' as $f$
declare v usage_review.visits; last_action usage_review.visit_actions; dest text; who text; result jsonb;
begin
 if not usage_review.allowed() then raise insufficient_privilege;end if;
 if operation is null or operation not in ('void','restore') or expected is null or expected<0 or save is null or
  nullif(trim(citation),'') is null or length(citation)>2000 or nullif(trim(reason),'') is null or length(reason)>2000 then
  raise exception 'Choose a visit action and enter a source and reason.';end if;
 perform pg_advisory_xact_lock(187361248,1567);
 select * into strict v from usage_review.visits where id=target for update;
 if v.added_by is null or v.reference not like 'H-%' then raise exception 'Only a separately added historical visit can be voided or restored.';end if;
 select * into last_action from usage_review.visit_actions where visit=target order by seq desc limit 1;
 dest:=case when operation='void' then 'Voided' else 'Open' end;
 result:=jsonb_build_object('id',v.id,'after',dest,'stock',0,'movements',0,'receipts',0,'cost',0);
 if coalesce(last_action.seq,0)<>expected then
   if save and last_action.seq=expected+1 and last_action.action=operation and last_action.actor=auth.uid() and last_action.citation=trim(citation) and last_action.reason=trim(reason) then return result||'{"saved":true,"repeat":true}'::jsonb;end if;
   raise exception 'This visit has changed. Reopen it and preview the current action.';end if;
 if (operation='void')=coalesce(last_action.action='void',false) then raise exception 'This action does not apply to the current visit state.';end if;
 if operation='void' and exists(select from usage_review.entries e where e.visit=target and e.event<>'visit' and
   (select a.state from usage_review.event_actions a where (a.visit,a.event)=(e.visit,e.event) order by seq desc limit 1) is distinct from 'Voided')
 then raise exception 'Review and void each remaining material use before voiding its visit.';end if;
 if save then
   select full_name into strict who from public.user_profiles where id=auth.uid();
   insert into usage_review.visit_actions(visit,seq,action,actor,reviewer,citation,reason) values(target,expected+1,operation,auth.uid(),who,trim(citation),trim(reason));
 end if;
 return result||jsonb_build_object('saved',save);
end $f$;
create function public.historical_usage_shell_action(target uuid,operation text,expected integer,citation text,reason text,save boolean) returns jsonb language sql security invoker set search_path='' as $f$
 select usage_review.shell_action(target,operation,expected,citation,reason,save) $f$;

-- Keep the original clinical edit and event logic. Both functions already lock the visit row.
do $patch$
declare f regprocedure; code text; anchor constant text:='select * into strict v from usage_review.visits where id=target for update;'; extra text;
begin
 foreach f in array array['usage_review.change(uuid,text,integer,jsonb,text,text,integer,boolean)'::regprocedure,'usage_review.event_step(uuid,text,text,text[],text,text,text,text,text)'::regprocedure] loop
   code:=pg_get_functiondef(f);
   if (length(code)-length(replace(code,anchor,'')))/length(anchor)<>1 then raise exception 'Unexpected historical review function definition';end if;
   extra:=' if usage_review.shell_voided(target) then raise exception ''Restore this historical visit before editing it.'';end if;';
   if f='usage_review.event_step(uuid,text,text,text[],text,text,text,text,text)'::regprocedure then
     extra:=extra||' if exists(select from unnest(refs) r join usage_review.visit_source_claims c on c.source_key=any(usage_review.visit_source_keys(r)) where c.visit<>target) then raise exception ''This source belongs to a different historical visit.'';end if;';
   end if;
   execute replace(code,anchor,anchor||extra);
 end loop;
end $patch$;

revoke all on function usage_review.visit_source_keys(text),usage_review.shell_voided(uuid),usage_review.shell_info(uuid),usage_review.shell_action(uuid,text,integer,text,text,boolean),public.historical_usage_shell_info(uuid),public.historical_usage_shell_action(uuid,text,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function usage_review.shell_info(uuid),usage_review.shell_action(uuid,text,integer,text,text,boolean),public.historical_usage_shell_info(uuid),public.historical_usage_shell_action(uuid,text,integer,text,text,boolean) to authenticated;
create function usage_review.voided_shells() returns uuid[] language sql stable security definer set search_path='' as $f$
 select coalesce(array_agg(a.visit),'{}'::uuid[]) from (select distinct on (visit) visit,action from usage_review.visit_actions order by visit,seq desc) a where a.action='void' and usage_review.allowed()
$f$;
create function public.historical_usage_voided_shells() returns uuid[] language sql stable security invoker set search_path='' as $f$ select usage_review.voided_shells() $f$;
revoke all on function usage_review.voided_shells(),public.historical_usage_voided_shells() from public,anon,authenticated;
grant execute on function usage_review.voided_shells(),public.historical_usage_voided_shells() to authenticated;
notify pgrst,'reload schema';
