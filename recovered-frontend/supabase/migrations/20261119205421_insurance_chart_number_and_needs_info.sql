alter table public.insurance_verification_requests
  add column ascend_chart_number text,
  add column needs_info_reason text,
  add column needs_info_response text;
alter table public.insurance_verification_requests add constraint insurance_chart_number_format
  check(ascend_chart_number is null or ascend_chart_number ~ '^[A-Z0-9-]{1,40}$');
grant select(ascend_chart_number,needs_info_reason,needs_info_response) on public.insurance_verification_requests to authenticated;

create function insurance_internal.protect_chart_number() returns trigger
language plpgsql set search_path='' as $$
begin
  new.ascend_chart_number=nullif(upper(trim(new.ascend_chart_number)),'');
  if tg_op='UPDATE' and new.ascend_chart_number is distinct from old.ascend_chart_number and
    (old.status='cancelled' or old.dentrix_document_id is not null or
     old.chart_upload_status in ('uploaded','manual_uploaded') or
     old.dentrix_document_upload_status in ('sending','confirming','success','uploaded')) then
    raise exception 'Chart number is locked while filing or after a document is filed.';
  end if;
  return new;
end; $$;
revoke all on function insurance_internal.protect_chart_number() from public,anon,authenticated;
create trigger insurance_protect_chart_number before insert or update of ascend_chart_number
on public.insurance_verification_requests for each row execute function insurance_internal.protect_chart_number();

-- The worker must claim the same patient routing details it read before contacting Ascend.
create function insurance_internal.check_filing_claim() returns trigger
language plpgsql set search_path='' as $$
declare r public.insurance_verification_requests;
begin
  if new.state='sending' and old.state is distinct from 'sending' then
    select * into strict r from public.insurance_verification_requests where id=new.request_id for update;
    if r.status<>'completed' or r.dentrix_document_id is not null then
      raise exception 'Request is not ready for filing.';
    end if;
  end if;
  return new;
end; $$;
revoke all on function insurance_internal.check_filing_claim() from public,anon,authenticated;
create trigger insurance_check_filing_claim before update of state on public.insurance_chart_filings
for each row execute function insurance_internal.check_filing_claim();

