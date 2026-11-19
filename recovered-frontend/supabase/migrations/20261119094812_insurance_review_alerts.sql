-- Front-office access uses administrator-managed grants, not editable profile titles at login.
insert into public.staff_workflow_grants(user_id,permission)
select p.id,k from public.user_profiles p
cross join (values ('workflow.insurance.view'),('workflow.insurance.submit')) permissions(k)
where p.role='staff' and p.is_active and p.is_approved and p.status='Active'
  and lower(coalesce(p.job_title,'')) ~ 'front[ -]?(desk|office)|patient care coordinator|office manager'
on conflict do nothing;

insert into public.role_permissions(role,permission,enabled)
values ('office_manager','workflow.insurance.view',true),('office_manager','workflow.insurance.submit',true)
on conflict(role,permission) do update set enabled=true,updated_at=now();

create table public.insurance_review_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.insurance_verification_requests(id) on delete cascade,
  office_id uuid not null references public.offices(id),
  created_at timestamptz not null default now(), closed_at timestamptz
);
create unique index insurance_one_open_review on public.insurance_review_events(request_id) where closed_at is null;
create index insurance_review_event_office on public.insurance_review_events(office_id);
alter table public.insurance_review_events enable row level security;
revoke all on public.insurance_review_events from public,anon,authenticated;
grant select on public.insurance_review_events to service_role;

create table public.insurance_review_notices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.insurance_review_events(id) on delete cascade,
  recipient text not null check(recipient=lower(trim(recipient)) and recipient<>''),
  created_at timestamptz not null default now(),
  draft_id text, sent_at timestamptz, cancelled_at timestamptz,
  retry_at timestamptz not null default now(), attempts integer not null default 0,
  unique(event_id,recipient)
);
create index insurance_review_notice_due on public.insurance_review_notices(retry_at)
  where sent_at is null and cancelled_at is null;
alter table public.insurance_review_notices enable row level security;
revoke all on public.insurance_review_notices from public,anon,authenticated;
grant select,update on public.insurance_review_notices to service_role;

-- Internal directory lookup. Called only by the trusted trigger and mail worker.
create function insurance_internal.review_recipients(target uuid)
returns table(user_id uuid,email text,office_staff boolean)
language sql stable security definer set search_path='' as $$
  with office_staff as (
    select p.id,lower(trim(p.email)) email
    from public.user_profiles p join public.offices o on o.id=target and o.is_active
    where p.is_active and p.is_approved and p.status='Active' and nullif(trim(p.email),'') is not null
      and (p.role='office_manager' or lower(coalesce(p.job_title,'')) ~ 'front[ -]?(desk|office)|patient care coordinator|office manager')
      and (p.office_id=target or exists(select 1 from public.user_office_assignments a
        where a.user_id=p.id and (a.office_id=target or a.all_offices)))
      and (p.role='super_admin' or exists(select 1 from public.role_permissions g
        where g.role=p.role::text and g.permission='workflow.insurance.view' and g.enabled)
        or (p.role='staff' and exists(select 1 from public.staff_workflow_grants g
          where g.user_id=p.id and g.permission='workflow.insurance.view')))
  ), recipients as (
    select id,email,true office_staff from office_staff
    union all select v.user_id,v.email,false from insurance_internal.current_verifier() v
  ) select id,email,bool_or(office_staff) from recipients group by id,email;
$$;
revoke all on function insurance_internal.review_recipients(uuid) from public,anon,authenticated;
grant usage on schema insurance_internal to service_role;
grant execute on function insurance_internal.review_recipients(uuid) to service_role;

create function insurance_internal.queue_review_alerts() returns trigger
language plpgsql security definer set search_path='' as $$
declare event uuid; office_label text;
begin
  if new.dentrix_document_upload_status='review' and new.status<>'cancelled' then
    -- The partial unique index also protects against duplicate updates and backfills.
    insert into public.insurance_review_events(request_id,office_id) values(new.id,new.office_id)
      on conflict(request_id) where closed_at is null do nothing returning id into event;
    if event is null then return null; end if;
    select name into strict office_label from public.offices where id=new.office_id;
    insert into public.insurance_review_notices(event_id,recipient)
      select distinct event,r.email from insurance_internal.review_recipients(new.office_id) r;
    insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
      select r.user_id,new.office_id,'insurance_needs_review','Insurance breakdown needs review',
        office_label || ': A completed breakdown needs attention before filing in Ascend. Open the request to review the issue.',
        jsonb_build_object('request_id',new.id,'review_event_id',event,'priority','high')
      from insurance_internal.review_recipients(new.office_id) r where r.office_staff;
  else
    update public.insurance_review_notices n set cancelled_at=now()
      from public.insurance_review_events e where e.id=n.event_id and e.request_id=new.id
      and e.closed_at is null and n.sent_at is null and n.cancelled_at is null;
    update public.notifications n set is_archived=true,
      metadata=n.metadata || jsonb_build_object('resolved',true)
      from public.insurance_review_events e where e.request_id=new.id and e.closed_at is null
      and n.notification_type='insurance_needs_review' and n.metadata->>'review_event_id'=e.id::text;
    update public.insurance_review_events set closed_at=now() where request_id=new.id and closed_at is null;
  end if;
  return null;
end;
$$;
revoke all on function insurance_internal.queue_review_alerts() from public,anon,authenticated;
create trigger insurance_review_alerts after insert or update of dentrix_document_upload_status,status
on public.insurance_verification_requests for each row execute function insurance_internal.queue_review_alerts();

-- Revalidate the open review, current office membership, active account, and email before every send.
create function public.insurance_review_destination(notice uuid)
returns table(email text,office_name text,request_id uuid)
language sql stable security invoker set search_path='' as $$
  select distinct n.recipient,o.name,r.id
  from public.insurance_review_notices n
  join public.insurance_review_events e on e.id=n.event_id and e.closed_at is null
  join public.insurance_verification_requests r on r.id=e.request_id and r.office_id=e.office_id
    and r.dentrix_document_upload_status='review' and r.status<>'cancelled'
  join public.offices o on o.id=e.office_id and o.is_active
  join insurance_internal.review_recipients(e.office_id) p on p.email=n.recipient
  where n.id=notice and n.sent_at is null and n.cancelled_at is null;
$$;
revoke all on function public.insurance_review_destination(uuid) from public,anon,authenticated;
grant execute on function public.insurance_review_destination(uuid) to service_role;

-- Include any unresolved review already present at release, once only.
update public.insurance_verification_requests set dentrix_document_upload_status='review'
where dentrix_document_upload_status='review' and status<>'cancelled';
