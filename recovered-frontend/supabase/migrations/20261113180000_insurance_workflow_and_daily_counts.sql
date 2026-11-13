-- Resolve office access and workflow grants together for every authenticated write.
create schema insurance_internal;
create function insurance_internal.insurance_can(target uuid, action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.dashboard_has_active_profile() and public.user_can_access_office(target)
    and exists (
      select 1 from public.user_profiles p where p.id = auth.uid()
        and (p.role = 'super_admin' or exists (
          select 1 from public.role_permissions g where g.role=p.role::text
            and g.permission='workflow.insurance.' || action and g.enabled
        ) or (p.role='staff' and exists (
          select 1 from public.staff_workflow_grants g where g.user_id=p.id
            and g.permission='workflow.insurance.' || action
        )))
    );
$$;
revoke all on function insurance_internal.insurance_can(uuid,text) from public,anon;
grant usage on schema insurance_internal to authenticated;
grant execute on function insurance_internal.insurance_can(uuid,text) to authenticated;

insert into public.staff_workflow_grants(user_id, permission)
select p.id, k from public.user_profiles p join public.offices o on p.office_id=o.id
  and lower(p.email)=lower(o.email)
cross join (values ('workflow.insurance.view'),('workflow.insurance.submit')) keys(k)
where p.role='staff' and p.is_active and p.is_approved and o.is_active
on conflict do nothing;

create policy insurance_staff_read_own_grants on public.staff_workflow_grants
  for select to authenticated using (user_id=(select auth.uid()) and public.dashboard_has_active_profile()
  and permission in ('workflow.insurance.view','workflow.insurance.submit'));

create function public.insurance_workflow_offices()
returns table(id uuid,name text,email text,can_submit boolean)
language sql stable security definer set search_path = '' as $$
  select o.id,o.name,o.email,insurance_internal.insurance_can(o.id,'submit')
  from public.offices o where o.is_active and insurance_internal.insurance_can(o.id,'view') order by o.name;
$$;
revoke all on function public.insurance_workflow_offices() from public,anon;
grant execute on function public.insurance_workflow_offices() to authenticated;

alter policy dashboard_insurance_request_access_boundary on public.insurance_verification_requests
  using (insurance_internal.insurance_can(office_id,'view')) with check (insurance_internal.insurance_can(office_id,'view'));
create policy insurance_submit on public.insurance_verification_requests as restrictive for insert to authenticated
  with check (insurance_internal.insurance_can(office_id,'submit') and requested_by_user_id=auth.uid() and status='requested'
    and completed_at is null and verification_id is null and started_at is null and cancelled_at is null
    and chart_uploaded_at is null and office_emailed_at is null and pdf_generated_at is null);
create policy insurance_update on public.insurance_verification_requests as restrictive for update to authenticated
  using (exists(select 1 from unnest(array['cancel','complete','assign','email_office','upload_to_dentrix','mark_uploaded']) k where insurance_internal.insurance_can(office_id,k)));
create policy insurance_start on public.insurance_verifications as restrictive for insert to authenticated
  with check (status='draft' and exists(select 1 from public.insurance_verification_requests r where r.id=request_id
    and insurance_internal.insurance_can(r.office_id,'complete') and r.status in ('requested','assigned','in_progress','needs_info')));
create policy insurance_edit on public.insurance_verifications as restrictive for update to authenticated
  using (exists(select 1 from public.insurance_verification_requests r where r.id=request_id
    and (insurance_internal.insurance_can(r.office_id,'complete') or (insurance_verifications.status='completed'
      and exists(select 1 from unnest(array['email_office','upload_to_dentrix','mark_uploaded']) k where insurance_internal.insurance_can(r.office_id,k))))));

create unique index insurance_one_breakdown_per_request on public.insurance_verifications(request_id) where request_id is not null;
create index insurance_finished_at on public.insurance_verifications(completed_at) where status='completed';

create table public.insurance_office_notices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.insurance_verification_requests(id) on delete cascade,
  kind text not null check(kind in ('requested','completed')),
  office_id uuid not null references public.offices(id),
  recipient text not null, created_at timestamptz not null default now(),
  draft_id text, sent_at timestamptz, retry_at timestamptz not null default now(), attempts integer not null default 0,
  unique(request_id,kind)
);
alter table public.insurance_office_notices enable row level security;
revoke all on public.insurance_office_notices from public,anon,authenticated;
grant select,update on public.insurance_office_notices to service_role;

create function insurance_internal.insurance_intake_stamp() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.office_id is null then raise exception 'Choose an office'; end if;
  select o.name,lower(trim(o.email)) into strict new.office_name,new.office_email from public.offices o
    where o.id=new.office_id and o.is_active and nullif(trim(o.email),'') is not null;
  new.requested_at=clock_timestamp();
  new.submission_date=(new.requested_at at time zone 'America/New_York')::date;
  if auth.uid() is not null then
    new.requested_by_user_id=auth.uid();
    select full_name into strict new.requested_by_name from public.user_profiles where id=auth.uid();
  end if;
  new.assigned_to_email=new.office_email;
  select p.id into new.assigned_to_user_id from public.user_profiles p where p.office_id=new.office_id
    and lower(p.email)=new.office_email and p.is_active and p.is_approved limit 1;
  return new;
end;
$$;
create trigger insurance_intake_stamp before insert on public.insurance_verification_requests
for each row execute function insurance_internal.insurance_intake_stamp();

