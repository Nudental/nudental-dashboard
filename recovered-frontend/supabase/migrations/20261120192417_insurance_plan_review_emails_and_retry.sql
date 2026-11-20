-- Plan entry and PDF filing have independent review cycles on the same request.
alter table public.insurance_review_events drop constraint insurance_review_events_issue_kind_check;
alter table public.insurance_review_events add constraint insurance_review_events_issue_kind_check
  check(issue_kind in ('filing','needs_info','plan_entry'));
drop index public.insurance_one_open_review;
create unique index insurance_one_open_review on public.insurance_review_events(request_id)
  where closed_at is null and issue_kind<>'plan_entry';
create unique index insurance_one_open_plan_review on public.insurance_review_events(request_id)
  where closed_at is null and issue_kind='plan_entry';

create or replace function insurance_internal.queue_review_alerts() returns trigger
language plpgsql security definer set search_path='' as $$
declare event uuid; office_label text; kind text; current_kind text;
begin
  kind=case when new.status='needs_info' then 'needs_info'
    when new.dentrix_document_upload_status='review' and new.status<>'cancelled' then 'filing' else null end;
  select id,issue_kind into event,current_kind from public.insurance_review_events
    where request_id=new.id and closed_at is null and issue_kind<>'plan_entry';
  if event is not null and current_kind is not distinct from kind then return null; end if;
  if event is not null then
    update public.insurance_review_notices set cancelled_at=now() where event_id=event and sent_at is null and cancelled_at is null;
    update public.notifications set is_archived=true,metadata=metadata||jsonb_build_object('resolved',true)
      where notification_type='insurance_needs_review' and metadata->>'review_event_id'=event::text;
    update public.insurance_review_events set closed_at=now() where id=event;
  end if;
  if kind is null then return null; end if;
  insert into public.insurance_review_events(request_id,office_id,issue_kind) values(new.id,new.office_id,kind)
    on conflict(request_id) where closed_at is null and issue_kind<>'plan_entry' do nothing returning id into event;
  if event is null then return null; end if;
  select name into strict office_label from public.offices where id=new.office_id;
  insert into public.insurance_review_notices(event_id,recipient)
    select distinct event,r.email from insurance_internal.review_recipients(new.office_id) r;
  insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
    select r.user_id,new.office_id,'insurance_needs_review',
      case kind when 'needs_info' then 'Insurance information needs attention' else 'Insurance breakdown needs review' end,
      office_label||case kind when 'needs_info' then ': Contact the patient or insurer for corrected information. Open the request, read the issue, and record the response.'
        else ': A completed breakdown needs attention before filing in Ascend. Open the request to review the issue.' end,
      jsonb_build_object('request_id',new.id,'review_event_id',event,'issue_kind',kind,'priority','high')
    from insurance_internal.review_recipients(new.office_id) r where r.office_staff;
  return null;
end; $$;

