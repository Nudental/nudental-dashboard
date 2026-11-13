-- Keep the selected individual explicit. No shared office mailbox is a verifier.
create table insurance_internal.verifier_assignment (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references public.user_profiles(id)
);
revoke all on insurance_internal.verifier_assignment from public,anon,authenticated;
create function insurance_internal.current_verifier() returns table(user_id uuid,email text)
language sql stable security definer set search_path='' as $$
  select p.id,lower(trim(p.email)) from insurance_internal.verifier_assignment a
  join public.user_profiles p on p.id=a.user_id and p.role='insurance_verifier'
  where p.is_active and p.is_approved and p.status='Active' and nullif(trim(p.email),'') is not null
    and not exists(select 1 from public.offices o where lower(o.email)=lower(p.email))
    and not exists(select 1 from public.offices o where o.is_active and
      p.office_id is distinct from o.id and not exists(select 1 from public.user_office_assignments u
        where u.user_id=p.id and (u.all_offices or u.office_id=o.id)));
$$;
revoke all on function insurance_internal.current_verifier() from public,anon,authenticated;
alter table public.insurance_office_notices alter column recipient drop not null;
alter table public.insurance_office_notices add column assignee_id uuid references public.user_profiles(id);

create or replace function insurance_internal.insurance_intake_stamp() returns trigger
language plpgsql security definer set search_path='' as $$
declare account_name text; account_email text;
begin
  select o.name,lower(trim(o.email)) into strict new.office_name,new.office_email from public.offices o
    where o.id=new.office_id and o.is_active and nullif(trim(o.email),'') is not null;
  new.requested_at=clock_timestamp(); new.submission_date=(new.requested_at at time zone 'America/New_York')::date;
  if auth.uid() is not null then
    new.requested_by_user_id=auth.uid();
    select p.full_name,lower(p.email) into strict account_name,account_email from public.user_profiles p where p.id=auth.uid();
    if exists(select 1 from public.offices o where lower(o.email)=account_email) then
      if nullif(trim(new.requesting_staff_name),'') is null or lower(trim(new.requesting_staff_name)) in
        (lower(account_name),lower(new.office_name),account_email) then raise exception 'Enter the name of the staff member submitting this request'; end if;
      new.requested_by_name=trim(new.requesting_staff_name);
    else new.requested_by_name=account_name; new.requesting_staff_name=account_name; end if;
  end if;
  select v.user_id,v.email into new.assigned_to_user_id,new.assigned_to_email from insurance_internal.current_verifier() v;
  new.assigned_at=case when new.assigned_to_user_id is not null then new.requested_at end;
  return new;
end; $$;
create or replace function insurance_internal.insurance_queue_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.insurance_office_notices(request_id,kind,office_id,recipient,assignee_id)
    values(new.id,'requested',new.office_id,new.assigned_to_email,new.assigned_to_user_id) on conflict do nothing;
  else
    insert into public.insurance_office_notices(request_id,kind,office_id,recipient)
    select new.id,'completed',o.id,lower(trim(o.email)) from public.offices o where o.id=new.office_id on conflict do nothing;
  end if;
  return null;
end; $$;

