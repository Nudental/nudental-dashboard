-- Extend existing requests. Monthly batches and historical vendor orders keep their original meaning.
create schema supply_routing;
revoke all on schema supply_routing from public, anon, authenticated;
grant usage on schema supply_routing to authenticated;

alter table public.order_requests
  add column supply_route text check (supply_route in ('edgeendo','oralb','amazon','dental')),
  add column supply_office uuid references public.offices,
  add column supply_stage text check (supply_stage in ('Submitted','Approved','Ordered','Declined')),
  add column supply_parent uuid references public.order_requests,
  add column supply_lines int[],
  add column supply_history jsonb,
  add column supply_reference text,
  add column supply_office_email text;
create index supply_route_parent_idx on public.order_requests(supply_parent) where supply_parent is not null;
create index supply_route_queue_idx on public.order_requests(supply_route,created_at desc) where supply_route is not null;

-- Legacy direct writes retain their previous policies and notifications.
-- Routed requests can only be changed through the checked operations below.
create policy routed_requests_private on public.order_requests as restrictive for all to authenticated,anon
using (supply_route is null) with check (supply_route is null);
drop trigger trg_order_request_notify on public.order_requests;
create trigger trg_order_request_notify after insert on public.order_requests for each row
when (new.supply_route is null) execute function public.notify_order_request_inserted();

create table supply_routing.delegates (
  office_id uuid not null references public.offices,
  user_id uuid not null references public.user_profiles,
  primary key (office_id,user_id)
);
insert into supply_routing.delegates(office_id,user_id)
select o.id,nominee.id::uuid from (values
 ('Brick','62ce677b-d986-4768-b362-b9c5dc9e431b'),
 ('Brick','5c29c9cc-6db1-4368-9bc6-ff058f32dc20'),
 ('Brick','4df66747-609f-45ae-b025-7ab20ebb4199'),
 ('Staten Island','8c3cb391-51e6-4a7b-9e22-aff625f93e50')
) nominee(office,id) join public.offices o on o.name=nominee.office;
alter table supply_routing.delegates enable row level security;
revoke all on supply_routing.delegates from public, anon, authenticated;

create view supply_routing.staff as
select p.id,p.full_name,p.role,p.job_title,p.office_id from public.user_profiles p
where p.is_active and p.is_approved and p.status='Active';
create view supply_routing.office_staff as
select p.id,p.full_name,p.job_title,p.role,o.id office_id,o.name office_name,
  ((p.role='office_manager' or lower(p.job_title)='office manager')
    and lower(trim(p.full_name)) <> lower(o.name||' Office Manager')) as named_manager
from supply_routing.staff p join public.offices o on o.is_active and
 (o.id=p.office_id or exists (select 1 from public.user_office_assignments a
    where a.user_id=p.id and (a.office_id=o.id or a.all_offices)))
where o.name in ('Eatontown','Brick','Barnegat','Staten Island');

create function supply_routing.reviewer(route text) returns uuid language sql immutable set search_path='' as $$
 select case route when 'amazon' then '2954e9e7-9b8a-4ed3-a624-71f91c36d2c3'::uuid
 when 'dental' then 'e86cd3c5-22bc-4a04-ba30-ef173479a49b'::uuid
 when 'edgeendo' then 'c54cedd6-982b-4992-a93a-4188aae288a7'::uuid
 when 'oralb' then 'c54cedd6-982b-4992-a93a-4188aae288a7'::uuid end
$$;
create view supply_routing.submit_options as
select s.id user_id, s.office_id, s.office_name, t.route from supply_routing.office_staff s
cross join (values ('edgeendo'),('oralb'),('amazon'),('dental')) t(route)
where case
 when t.route in ('edgeendo','oralb') then s.id=supply_routing.reviewer('dental')
 when t.route='amazon' then s.named_manager
 else lower(coalesce(s.job_title,'')) ~ '(^|[^a-z])(rda|da|rdh|back staff|back office|dental ass(istant|t)|sterilization tech(nician)?|dental hygienist)([^a-z]|$)'
   or exists(select 1 from staff_scan_private.assistants a where a.user_id=s.id)
end
union
select p.id,o.id,o.name,'amazon' from supply_routing.delegates d
join supply_routing.staff p on p.id=d.user_id join public.offices o on o.id=d.office_id and o.is_active
where not exists(select 1 from supply_routing.office_staff m where m.office_id=o.id and m.named_manager);

create view supply_routing.mailboxes as
select o.id office_id,p.email office_email from public.offices o join public.user_profiles p
 on p.office_id=o.id and lower(p.full_name)=lower(o.name||' Office Manager') and p.is_active and p.is_approved and p.status='Active';

create function supply_routing.context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('options',coalesce((select jsonb_agg(jsonb_build_object('office',office_id,'name',office_name,'route',route,'email',(select m.office_email from supply_routing.mailboxes m where m.office_id=s.office_id)) order by office_name,route)
 from supply_routing.submit_options s where user_id=auth.uid()),'[]'::jsonb),
 'review',coalesce((select jsonb_agg(r) from unnest(array['edgeendo','oralb','amazon','dental']) r
 where exists(select 1 from supply_routing.staff s where s.id=auth.uid() and s.id=supply_routing.reviewer(r))),'[]'::jsonb))