create or replace function insurance_internal.plan_review_alert() returns trigger
language plpgsql security definer set search_path='' as $$
declare office uuid; label text; request_status text; attached boolean; alert_title text; alert_message text; event uuid;
begin
  select r.office_id,o.name,r.status into office,label,request_status from public.insurance_verification_requests r
    join public.offices o on o.id=r.office_id where r.id=new.request_id;
  if new.state='needs_review' and request_status<>'cancelled' then
    insert into public.insurance_review_events(request_id,office_id,issue_kind)
      values(new.request_id,office,'plan_entry')
      on conflict(request_id) where closed_at is null and issue_kind='plan_entry' do nothing returning id into event;
    if event is null then
      select id into strict event from public.insurance_review_events
        where request_id=new.request_id and closed_at is null and issue_kind='plan_entry';
    end if;
    insert into public.insurance_review_notices(event_id,recipient)
      select distinct event,r.email from insurance_internal.review_recipients(office) r on conflict do nothing;
    attached := new.patient_id is not null and new.plan_id is not null
      and new.receipt @> '{"patient":true,"office":true,"carrier":true,"payer":true,"group":true,"subscriber":true,"relationship":true,"order":true,"effective_date":true,"reopened":true}'::jsonb;
    alert_title := case when attached then 'Insurance plan attached — benefit review needed' else 'Insurance plan entry needs review' end;
    alert_message := label || case when attached
      then ': The native insurance plan is already attached. Review the remaining benefits and restrictions with Patricia and the office manager in the request discrepancy log. Do not attach a duplicate policy. PDF filing is separate.'
      else ': The insurance plan could not be safely entered in Ascend. Open the completed breakdown and review the issue with Patricia. Record the correction, then request a checked retry. PDF filing is separate.' end;
    update public.notifications set title=alert_title,message=alert_message,
      metadata=metadata||jsonb_build_object('reason_codes',new.reason_codes,'plan_attached_verified',attached,'review_event_id',event,'issue_kind','plan_entry')
      where metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(is_archived,false);
    insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
      select r.user_id,office,'insurance_needs_review',alert_title,alert_message,
        jsonb_build_object('request_id',new.request_id,'plan_entry_verification_id',new.verification_id,'review_event_id',event,
          'issue_kind','plan_entry','reason_codes',new.reason_codes,'plan_attached_verified',attached,'priority','high')
      from insurance_internal.review_recipients(office) r
      where not exists(select 1 from public.notifications n where n.user_id=r.user_id
        and n.metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(n.is_archived,false));
  else
    update public.insurance_review_notices n set cancelled_at=now()
      from public.insurance_review_events e where e.id=n.event_id and e.request_id=new.request_id
        and e.issue_kind='plan_entry' and e.closed_at is null and n.sent_at is null and n.cancelled_at is null;
    update public.insurance_review_events set closed_at=now()
      where request_id=new.request_id and issue_kind='plan_entry' and closed_at is null;
    update public.notifications set is_archived=true,
      metadata=metadata||jsonb_build_object('resolved',new.state='succeeded','entry_state',new.state)
      where metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(is_archived,false);
  end if;
  return null;
end; $$;

create or replace function public.insurance_review_destination(notice uuid)
returns table(email text,office_name text,request_id uuid,issue_kind text)
language sql stable security invoker set search_path='' as $$
  select distinct n.recipient,o.name,r.id,e.issue_kind
  from public.insurance_review_notices n join public.insurance_review_events e on e.id=n.event_id and e.closed_at is null
  join public.insurance_verification_requests r on r.id=e.request_id and r.office_id=e.office_id and r.status<>'cancelled'
    and ((e.issue_kind='needs_info' and r.status='needs_info') or
      (e.issue_kind='filing' and r.dentrix_document_upload_status='review') or
      (e.issue_kind='plan_entry' and exists(select 1 from insurance_internal.plan_entry_jobs j
        where j.request_id=r.id and j.verification_id=r.verification_id and j.state='needs_review')))
  join public.offices o on o.id=e.office_id and o.is_active
  join insurance_internal.review_recipients(e.office_id) p on p.email=n.recipient
  where n.id=notice and n.sent_at is null and n.cancelled_at is null;
$$;