-- Atomic, narrowly scoped actions. Completed benefit answers remain locked.
create function insurance_internal.request_action(target uuid, action_name text, answer text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.insurance_verification_requests; j public.insurance_chart_filings;
  clean text=nullif(trim(answer),''); actor public.user_profiles; old_status text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in with your own dashboard account.'; end if;
  select * into r from public.insurance_verification_requests where id=target;
  if not found or not (insurance_internal.insurance_can(r.office_id,'submit') or insurance_internal.insurance_can(r.office_id,'complete')) then
    raise exception using errcode='42501',message='This request is outside your Insurance access.';
  end if;
  -- Use the same lock order as the filing worker.
  select * into j from public.insurance_chart_filings where request_id=target for update;
  select * into strict r from public.insurance_verification_requests where id=target for update;
  select * into strict actor from public.user_profiles where id=auth.uid();
  old_status=r.status;
  if action_name in ('chart_number','retry_filing') then
    if r.status='cancelled' or r.dentrix_document_id is not null or
      r.chart_upload_status in ('uploaded','manual_uploaded') or j.state in ('sending','confirming','filed') then
      raise exception 'Filing is already in progress or recorded. Do not upload another copy.';
    end if;
    if action_name='chart_number' then
      clean=upper(clean);
      if clean is not null and clean !~ '^[A-Z0-9-]{1,40}$' then raise exception 'Enter the Ascend chart number only, or leave it blank if unknown.'; end if;
      update public.insurance_verification_requests set ascend_chart_number=clean,updated_at=now() where id=target;
    end if;
    if j.state='review' then
      if j.filename is not null or j.document_id is not null or j.byte_count is not null then
        raise exception 'A previous upload may have been attempted. Contact support to check the Ascend receipt before retrying.';
      end if;
      update public.insurance_chart_filings set state='pending',next_attempt=now(),updated_at=now() where request_id=target;
      update public.insurance_verifications set chart_upload_status='pending',dentrix_document_upload_status='pending',dentrix_document_upload_error=null where id=j.verification_id;
      update public.insurance_verification_requests set chart_upload_status='pending',dentrix_document_upload_status='pending',dentrix_document_upload_error=null,updated_at=now() where id=target;
    elsif action_name='retry_filing' then
      raise exception 'Only a chart match awaiting review can be retried.';
    end if;
  elsif action_name='needs_info' then
    if not insurance_internal.insurance_can(r.office_id,'complete') then
      raise exception using errcode='42501',message='Only the verifier can request an insurance correction.';
    end if;
    if r.status not in ('requested','assigned','in_progress','needs_info') or j.verification_id is not null then
      raise exception 'This breakdown is already closed. Review its filing status instead.';
    end if;
    if clean is null or length(clean)<3 or length(clean)>2000 then raise exception 'Explain the insurance information the office needs to correct.'; end if;
    update public.insurance_verification_requests set status='needs_info',needs_info_reason=clean,needs_info_response=null,updated_at=now() where id=target;
  elsif action_name='resume' then
    if r.status<>'needs_info' then raise exception 'This request is no longer waiting for insurance information. Refresh it.'; end if;
    if clean is null or length(clean)<3 or length(clean)>2000 then raise exception 'Describe the corrected information or the patient follow-up result.'; end if;
    update public.insurance_verification_requests set status=case when verification_id is null then 'assigned' else 'in_progress' end,
      needs_info_response=clean,updated_at=now() where id=target;
  else raise exception 'Unknown request action.';
  end if;
  insert into public.insurance_verification_audit_log(request_id,verification_id,event_type,performed_by_user_id,performed_by_email,performed_by_name,old_status,new_status,metadata)
    select target,r.verification_id,'request_'||action_name,actor.id,actor.email,actor.full_name,old_status,x.status,
      jsonb_build_object('action',action_name,'answer',clean) from public.insurance_verification_requests x where x.id=target;
  return (select jsonb_build_object('id',id,'status',status,'ascend_chart_number',ascend_chart_number) from public.insurance_verification_requests where id=target);
end; $$;
revoke all on function insurance_internal.request_action(uuid,text,text) from public,anon,authenticated;
grant execute on function insurance_internal.request_action(uuid,text,text) to authenticated;
create function public.insurance_request_action(target uuid,action_name text,answer text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select insurance_internal.request_action(target,action_name,answer);
$$;
revoke all on function public.insurance_request_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.insurance_request_action(uuid,text,text) to authenticated;

create function insurance_internal.hold_incomplete_insurance() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.status='completed' and old.status is distinct from 'completed' and exists(
    select 1 from public.insurance_verification_requests where id=new.request_id and status='needs_info') then
    raise exception 'This request needs corrected insurance information. Record the office response and return it to verification before completing.';
  end if;
  return new;
end; $$;
revoke all on function insurance_internal.hold_incomplete_insurance() from public,anon,authenticated;
create trigger insurance_hold_incomplete before update of status on public.insurance_verifications
for each row execute function insurance_internal.hold_incomplete_insurance();

alter table public.insurance_review_events add column issue_kind text not null default 'filing'
  check(issue_kind in ('filing','needs_info'));
create or replace function insurance_internal.queue_review_alerts() returns trigger
language plpgsql security definer set search_path='' as $$
declare event uuid; office_label text; kind text; current_kind text;
begin
  kind=case when new.status='needs_info' then 'needs_info'
    when new.dentrix_document_upload_status='review' and new.status<>'cancelled' then 'filing' else null end;
  select id,issue_kind into event,current_kind from public.insurance_review_events where request_id=new.id and closed_at is null;
  if event is not null and current_kind is not distinct from kind then return null; end if;
  if event is not null then
    update public.insurance_review_notices set cancelled_at=now() where event_id=event and sent_at is null and cancelled_at is null;
    update public.notifications set is_archived=true,metadata=metadata||jsonb_build_object('resolved',true)
      where notification_type='insurance_needs_review' and metadata->>'review_event_id'=event::text;
    update public.insurance_review_events set closed_at=now() where id=event;
  end if;
  if kind is null then return null; end if;
  insert into public.insurance_review_events(request_id,office_id,issue_kind) values(new.id,new.office_id,kind)
    on conflict(request_id) where closed_at is null do nothing returning id into event;
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

drop function public.insurance_review_destination(uuid);
create function public.insurance_review_destination(notice uuid)
returns table(email text,office_name text,request_id uuid,issue_kind text)
language sql stable security invoker set search_path='' as $$
  select distinct n.recipient,o.name,r.id,e.issue_kind
  from public.insurance_review_notices n join public.insurance_review_events e on e.id=n.event_id and e.closed_at is null
  join public.insurance_verification_requests r on r.id=e.request_id and r.office_id=e.office_id
    and ((e.issue_kind='needs_info' and r.status='needs_info') or
      (e.issue_kind='filing' and r.dentrix_document_upload_status='review' and r.status<>'cancelled'))
  join public.offices o on o.id=e.office_id and o.is_active
  join insurance_internal.review_recipients(e.office_id) p on p.email=n.recipient
  where n.id=notice and n.sent_at is null and n.cancelled_at is null;
$$;
revoke all on function public.insurance_review_destination(uuid) from public,anon,authenticated;
grant execute on function public.insurance_review_destination(uuid) to service_role;
notify pgrst,'reload schema';


create or replace view public.insurance_work_requests with (security_invoker=true) as
 SELECT id,
    submission_date,
    requesting_staff_name,
    requesting_staff_role,
    appointment_date,
    appointment_time,
    treating_provider,
    urgency_level,
    treatment_type,
    patient_first_name,
    patient_last_name,
    patient_dob,
    patient_phone,
    patient_alt_phone,
    patient_address,
    patient_city,
    patient_state,
    patient_zip,
    patient_email,
    is_new_patient,
    insurance_company_name,
    insurance_phone,
    insurance_fax,
    plan_type,
    member_id,
    group_number,
    group_name,
    effective_date,
    termination_date,
    patient_is_subscriber,
    subscriber_first_name,
    subscriber_last_name,
    subscriber_dob,
    subscriber_phone,
    subscriber_employer,
    relationship_to_subscriber,
    benefit_preventive,
    benefit_basic_restorative,
    benefit_major_restorative,
    benefit_orthodontics,
    benefit_implants,
    benefit_periodontal,
    benefit_endodontics,
    benefit_oral_surgery,
    benefit_emergency,
    benefit_prosthodontics,
    benefit_nitrous_oxide,
    benefit_iv_sedation,
    verify_deductible,
    verify_annual_maximum,
    verify_remaining_benefits,
    verify_waiting_periods,
    verify_missing_tooth_clause,
    verify_coordination,
    additional_notes,
    callback_preference,
    reference_number,
    created_at,
    status,
    office_id,
    office_name,
    requested_by_user_id,
    requested_by_name,
    assigned_to_user_id,
    assigned_to_email,
    completed_by_user_id,
    completed_by_name,
    requested_at,
    assigned_at,
    office_emailed_at,
    pdf_generated_at,
    chart_uploaded_at,
    cancelled_at,
    office_email,
    request_email_sent_at,
    verification_id,
    cancel_reason,
    patient_name,
    chart_upload_method,
    chart_upload_status,
    dentrix_document_upload_status,
    dentrix_document_id,
    dentrix_patient_id,
    dentrix_document_uploaded_at,
    dentrix_document_uploaded_by,
    dentrix_document_upload_error,
    dentrix_document_filename,
    dentrix_document_mime_type,
    dentrix_document_size_bytes,
    manual_chart_uploaded_at,
    manual_chart_uploaded_by,
    manual_chart_upload_note,
    pdf_storage_path,
    pdf_checksum_sha256,
    chart_uploaded_by_user_id,
    chart_upload_error
    ,ascend_chart_number,needs_info_reason,needs_info_response
   FROM public.insurance_verification_requests;
create or replace function public.insurance_filing_state(verification uuid, expected text, next_state text, details jsonb default '{}') returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.insurance_chart_filings; routing public.insurance_verification_requests; tracking text; msg text=details->>'message';
begin
  select * into job from public.insurance_chart_filings where verification_id=verification for update;
  if not found or job.state<>expected then return false; end if;
  if not ((expected='pending' and next_state in ('sending','review','filed')) or
          (expected='review' and next_state='sending') or
          (expected='sending' and next_state in ('confirming','review','filed')) or
          (expected='confirming' and next_state in ('confirming','filed'))) then raise exception 'Invalid filing transition'; end if;
  if next_state='sending' then
    select * into strict routing from public.insurance_verification_requests where id=job.request_id for update;
    if coalesce(routing.ascend_chart_number,'') <> coalesce(details->>'matched_chart_number','') then
      raise exception 'Chart number changed during lookup. Filing will retry with the saved chart number.';
    end if;
  end if;
  job.patient_id=coalesce(details->>'patient_id',job.patient_id);
  job.document_id=coalesce(details->>'document_id',job.document_id);
  job.filename=coalesce(details->>'filename',job.filename);
  job.checksum=coalesce(details->>'checksum',job.checksum);
  job.byte_count=coalesce((details->>'byte_count')::int,job.byte_count);
  if next_state='filed' and (nullif(job.document_id,'') is null or nullif(job.patient_id,'') is null) then
    raise exception 'Missing Ascend receipt'; end if;
  update public.insurance_chart_filings set state=next_state,patient_id=job.patient_id,document_id=job.document_id,
    filename=job.filename,checksum=job.checksum,byte_count=job.byte_count,updated_at=now(),
    next_attempt=now()+interval '2 minutes' where verification_id=verification;
  tracking=case next_state when 'filed' then 'uploaded' when 'review' then 'failed' else 'uploading' end;
  update public.insurance_verifications set chart_upload_status=tracking,chart_upload_method='automated_api',
    dentrix_document_upload_status=case when next_state='filed' then 'success' else next_state end,
    dentrix_document_upload_error=msg,
    dentrix_patient_id=case when next_state='filed' then job.patient_id else dentrix_patient_id end,
    dentrix_document_id=case when next_state='filed' then job.document_id else dentrix_document_id end,
    dentrix_document_uploaded_at=case when next_state='filed' then coalesce(dentrix_document_uploaded_at,now()) else dentrix_document_uploaded_at end,
    chart_uploaded_at=case when next_state='filed' then coalesce(chart_uploaded_at,now()) else chart_uploaded_at end,
    dentrix_document_uploaded_by=case when next_state='filed' then coalesce(dentrix_document_uploaded_by,completed_by_user_id) else dentrix_document_uploaded_by end,
    dentrix_document_filename=case when next_state='filed' then job.filename else dentrix_document_filename end,
    dentrix_document_mime_type=case when next_state='filed' then 'PDF' else dentrix_document_mime_type end,
    dentrix_document_size_bytes=case when next_state='filed' then job.byte_count else dentrix_document_size_bytes end
    where id=verification;
  update public.insurance_verification_requests r set chart_upload_status=v.chart_upload_status,
    chart_upload_method=v.chart_upload_method,dentrix_document_upload_status=v.dentrix_document_upload_status,
    dentrix_document_upload_error=v.dentrix_document_upload_error,dentrix_document_id=v.dentrix_document_id,
    dentrix_patient_id=v.dentrix_patient_id,chart_uploaded_at=v.chart_uploaded_at,dentrix_document_uploaded_at=v.dentrix_document_uploaded_at,
    dentrix_document_uploaded_by=v.dentrix_document_uploaded_by,dentrix_document_filename=v.dentrix_document_filename,
    dentrix_document_mime_type=v.dentrix_document_mime_type,dentrix_document_size_bytes=v.dentrix_document_size_bytes
    from public.insurance_verifications v where r.id=job.request_id and v.id=verification;
  return true;
end; $$;

notify pgrst,'reload schema';

