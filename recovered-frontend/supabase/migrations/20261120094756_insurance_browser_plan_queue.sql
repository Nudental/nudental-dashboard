-- References and machine-readable checks only; no names, DOBs or member IDs.
create table insurance_internal.plan_entry_jobs (
  verification_id uuid primary key references public.insurance_verifications(id),
  request_id uuid not null references public.insurance_verification_requests(id),
  source_hash text not null,
  state text not null default 'pending' check(state in ('pending','claimed','saving','reconciling','needs_review','succeeded')),
  claim_token uuid, lease_until timestamptz,
  patient_id text, plan_id text,
  reason_codes text[] not null default '{}',
  receipt jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index plan_entry_request on insurance_internal.plan_entry_jobs(request_id);
alter table insurance_internal.plan_entry_jobs enable row level security;
revoke all on insurance_internal.plan_entry_jobs from public,anon,authenticated;
grant select,insert,update on insurance_internal.plan_entry_jobs to service_role;
create policy plan_entry_service on insurance_internal.plan_entry_jobs for all to service_role using(true) with check(true);

create function insurance_internal.plan_source_hash(target uuid) returns text
language sql stable security invoker set search_path='' as $$
  select md5(jsonb_build_object('verification',to_jsonb(v)-array[
    'created_at','updated_at','pdf_storage_path','pdf_generated_at','pdf_checksum_sha256',
    'office_emailed_at','office_email_to','chart_upload_method','chart_upload_status',
    'dentrix_document_upload_status','dentrix_document_id','dentrix_patient_id',
    'dentrix_document_uploaded_at','dentrix_document_uploaded_by','dentrix_document_upload_error',
    'dentrix_document_filename','dentrix_document_mime_type','dentrix_document_size_bytes',
    'manual_chart_uploaded_at','manual_chart_uploaded_by','manual_chart_upload_note',
    'chart_uploaded_at','chart_uploaded_by_user_id','chart_upload_error'],
    'request',jsonb_build_object('id',r.id,'verification_id',r.verification_id,
      'patient_first_name',r.patient_first_name,'patient_last_name',r.patient_last_name,
      'patient_dob',r.patient_dob,'ascend_chart_number',r.ascend_chart_number,
      'office_id',r.office_id,'office_name',r.office_name,'cancelled',r.status='cancelled'))::text)
  from public.insurance_verifications v join public.insurance_verification_requests r on r.id=v.request_id
  where v.id=target;
$$;

create function insurance_internal.enqueue_plan_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed' and new.request_id is not null then
    insert into insurance_internal.plan_entry_jobs(verification_id,request_id,source_hash)
    values(new.id,new.request_id,insurance_internal.plan_source_hash(new.id)) on conflict do nothing;
  end if;
  return null;
end;
$$;
-- Deferred: the application's request link is updated after the breakdown row.
create constraint trigger insurance_plan_entry_enqueue after insert or update of status on public.insurance_verifications
deferrable initially deferred for each row execute function insurance_internal.enqueue_plan_entry();

create function insurance_internal.claim_plan_entry(target uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job insurance_internal.plan_entry_jobs; token uuid:=gen_random_uuid(); current_hash text;
begin
  select * into job from insurance_internal.plan_entry_jobs where verification_id=target for update;
  if not found then return jsonb_build_object('status','NOT_QUEUED'); end if;
  if job.state in ('succeeded','needs_review') then return jsonb_build_object('status',job.state); end if;
  if job.lease_until>clock_timestamp() then return jsonb_build_object('status','BUSY'); end if;
  current_hash:=insurance_internal.plan_source_hash(target);
  if current_hash is distinct from job.source_hash then
    update insurance_internal.plan_entry_jobs set state='needs_review',reason_codes=array['SOURCE_CHANGED'],updated_at=now() where verification_id=target;
    return jsonb_build_object('status','NEEDS_HUMAN_REVIEW','reason','SOURCE_CHANGED');
  end if;
  -- A crashed attempt, even before its recorded save, must reconcile before writing.
  update insurance_internal.plan_entry_jobs set state=case when job.state='pending' then 'claimed' else 'reconciling' end,
    claim_token=token,lease_until=clock_timestamp()+interval '30 minutes',updated_at=now() where verification_id=target;
  return jsonb_build_object('status',case when job.state='pending' then 'CLAIMED' else 'RECONCILE_ONLY' end,'claim_token',token,'source_hash',current_hash);
end;
$$;

create function insurance_internal.plan_entry_before_save(target uuid,token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  update insurance_internal.plan_entry_jobs j set state='saving',updated_at=now()
  where j.verification_id=target and j.claim_token=token and j.state in ('claimed','saving')
    and j.lease_until>clock_timestamp() and j.source_hash=insurance_internal.plan_source_hash(target)
    and exists(select 1 from public.insurance_verifications v join public.insurance_verification_requests r on r.id=v.request_id
      where v.id=target and v.status='completed' and r.status<>'cancelled' and r.verification_id=v.id);
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;

create function insurance_internal.finish_plan_entry(target uuid,token uuid,outcome text,patient text default null,plan text default null,checks jsonb default '{}',reasons text[] default '{}') returns boolean
language plpgsql security invoker set search_path='' as $$
declare job insurance_internal.plan_entry_jobs; key text; final_state text;
begin
  select * into job from insurance_internal.plan_entry_jobs where verification_id=target for update;
  if not found or job.claim_token is distinct from token or job.state not in ('claimed','saving','reconciling') or job.lease_until<=clock_timestamp() then return false; end if;
  if outcome not in ('SUCCESS','NEEDS_HUMAN_REVIEW','ERROR_PATIENT_NOT_FOUND_OR_DUPLICATE','SESSION_REQUIRED','SAVE_UNCERTAIN') then raise exception 'Unsupported result code'; end if;
  if exists(select 1 from unnest(reasons) r where r!~'^[A-Z][A-Z0-9_]{0,79}$') then raise exception 'Reason codes only'; end if;
  if patient is not null and patient!~'^[0-9]{1,30}$' or plan is not null and plan!~'^[0-9]{1,30}$' then raise exception 'Invalid Ascend identifier'; end if;
  -- Only booleans with approved field names are accepted in the audit receipt.
  if jsonb_typeof(checks)<>'object' or exists(select 1 from jsonb_each(checks) c where c.key not in ('patient','office','carrier','payer','group','subscriber','relationship','order','effective_date','benefits','reopened') or c.value not in ('true'::jsonb,'false'::jsonb)) then raise exception 'Invalid receipt'; end if;
  if outcome='SUCCESS' then
    if patient is null or plan is null then raise exception 'Saved identifiers required'; end if;
    foreach key in array array['patient','office','carrier','payer','group','subscriber','relationship','order','effective_date','benefits','reopened'] loop
      if checks->key is distinct from 'true'::jsonb then raise exception 'Complete UI readback required'; end if;
    end loop;
    if job.source_hash is distinct from insurance_internal.plan_source_hash(target) then raise exception 'Source changed during entry'; end if;
  end if;
  final_state:=case when outcome='SUCCESS' then 'succeeded' when outcome='SAVE_UNCERTAIN' then 'reconciling' when outcome='SESSION_REQUIRED' and job.state='claimed' then 'pending' when outcome='SESSION_REQUIRED' then 'reconciling' else 'needs_review' end;
  update insurance_internal.plan_entry_jobs set state=final_state,patient_id=patient,plan_id=plan,
    receipt=checks,reason_codes=reasons,claim_token=null,lease_until=null,updated_at=now() where verification_id=target;
  insert into public.insurance_verification_audit_log(request_id,verification_id,event_type,performed_by_name,new_status,metadata)
    values(job.request_id,target,'ascend_plan_entry','Yabezy',final_state,
      jsonb_build_object('status',outcome,'patient_id',patient,'plan_id',plan,'checks',checks,'reason_codes',reasons));
  return true;
end;
$$;

revoke all on function insurance_internal.plan_source_hash(uuid),insurance_internal.enqueue_plan_entry(),insurance_internal.claim_plan_entry(uuid),insurance_internal.plan_entry_before_save(uuid,uuid),insurance_internal.finish_plan_entry(uuid,uuid,text,text,text,jsonb,text[]) from public,anon,authenticated;
grant execute on function insurance_internal.plan_source_hash(uuid),insurance_internal.claim_plan_entry(uuid),insurance_internal.plan_entry_before_save(uuid,uuid),insurance_internal.finish_plan_entry(uuid,uuid,text,text,text,jsonb,text[]) to service_role;