-- Run after the named account and office permissions are ready. Release waiting open requests once.
create function public.insurance_assign_verifier(verifier uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare target_email text; changed integer;
begin
  lock table public.insurance_verification_requests in share row exclusive mode;
  insert into insurance_internal.verifier_assignment(singleton,user_id) values(true,verifier)
    on conflict(singleton) do update set user_id=excluded.user_id;
  select v.email into strict target_email from insurance_internal.current_verifier() v where v.user_id=verifier;
  update public.insurance_verification_requests set assigned_to_user_id=verifier,assigned_to_email=target_email,assigned_at=clock_timestamp()
    where status in ('requested','assigned','in_progress','needs_info') and assigned_to_user_id is distinct from verifier;
  get diagnostics changed=row_count;
  insert into public.insurance_office_notices(request_id,kind,office_id,recipient,assignee_id)
    select id,'requested',office_id,target_email,verifier from public.insurance_verification_requests where assigned_to_user_id=verifier
    and status in ('requested','assigned','in_progress','needs_info')
    on conflict(request_id,kind) do update set recipient=excluded.recipient,assignee_id=excluded.assignee_id,
      draft_id=null,sent_at=null,attempts=0,retry_at=now() where insurance_office_notices.assignee_id is distinct from verifier;
  return changed;
end; $$;
revoke all on function public.insurance_assign_verifier(uuid) from public,anon,authenticated;
grant execute on function public.insurance_assign_verifier(uuid) to service_role;
update public.insurance_verification_requests set assigned_to_user_id=null,assigned_to_email=null,assigned_at=null
  where status in ('requested','assigned','in_progress','needs_info') and assigned_to_email=office_email;
update public.insurance_office_notices set recipient=null,draft_id=null where kind='requested' and sent_at is null;
create function public.insurance_notice_destination(notice uuid) returns table(email text,office_name text,submitted_by text)
language sql stable security definer set search_path='' as $$
  select case n.kind when 'completed' then lower(o.email) else v.email end,o.name,r.requested_by_name
  from public.insurance_office_notices n join public.insurance_verification_requests r on r.id=n.request_id
  join public.offices o on o.id=r.office_id and o.is_active
  left join insurance_internal.current_verifier() v on v.user_id=n.assignee_id and v.user_id=r.assigned_to_user_id
  where n.id=notice and n.sent_at is null and (n.kind='completed' or (n.kind='requested' and v.user_id is not null and r.status in ('requested','assigned','in_progress','needs_info')));
$$;
revoke all on function public.insurance_notice_destination(uuid) from public,anon,authenticated;
grant execute on function public.insurance_notice_destination(uuid) to service_role;

-- Maintain an immutable first open per verifier. A manager preview and a reopened request do not start a new interval.
create table insurance_internal.first_opens (
 request_id uuid not null references public.insurance_verification_requests(id) on delete cascade,
 verifier_id uuid not null references public.user_profiles(id),opened_at timestamptz not null default clock_timestamp(),
 primary key(request_id,verifier_id)
);
revoke all on insurance_internal.first_opens from public,anon,authenticated;
create function public.insurance_open_request(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid();
begin
  if exists(select 1 from insurance_internal.current_verifier() v where user_id=actor) then
    perform 1 from public.insurance_verification_requests r where r.id=target and r.assigned_to_user_id=actor
      and r.status in ('requested','assigned','in_progress','needs_info') and insurance_internal.insurance_can(r.office_id,'complete') for share;
    if found then insert into insurance_internal.first_opens(request_id,verifier_id) values(target,actor) on conflict do nothing; end if;
  end if;
end; $$;
revoke all on function public.insurance_open_request(uuid) from public,anon;
grant execute on function public.insurance_open_request(uuid) to authenticated;

delete from public.insurance_daily_reviewers where user_id in (select id from public.user_profiles where lower(email) in ('kathy@thenudental.com','yabezy@thenudental.com'));
create function insurance_internal.can_review_activity() returns boolean
language sql stable security definer set search_path='' as $$
 select public.dashboard_has_active_profile() and exists(select 1 from public.insurance_daily_reviewers where user_id=auth.uid());
$$;
revoke all on function insurance_internal.can_review_activity() from public,anon;
grant execute on function insurance_internal.can_review_activity() to authenticated;
create policy private_verifier_audit on public.insurance_verification_audit_log as restrictive for select to authenticated using(insurance_internal.can_review_activity());

create function public.insurance_verifier_activity(period_unit text, selected_day date, page_number integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare first_day date; next_day date; result jsonb;
begin
  if not insurance_internal.can_review_activity() then raise insufficient_privilege using message='Private management report'; end if;
  if period_unit not in ('day','week','month','year') or period_unit is null or selected_day is null or page_number is null or page_number<0 then raise exception 'Select a valid period'; end if;
  first_day=date_trunc(period_unit,selected_day::timestamp)::date;
  next_day=(first_day+case period_unit when 'day' then interval '1 day' when 'week' then interval '7 days' when 'month' then interval '1 month' else interval '1 year' end)::date;
  with items as materialized (
    select r.id,r.office_name,r.requested_by_name as submitted_by,r.requested_at,
      coalesce(v.completed_by_user_id,r.assigned_to_user_id) as verifier_id,
      coalesce(v.completed_by_name,p.full_name,'Awaiting assignment') as verifier,
      f.opened_at,v.completed_at, case when v.completed_at>=f.opened_at then extract(epoch from (v.completed_at-f.opened_at)) end as elapsed_seconds
    from public.insurance_verification_requests r
    left join public.insurance_verifications v on v.request_id=r.id and v.status='completed'
    left join public.user_profiles p on p.id=r.assigned_to_user_id
    left join insurance_internal.first_opens f on f.request_id=r.id and f.verifier_id=coalesce(v.completed_by_user_id,r.assigned_to_user_id)
    where (v.completed_at is not null or r.status in ('requested','assigned','in_progress','needs_info'))
    and coalesce(v.completed_at,f.opened_at,r.requested_at)>= (first_day::timestamp at time zone 'America/New_York')
    and coalesce(v.completed_at,f.opened_at,r.requested_at)< (next_day::timestamp at time zone 'America/New_York')
  ), summary as (
    select verifier_id,verifier,count(completed_at) as completed,count(elapsed_seconds) as timed,avg(elapsed_seconds) as average_seconds
    from items group by verifier_id,verifier
  ), detail as (
    select * from items order by coalesce(completed_at,opened_at,requested_at) desc,id limit 50 offset (page_number::bigint*50)
  )
  select jsonb_build_object('start',first_day,'end',next_day-1,'completed',(select count(completed_at) from items),
    'total_rows',(select count(*) from items),'summary',coalesce((select jsonb_agg(to_jsonb(s) order by s.verifier) from summary s),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(d) order by coalesce(d.completed_at,d.opened_at,d.requested_at) desc,d.id) from detail d),'[]'::jsonb)) into result;
  return result;
end; $$;
revoke all on function public.insurance_verifier_activity(text,date,integer) from public,anon;
grant execute on function public.insurance_verifier_activity(text,date,integer) to authenticated;
notify pgrst,'reload schema';