$$;

create function supply_routing.event(label text, note text default null) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('status',label,'at',now(),'by',s.full_name,'actor_id',s.id,'note',nullif(trim(note),''))))
 from supply_routing.staff s where s.id=auth.uid()
$$;
create function supply_routing.inbox(recipient uuid, office uuid, request_id uuid, title text, body text) returns void
language sql set search_path='' as $$
 insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
 values(recipient,office,'supply_request',title,body,jsonb_build_object('route','/request-supplies','request_id',request_id))
$$;
create function supply_routing.add_request(request_id uuid, office uuid, route text, lines jsonb, memo text,
 parent_id uuid default null, positions int[] default null) returns uuid
language plpgsql set search_path='' as $$
declare person supply_routing.staff; office_label text; mailbox text; prior public.order_requests; item jsonb;
begin
 select * into strict person from supply_routing.staff where id=auth.uid();
 if not exists(select 1 from supply_routing.submit_options s where s.user_id=person.id and s.office_id=office and s.route=add_request.route)
 then raise exception 'Your account cannot submit this request type for this office.'; end if;
 if not exists(select 1 from supply_routing.staff where id=supply_routing.reviewer(route)) then raise exception 'The assigned reviewer is unavailable.'; end if;
 if request_id is null or lines is null or jsonb_typeof(lines)<>'array' or jsonb_array_length(lines) not between 1 and 50 or octet_length(lines::text)>100000 or length(memo)>2000 then
 raise exception 'Enter 1 to 50 items and keep the request note under 2,000 characters.'; end if;
 for item in select value from jsonb_array_elements(lines) loop
  if jsonb_typeof(item)<>'object' or coalesce(length(trim(item->>'item_name')),0) not between 1 and 200
   or coalesce(item->>'requested_qty','') !~ '^[1-9][0-9]{0,4}$' or length(item->>'unit_type')>60
   or length(item->>'specs')>1000 or length(item->>'url')>2000
   or (coalesce(item->>'url','')<>'' and (item->>'url') !~* '^https?://[^[:space:]/]+(/[^[:space:]]*)?$')
  then raise exception 'Check item names, whole quantities, product links and specifications.'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,22));
 select * into prior from public.order_requests where id=request_id;
 if found then
  if (prior.submitted_by_id,prior.supply_office,prior.supply_route,prior.items,prior.notes,prior.supply_parent,prior.supply_lines)
    is distinct from (person.id,office,route,lines,nullif(trim(memo),''),parent_id,positions)
  then raise exception 'This submission reference was already used. Refresh and try again.'; end if;
  return prior.id;
 end if;
 select name into strict office_label from public.offices where id=office and is_active;
 if route='amazon' then select office_email into strict mailbox from supply_routing.mailboxes where office_id=office; end if;
 insert into public.order_requests(id,office_name,request_type,submitted_by_id,submitted_by_name,items,notes,supply_route,supply_office,supply_stage,supply_parent,supply_lines,supply_history,supply_office_email)
 values(request_id,'Nu Dental of '||office_label,case when route='amazon' then 'Front Desk' else 'Dental Supply' end::public.order_request_type,
 person.id,person.full_name,lines,nullif(trim(memo),''),route,office,'Submitted',parent_id,positions,supply_routing.event('Submitted'),mailbox);
 perform supply_routing.inbox(supply_routing.reviewer(route),office,request_id,'Supply request from '||office_label,person.full_name||' submitted a request. Open Request Supplies to review it.');
 return request_id;
end $$;

create function supply_routing.submit(request_id uuid, office uuid, route text, lines jsonb, memo text) returns uuid
language sql security definer set search_path='' as $$ select supply_routing.add_request(request_id,office,route,lines,memo) $$;