create function insurance_internal.insurance_queue_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.insurance_office_notices(request_id,kind,office_id,recipient)
    select new.id,case when tg_op='INSERT' then 'requested' else 'completed' end,o.id,lower(trim(o.email))
    from public.offices o where o.id=new.office_id and nullif(trim(o.email),'') is not null
    on conflict(request_id,kind) do nothing;
  return null;
end;
$$;
create trigger insurance_requested_notice after insert on public.insurance_verification_requests
for each row execute function insurance_internal.insurance_queue_notice();
create trigger insurance_completed_notice after update of completed_at on public.insurance_verification_requests
for each row when (old.completed_at is null and new.completed_at is not null) execute function insurance_internal.insurance_queue_notice();

create function insurance_internal.insurance_breakdown_stamp() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.request_id is distinct from old.request_id then raise exception 'The request cannot be changed'; end if;
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then
    new.completed_at=clock_timestamp();
    if auth.uid() is not null then
      new.completed_by_user_id=auth.uid();
      select full_name,email into strict new.completed_by_name,new.completed_by_email
        from public.user_profiles where id=auth.uid();
    end if;
  elsif new.status is distinct from 'completed' then
    new.completed_at=null; new.completed_by_user_id=null; new.completed_by_name=null; new.completed_by_email=null;
  end if;
  return new;
end;
$$;
create trigger insurance_breakdown_stamp before insert or update on public.insurance_verifications
for each row execute function insurance_internal.insurance_breakdown_stamp();

create function insurance_internal.insurance_sync_breakdown() returns trigger
language plpgsql security definer set search_path='' as $$
declare request_status text;
begin
  if new.request_id is null then return null; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return null; end if;
  select status into strict request_status from public.insurance_verification_requests where id=new.request_id for update;
  if request_status not in ('requested','assigned','in_progress','needs_info') then
    raise exception 'This request has already been closed'; end if;
  update public.insurance_verification_requests set verification_id=new.id,
    started_at=coalesce(started_at,clock_timestamp()), updated_at=clock_timestamp(),
    status=case when new.status='completed' then 'completed' else 'in_progress' end,
    completed_at=new.completed_at, completed_by_user_id=new.completed_by_user_id, completed_by_name=new.completed_by_name
    where id=new.request_id;
  return null;
end;
$$;
create trigger insurance_sync_breakdown after insert or update of status on public.insurance_verifications
for each row execute function insurance_internal.insurance_sync_breakdown();

create function insurance_internal.insurance_preserve_timeline() returns trigger language plpgsql set search_path='' as $$
begin
  if new.office_id is distinct from old.office_id then raise exception 'The requesting office cannot be changed'; end if;
  new.requested_at=old.requested_at; new.requested_by_user_id=old.requested_by_user_id;
  new.requested_by_name=old.requested_by_name;
  if pg_trigger_depth()=1 then
    if new.status='completed' and old.completed_at is null then raise exception 'Complete the linked breakdown first'; end if;
    new.completed_at=old.completed_at; new.completed_by_user_id=old.completed_by_user_id;
    new.completed_by_name=old.completed_by_name; new.verification_id=old.verification_id; new.started_at=old.started_at;
  end if;
  return new;
end;
$$;
create trigger insurance_preserve_timeline before update on public.insurance_verification_requests
for each row execute function insurance_internal.insurance_preserve_timeline();

create table public.insurance_daily_reviewers(user_id uuid primary key references public.user_profiles(id) on delete cascade);
alter table public.insurance_daily_reviewers enable row level security;
revoke all on public.insurance_daily_reviewers from public,anon,authenticated;
grant select on public.insurance_daily_reviewers to authenticated;
create policy read_own_management_report_access on public.insurance_daily_reviewers for select to authenticated
  using(user_id=(select auth.uid()) and public.dashboard_has_active_profile());
insert into public.insurance_daily_reviewers select id from public.user_profiles
  where lower(email) in ('admasu@thenudental.com','kathy@thenudental.com','yabezy@thenudental.com','ny@thenudental.com') and is_active and is_approved;
do $$ begin if (select count(*) from public.insurance_daily_reviewers)<>4 then raise exception 'Check the four designated reviewers'; end if; end $$;

create function public.insurance_daily_counts(week_ending date)
returns table(work_day date,office_id uuid,office_name text,completed bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.dashboard_has_active_profile() or not exists(select 1 from public.insurance_daily_reviewers r where r.user_id=auth.uid()) then
    raise exception using errcode='42501',message='Daily Counts requires management report access';
  end if;
  if week_ending is null then raise exception 'Select a date'; end if;
  return query
    with totals as (
      select (v.completed_at at time zone 'America/New_York')::date d,r.office_id oid,count(*) n
      from public.insurance_verifications v join public.insurance_verification_requests r on r.id=v.request_id
      where v.status='completed' and v.completed_at >= ((week_ending-6)::timestamp at time zone 'America/New_York')
        and v.completed_at < ((week_ending+1)::timestamp at time zone 'America/New_York')
      group by 1,2
    )
    select week_ending-i,o.id,o.name,coalesce(t.n,0::bigint)
    from generate_series(0,6) i cross join public.offices o
    left join totals t on t.d=week_ending-i and t.oid=o.id
    where o.is_active or exists(select 1 from totals x where x.oid=o.id)
    order by 1 desc,3;
end;
$$;
revoke all on function public.insurance_daily_counts(date) from public,anon;
grant execute on function public.insurance_daily_counts(date) to authenticated;
revoke execute on all functions in schema insurance_internal from public, anon, authenticated;
grant execute on function insurance_internal.insurance_can(uuid,text) to authenticated;
notify pgrst,'reload schema';