-- A retry first permits inspection only. It never clears receipts or starts a second job.
create function insurance_internal.queue_plan_entry_retry(target uuid,observed_updated_at timestamptz,resolution_note text,actor jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j insurance_internal.plan_entry_jobs; r public.insurance_verification_requests; v public.insurance_verifications;
  fingerprint text; clean text:=nullif(trim(resolution_note),''); event uuid;
begin
  select * into strict j from insurance_internal.plan_entry_jobs where request_id=target for update;
  if j.state<>'needs_review' or j.updated_at is distinct from observed_updated_at or j.lease_until>clock_timestamp() then
    raise exception 'This entry changed or is already being processed. Refresh before requesting a retry.';
  end if;
  if clean is null or length(clean)<10 or length(clean)>2000 then raise exception 'Describe the correction or resolution before retrying.'; end if;
  if actor is null or nullif(trim(actor->>'name'),'') is null then raise exception 'A retry actor is required'; end if;
  select * into strict r from public.insurance_verification_requests where id=target for update;
  select * into strict v from public.insurance_verifications where id=j.verification_id for update;
  if r.status='cancelled' or v.status<>'completed' or v.request_id<>r.id or r.verification_id is distinct from v.id then
    raise exception 'The linked completed breakdown is not ready for retry.';
  end if;
  if nullif(trim(r.patient_first_name),'') is null or nullif(trim(r.patient_last_name),'') is null
    or lower(regexp_replace(trim(concat_ws(' ',r.patient_first_name,r.patient_last_name)),'\s+',' ','g'))
      is distinct from lower(regexp_replace(trim(v.patient_name),'\s+',' ','g'))
    or r.patient_dob is null or r.patient_dob is distinct from v.patient_dob then
    raise exception 'The request and completed form still have different patient details. Confirm the correction with the office; keep the same request.';
  end if;
  fingerprint:=insurance_internal.plan_source_hash(v.id);
  if fingerprint is null then raise exception 'Completed source could not be checked'; end if;
  insert into public.insurance_verification_audit_log(request_id,verification_id,event_type,performed_by_user_id,performed_by_email,performed_by_name,old_status,new_status,metadata)
    values(r.id,v.id,'insurance_plan_retry_requested',nullif(actor->>'user_id','')::uuid,actor->>'email',actor->>'name',j.state,'reconciling',
      jsonb_build_object('resolution_note',clean,'source_hash_before',j.source_hash,'source_hash_after',fingerprint,
        'previous_reason_codes',j.reason_codes,'previous_receipt',j.receipt,'patient_id',j.patient_id,'plan_id',j.plan_id,'inspection_required',true)) returning id into event;
  update insurance_internal.plan_entry_jobs set state='reconciling',source_hash=fingerprint,claim_token=null,lease_until=null,
    reason_codes=array['RETRY_RECONCILIATION_REQUIRED'],updated_at=clock_timestamp() where verification_id=v.id;
  return jsonb_build_object('state','reconciling','request_id',r.id,'verification_id',v.id,'audit_id',event);
end; $$;
revoke all on function insurance_internal.queue_plan_entry_retry(uuid,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function insurance_internal.queue_plan_entry_retry(uuid,timestamptz,text,jsonb) to service_role;

create function insurance_internal.plan_entry_status(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare office uuid;
begin
  select office_id into office from public.insurance_verification_requests where id=target;
  if auth.uid() is null or office is null or not insurance_internal.insurance_can(office,'view') then
    raise exception using errcode='42501',message='This request is outside your Insurance access.';
  end if;
  return (select jsonb_build_object('state',state,'updated_at',updated_at,'reason_codes',reason_codes,
    'benefits_verified',receipt->>'benefits'='true','plan_recorded',plan_id is not null,'reopened',receipt->>'reopened'='true')
    from insurance_internal.plan_entry_jobs where request_id=target);
end; $$;
revoke all on function insurance_internal.plan_entry_status(uuid) from public,anon,authenticated;
grant execute on function insurance_internal.plan_entry_status(uuid) to authenticated;
create function public.insurance_plan_entry_status(target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select insurance_internal.plan_entry_status(target); $$;
revoke all on function public.insurance_plan_entry_status(uuid) from public,anon,authenticated;
grant execute on function public.insurance_plan_entry_status(uuid) to authenticated;

create function insurance_internal.request_plan_retry(target uuid,observed_updated_at timestamptz,resolution_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare office uuid; actor public.user_profiles;
begin
  select office_id into office from public.insurance_verification_requests where id=target;
  if auth.uid() is null or office is null or not (insurance_internal.insurance_can(office,'submit') or insurance_internal.insurance_can(office,'complete')) then
    raise exception using errcode='42501',message='This request is outside your Insurance access.';
  end if;
  select * into strict actor from public.user_profiles where id=auth.uid();
  return insurance_internal.queue_plan_entry_retry(target,observed_updated_at,resolution_note,
    jsonb_build_object('user_id',actor.id,'email',actor.email,'name',actor.full_name));
end; $$;
revoke all on function insurance_internal.request_plan_retry(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function insurance_internal.request_plan_retry(uuid,timestamptz,text) to authenticated;
create function public.insurance_request_plan_retry(target uuid,observed_updated_at timestamptz,resolution_note text) returns jsonb
language sql security invoker set search_path='' as $$ select insurance_internal.request_plan_retry(target,observed_updated_at,resolution_note); $$;
revoke all on function public.insurance_request_plan_retry(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.insurance_request_plan_retry(uuid,timestamptz,text) to authenticated;

-- Only the worker can turn a read-only reconciliation into a new write lease.
create function insurance_internal.authorize_reconciled_plan_entry(target uuid,token uuid,observed_source_hash text,
  patient text,plan text,policy_action text,checks jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j insurance_internal.plan_entry_jobs; k text;
begin
  select * into strict j from insurance_internal.plan_entry_jobs where verification_id=target for update;
  if j.state<>'reconciling' or j.claim_token is distinct from token or j.lease_until is null or j.lease_until<=clock_timestamp()
    or observed_source_hash is distinct from j.source_hash or j.source_hash is distinct from insurance_internal.plan_source_hash(target) then return false; end if;
  if patient is null or patient!~'^[0-9]{1,30}$' or (plan is not null and plan!~'^[0-9]{1,30}$')
    or policy_action not in ('REUSE_EXISTING','ATTACH_MISSING') or policy_action is null
    or (policy_action='REUSE_EXISTING' and plan is null) then raise exception 'Exact reconciled patient and policy action are required'; end if;
  if (j.patient_id is not null and j.patient_id<>patient) or
    (j.plan_id is not null and (j.plan_id is distinct from plan or policy_action<>'REUSE_EXISTING')) then
    raise exception 'Previously recorded patient or plan must be reconciled and reused'; end if;
  if checks is null or jsonb_typeof(checks)<>'object' or exists(select 1 from jsonb_each(checks) c
    where c.key not in ('patient','office','chart','source','all_policies','all_groups','subscriber','prior_receipts') or c.value<>'true'::jsonb) then
    raise exception 'Complete reconciliation checks are required'; end if;
  foreach k in array array['patient','office','chart','source','all_policies','all_groups','subscriber','prior_receipts'] loop
    if checks->k is distinct from 'true'::jsonb then raise exception 'Complete reconciliation checks are required'; end if;
  end loop;
  if not exists(select 1 from public.insurance_verifications v join public.insurance_verification_requests r on r.id=v.request_id
    where v.id=target and v.status='completed' and r.status<>'cancelled' and r.verification_id=v.id) then return false; end if;
  insert into public.insurance_verification_audit_log(request_id,verification_id,event_type,performed_by_name,old_status,new_status,metadata)
    values(j.request_id,target,'insurance_plan_retry_reconciled','NU Insurance Automation','reconciling','claimed',
      jsonb_build_object('source_hash',j.source_hash,'patient_id',patient,'plan_id',plan,'policy_action',policy_action,'checks',checks,
        'prior_patient_id',j.patient_id,'prior_plan_id',j.plan_id,'prior_receipt',j.receipt));
  update insurance_internal.plan_entry_jobs set state='claimed',patient_id=patient,plan_id=plan,
    reason_codes=array['RECONCILED_RETRY'],updated_at=clock_timestamp() where verification_id=target;
  return true;
end; $$;
revoke all on function insurance_internal.authorize_reconciled_plan_entry(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function insurance_internal.authorize_reconciled_plan_entry(uuid,uuid,text,text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
