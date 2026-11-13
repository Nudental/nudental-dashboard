-- New completions only. Each job belongs to one locked breakdown.
create table public.insurance_chart_filings (
  verification_id uuid primary key references public.insurance_verifications(id),
  request_id uuid not null unique references public.insurance_verification_requests(id),
  state text not null default 'pending' check (state in ('pending','review','sending','confirming','filed')),
  patient_id text, document_id text, filename text, checksum text, byte_count integer,
  next_attempt timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.insurance_chart_filings enable row level security;
revoke all on public.insurance_chart_filings from public,anon,authenticated;
grant select,update on public.insurance_chart_filings to service_role;

create function insurance_internal.queue_chart_filing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.request_id is not null and new.dentrix_document_id is null and new.chart_upload_status not in ('uploaded','manual_uploaded') then
    insert into public.insurance_chart_filings(verification_id,request_id) values(new.id,new.request_id) on conflict do nothing;
    update public.insurance_verifications set chart_upload_status='pending',dentrix_document_upload_status='pending' where id=new.id;
    update public.insurance_verification_requests set chart_upload_status='pending',dentrix_document_upload_status='pending' where id=new.request_id;
  end if;
  return null;
end; $$;
revoke all on function insurance_internal.queue_chart_filing() from public,anon,authenticated;
create trigger queue_chart_on_completion after update of status on public.insurance_verifications for each row
when (new.status='completed' and old.status is distinct from 'completed') execute function insurance_internal.queue_chart_filing();
create trigger queue_chart_completed_insert after insert on public.insurance_verifications for each row
when (new.status='completed') execute function insurance_internal.queue_chart_filing();

create function public.insurance_filing_state(verification uuid, expected text, next_state text, details jsonb default '{}') returns boolean
language plpgsql security definer set search_path='' as $$
declare job public.insurance_chart_filings; tracking text; msg text=details->>'message';
begin
  select * into job from public.insurance_chart_filings where verification_id=verification for update;
  if not found or job.state<>expected then return false; end if;
  if not ((expected='pending' and next_state in ('sending','review','filed')) or
          (expected='review' and next_state='sending') or
          (expected='sending' and next_state in ('confirming','review','filed')) or
          (expected='confirming' and next_state in ('confirming','filed'))) then raise exception 'Invalid filing transition'; end if;
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
revoke all on function public.insurance_filing_state(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.insurance_filing_state(uuid,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
