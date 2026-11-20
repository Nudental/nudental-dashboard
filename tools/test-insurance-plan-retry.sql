begin;
do $$
declare j insurance_internal.plan_entry_jobs; refreshed insurance_internal.plan_entry_jobs;
  r public.insurance_verification_requests; result jsonb; token uuid; fingerprint text;
  event uuid; pdf_event uuid; expected integer; count_before integer; rejected boolean;
  actor_id uuid; other_actor uuid; original_receipt jsonb;
  checks jsonb:='{"patient":true,"office":true,"chart":true,"source":true,"all_policies":true,"all_groups":true,"subscriber":true,"prior_receipts":true}';
begin
  select * into strict j from insurance_internal.plan_entry_jobs
    where state='needs_review' and plan_id is not null and receipt->>'reopened'='true' order by updated_at limit 1;
  select * into strict r from public.insurance_verification_requests where id=j.request_id;
  original_receipt:=j.receipt;
  update insurance_internal.plan_entry_jobs set state=state where verification_id=j.verification_id;
  select id into strict event from public.insurance_review_events where request_id=r.id and issue_kind='plan_entry' and closed_at is null;
  select count(distinct email) into expected from insurance_internal.review_recipients(r.office_id);
  if expected=0 or (select count(*) from public.insurance_review_notices where event_id=event)<>expected then raise exception 'Missing plan review recipients'; end if;
  if exists(select 1 from public.insurance_review_notices n where n.event_id=event and not exists(
    select 1 from insurance_internal.review_recipients(r.office_id) p where p.email=n.recipient)) then raise exception 'Wrong-office email'; end if;
  if exists(select 1 from public.insurance_review_notices n where n.event_id=event and not exists(
    select 1 from public.insurance_review_destination(n.id) d where d.email=n.recipient and d.request_id=r.id and d.issue_kind='plan_entry')) then raise exception 'Plan email destination unavailable'; end if;
  update insurance_internal.plan_entry_jobs set state=state where verification_id=j.verification_id;
  if (select count(*) from public.insurance_review_notices where event_id=event)<>expected then raise exception 'Duplicate review notices'; end if;

  update public.insurance_verification_requests set dentrix_document_upload_status='review' where id=r.id;
  select id into strict pdf_event from public.insurance_review_events where request_id=r.id and issue_kind='filing' and closed_at is null;
  update public.insurance_verification_requests set dentrix_document_upload_status='pending' where id=r.id;
  if (select closed_at is not null from public.insurance_review_events where id=event) then raise exception 'PDF resolution closed plan review'; end if;
  if not (select closed_at is not null from public.insurance_review_events where id=pdf_event) then raise exception 'PDF review did not close'; end if;

  select id into strict actor_id from public.user_profiles where role='super_admin' and is_active and is_approved and status='Active' limit 1;
  perform set_config('request.jwt.claim.sub',actor_id::text,true);
  if public.insurance_plan_entry_status(r.id)->>'state'<>'needs_review' then raise exception 'Authorized status unavailable'; end if;
  select p.id into other_actor from public.user_profiles p where p.is_active and p.is_approved and p.status='Active'
    and p.office_id is not null and p.office_id<>r.office_id and p.role<>'super_admin'
    and not exists(select 1 from public.user_office_assignments a where a.user_id=p.id and (a.office_id=r.office_id or a.all_offices)) limit 1;
  if other_actor is null then raise exception 'No cross-office test principal'; end if;
  perform set_config('request.jwt.claim.sub',other_actor::text,true);
  rejected:=false;
  begin perform public.insurance_request_plan_retry(r.id,j.updated_at,'Test correction confirmed');
    exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Wrong-office retry permitted'; end if;
  rejected:=false;
  begin perform public.insurance_plan_entry_status(r.id);
    exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Wrong-office status exposed'; end if;
  perform set_config('request.jwt.claim.sub',actor_id::text,true);

  rejected:=false;
  begin perform public.insurance_request_plan_retry(r.id,j.updated_at,'');
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Retry without resolution allowed'; end if;
  -- A source correction is deliberately rebased only by the audited retry action.
  update insurance_internal.plan_entry_jobs set source_hash='old-source' where verification_id=j.verification_id;
  result:=public.insurance_request_plan_retry(r.id,j.updated_at,'Test only: confirmed correction and requested reconciliation.');
  if result->>'state'<>'reconciling' then raise exception 'Retry bypassed reconciliation'; end if;
  select * into strict refreshed from insurance_internal.plan_entry_jobs where verification_id=j.verification_id;
  if refreshed.receipt is distinct from original_receipt or refreshed.plan_id is distinct from j.plan_id
    or refreshed.patient_id is distinct from j.patient_id then raise exception 'Retry discarded prior receipt'; end if;
  if refreshed.source_hash is distinct from insurance_internal.plan_source_hash(j.verification_id) then raise exception 'Source correction not rebased'; end if;
  if exists(select 1 from public.insurance_review_notices n where n.event_id=event and n.sent_at is null and n.cancelled_at is null) then raise exception 'Obsolete review email still eligible'; end if;
  if exists(select 1 from public.insurance_review_notices n cross join lateral public.insurance_review_destination(n.id) d where n.event_id=event) then raise exception 'Resolved retry email destination remains'; end if;
  rejected:=false;
  begin perform public.insurance_request_plan_retry(r.id,j.updated_at,'Duplicate click on the previous retry.');
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Duplicate retry accepted'; end if;

  result:=insurance_internal.claim_plan_entry(j.verification_id); token:=(result->>'claim_token')::uuid; fingerprint:=result->>'source_hash';
  if result->>'status'<>'RECONCILE_ONLY' then raise exception 'Retry permitted an initial write'; end if;
  if insurance_internal.plan_entry_before_save(j.verification_id,token) then raise exception 'Unreconciled retry can save'; end if;
  if insurance_internal.authorize_reconciled_plan_entry(j.verification_id,gen_random_uuid(),fingerprint,j.patient_id,j.plan_id,'REUSE_EXISTING',checks) then raise exception 'Wrong token accepted'; end if;
  if insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,'stale',j.patient_id,j.plan_id,'REUSE_EXISTING',checks) then raise exception 'Stale source accepted'; end if;
  rejected:=false;
  begin perform insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,fingerprint,j.patient_id,j.plan_id,'REUSE_EXISTING',checks-'all_policies');
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Incomplete duplicate check accepted'; end if;
  rejected:=false;
  begin perform insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,fingerprint,j.patient_id,j.plan_id,'ATTACH_MISSING',checks);
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Previously recorded policy can be attached again'; end if;
  rejected:=false;
  begin perform insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,fingerprint,'999999999999',j.plan_id,'REUSE_EXISTING',checks);
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Retry changed previously recorded patient'; end if;
  if not insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,fingerprint,j.patient_id,j.plan_id,'REUSE_EXISTING',checks) then raise exception 'Verified reconciliation rejected'; end if;
  if not insurance_internal.plan_entry_before_save(j.verification_id,token) then raise exception 'Reconciled save blocked'; end if;
  if not insurance_internal.finish_plan_entry(j.verification_id,token,'NEEDS_HUMAN_REVIEW',j.patient_id,j.plan_id,j.receipt,array['COVERAGE_TABLE_SAVE_FAILED']) then raise exception 'Retry failure could not be recorded'; end if;
  select id into strict event from public.insurance_review_events where request_id=r.id and issue_kind='plan_entry' and closed_at is null;
  if (select count(*) from public.insurance_review_notices where event_id=event)<>expected then raise exception 'Retry failure did not notify exactly once'; end if;
  select * into strict refreshed from insurance_internal.plan_entry_jobs where verification_id=j.verification_id;
  result:=insurance_internal.queue_plan_entry_retry(r.id,refreshed.updated_at,'Test only: resolved technical failure.',jsonb_build_object('name','Test worker'));
  result:=insurance_internal.claim_plan_entry(j.verification_id); token:=(result->>'claim_token')::uuid;
  if not insurance_internal.authorize_reconciled_plan_entry(j.verification_id,token,result->>'source_hash',j.patient_id,j.plan_id,'REUSE_EXISTING',checks) then raise exception 'Second reviewed retry blocked'; end if;
  if not insurance_internal.finish_plan_entry(j.verification_id,token,'SUCCESS',j.patient_id,j.plan_id,
    '{"patient":true,"office":true,"carrier":true,"payer":true,"group":true,"subscriber":true,"relationship":true,"order":true,"effective_date":true,"benefits":true,"reopened":true}') then raise exception 'Verified success blocked'; end if;
  if insurance_internal.claim_plan_entry(j.verification_id)->>'status'<>'succeeded' then raise exception 'Successful entry replayed'; end if;
  select * into strict refreshed from insurance_internal.plan_entry_jobs where verification_id=j.verification_id;
  rejected:=false;
  begin perform insurance_internal.queue_plan_entry_retry(r.id,refreshed.updated_at,'Attempt to replay successful entry.',jsonb_build_object('name','Test worker'));
    exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Successful entry allowed retry'; end if;
  if exists(select 1 from public.insurance_review_events where request_id=r.id and issue_kind='plan_entry' and closed_at is null) then raise exception 'Success left review open'; end if;
  if has_function_privilege('anon','public.insurance_request_plan_retry(uuid,timestamptz,text)','execute') or
    has_function_privilege('authenticated','insurance_internal.authorize_reconciled_plan_entry(uuid,uuid,text,text,text,text,jsonb)','execute') or
    has_function_privilege('authenticated','insurance_internal.queue_plan_entry_retry(uuid,timestamptz,text,jsonb)','execute') then raise exception 'Worker privilege exposed'; end if;
end $$;
rollback;
select 'PASS: office email routing, notice deduplication, separate PDF review, stale/double-click rejection, scoped access, source rebase, retained receipts, inspection-only retry, token/source checks, existing-policy reuse, repeat failure notifications and completed-entry no-op; all writes rolled back' as result;