create function supply_routing.forward(request_id uuid, parent_id uuid, route text, positions int[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare parent public.order_requests; picked jsonb; sorted int[]; result uuid;
begin
 if auth.uid() is distinct from supply_routing.reviewer('dental') or route is null or route not in ('edgeendo','oralb')
 then raise exception 'Only Maia can forward these items to Caitlin.'; end if;
 select * into strict parent from public.order_requests where id=parent_id and supply_route='dental' for update;
 select array_agg(distinct x order by x) into sorted from unnest(positions) x;
 if sorted is null or array_position(sorted,null) is not null or sorted[1]<1 or sorted[cardinality(sorted)]>jsonb_array_length(parent.items)
 or request_id is null or request_id=parent_id then raise exception 'Select items from the original request.'; end if;
 select jsonb_agg(parent.items->(x-1) order by x) into picked from unnest(sorted) x;
 if not exists(select 1 from public.order_requests where id=request_id and supply_parent=parent_id) then
  if parent.supply_stage<>'Submitted' or exists(select 1 from public.order_requests c where c.supply_parent=parent_id and c.supply_lines && sorted)
  then raise exception 'These items were already handled. Refresh the request.'; end if;
 end if;
 result:=supply_routing.add_request(request_id,parent.supply_office,route,picked,parent.notes,parent_id,sorted);
 return result;
end $$;

create function supply_routing.act(request_id uuid, action text, detail text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.order_requests; parent_submitter uuid; changes jsonb; count_forwarded int;
begin
 select * into strict r from public.order_requests where id=request_id and supply_route is not null for update;
 if not exists(select 1 from supply_routing.staff where id=auth.uid() and id=supply_routing.reviewer(r.supply_route)) or r.submitted_by_id=auth.uid()
 then raise exception 'Only the assigned reviewer can update this request.'; end if;
 if action is null or action not in ('Approved','Declined','Ordered') or length(detail)>1000 then raise exception 'Invalid request update.'; end if;
 if r.supply_stage=action then return; end if;
 select coalesce(sum(cardinality(c.supply_lines)),0) into count_forwarded from public.order_requests c where c.supply_parent=r.id;
 if count_forwarded=jsonb_array_length(r.items) then raise exception 'All items were forwarded to Caitlin.'; end if;
 if action='Declined' and nullif(trim(detail),'') is null then raise exception 'Enter a reason for declining.'; end if;
 if not ((r.supply_stage='Submitted' and action='Declined') or
         (r.supply_stage='Submitted' and r.supply_route<>'dental' and action='Approved') or
         (action='Ordered' and ((r.supply_stage='Submitted' and r.supply_route='dental') or r.supply_stage='Approved')))
 then raise exception 'This action is no longer available. Refresh the request.'; end if;
 changes:=supply_routing.event(action,detail);
 update public.order_requests set supply_stage=action,supply_history=supply_history||changes,
 supply_reference=case when action='Ordered' then nullif(trim(detail),'') else supply_reference end,
 req_status=(case action when 'Approved' then 'Acknowledged' when 'Declined' then 'Rejected' else 'In Progress' end)::public.order_request_status where id=r.id;
 perform supply_routing.inbox(r.submitted_by_id,r.supply_office,r.id,'Supply request · '||action,'Open Request Supplies for the latest status and notes.');
 if r.supply_parent is not null then
  select submitted_by_id into parent_submitter from public.order_requests where id=r.supply_parent;
  if parent_submitter is distinct from r.submitted_by_id then perform supply_routing.inbox(parent_submitter,r.supply_office,r.supply_parent,'Forwarded items · '||action,'Caitlin updated the forwarded items in your supply request.'); end if;
 end if;
end $$;

create function supply_routing.list_requests() returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'office',o.name,'route',r.supply_route,'stage',r.supply_stage,'items',r.items,
 'email',r.supply_office_email,'notes',r.notes,'requester',r.submitted_by_name,'mine',r.submitted_by_id=auth.uid(),'reviewer',rv.full_name,
 'assigned',rv.id=auth.uid(),'created',r.created_at,'history',r.supply_history,'reference',r.supply_reference,
 'parent',r.supply_parent,'positions',r.supply_lines,
 'forwarded',coalesce((select jsonb_agg(jsonb_build_object('route',c.supply_route,'stage',c.supply_stage,'positions',c.supply_lines,'history',c.supply_history,'reference',c.supply_reference) order by c.created_at)
 from public.order_requests c where c.supply_parent=r.id),'[]'::jsonb))
 from public.order_requests r join public.offices o on o.id=r.supply_office join public.user_profiles rv on rv.id=supply_routing.reviewer(r.supply_route)
 where exists(select 1 from supply_routing.staff s where s.id=auth.uid())
 and (r.submitted_by_id=auth.uid() or rv.id=auth.uid()) order by r.created_at desc,r.id
$$;
-- The public API only exposes checked operations for the signed-in identity.
create function public.routed_supply_context() returns jsonb language sql stable security invoker set search_path='' as $$select supply_routing.context()$$;
create function public.routed_supply_list() returns setof jsonb language sql stable security invoker set search_path='' as $$select * from supply_routing.list_requests()$$;
create function public.routed_supply_submit(request_id uuid, office uuid, route text, lines jsonb, memo text) returns uuid language sql security invoker set search_path='' as $$select supply_routing.submit(request_id,office,route,lines,memo)$$;
create function public.routed_supply_forward(request_id uuid,parent_id uuid,route text,positions int[]) returns uuid language sql security invoker set search_path='' as $$select supply_routing.forward(request_id,parent_id,route,positions)$$;
create function public.routed_supply_act(request_id uuid,action text,detail text) returns void language sql security invoker set search_path='' as $$select supply_routing.act(request_id,action,detail)$$;
revoke all on all tables in schema supply_routing from public,anon,authenticated;
revoke all on all functions in schema supply_routing from public,anon,authenticated;
grant execute on function supply_routing.context(),supply_routing.list_requests(),supply_routing.submit(uuid,uuid,text,jsonb,text),
 supply_routing.forward(uuid,uuid,text,int[]),supply_routing.act(uuid,text,text) to authenticated;
do $$declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'routed_supply_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
notify pgrst,'reload schema';
