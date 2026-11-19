do $$
declare o record; req uuid; ver uuid; person uuid; verifier uuid; outsider uuid; event uuid;
  expected integer; n integer; blocked boolean; result jsonb;
begin
  select user_id into strict verifier from insurance_internal.current_verifier();
  for o in select id,name,email from public.offices where is_active order by name loop
    select id into strict person from public.user_profiles where office_id=o.id and lower(email)=lower(o.email) and role='staff' and is_active;
    perform set_config('request.jwt.claim.sub',person::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',person,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    insert into public.insurance_verification_requests(office_id,submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status,ascend_chart_number)
      values(o.id,current_date,'SYSTEM ROLLBACK TEST',current_date,'09:00','SYNTHETIC',o.name||' AUDIT','2000-01-01','','TEST ONLY','2025550100','TEST-NOT-VALID','requested','test1') returning id into req;
    result=public.insurance_request_action(req,'chart_number','test2');
    if result->>'ascend_chart_number'<>'TEST2' then raise exception 'Office chart number save failed'; end if;
    if (select ascend_chart_number from public.insurance_work_requests where id=req)<>'TEST2' then raise exception 'Chart field unavailable in operational view'; end if;
    blocked=false;
    begin perform public.insurance_request_action(req,'needs_info','Synthetic missing insurance'); exception when insufficient_privilege then blocked=true; end;
    if not blocked then raise exception 'Office can act as verifier'; end if;
    perform set_config('role','none',true);
    perform set_config('request.jwt.claim.sub',verifier::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',verifier,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    insert into public.insurance_verifications(request_id,status,patient_name) values(req,'draft','SYNTHETIC AUDIT') returning id into ver;
    perform public.insurance_request_action(req,'needs_info','Synthetic insurer could not locate policy; confirm the card.');
    perform public.insurance_request_action(req,'needs_info','Synthetic insurer could not locate policy; confirm the card.');
    perform set_config('role','none',true);
    select id into strict event from public.insurance_review_events where request_id=req and closed_at is null and issue_kind='needs_info';
    select count(distinct email) into expected from insurance_internal.review_recipients(o.id);
    if (select count(*) from public.insurance_review_notices where event_id=event)<>expected then raise exception 'Missing or duplicate Needs Info emails for %',o.name; end if;
    select count(*) into expected from insurance_internal.review_recipients(o.id) where office_staff;
    if (select count(*) from public.notifications where metadata->>'review_event_id'=event::text)<>expected then raise exception 'Incorrect office dashboard count'; end if;
    if exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text and (office_id<>o.id or message like '%SYNTHETIC%' or message like '%policy%')) then raise exception 'Wrong office or patient data in alert'; end if;
    select id into outsider from public.user_profiles where office_id<>o.id and role='staff' and is_active and lower(coalesce(job_title,'')) like '%front desk%' limit 1;
    perform set_config('request.jwt.claim.sub',outsider::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    blocked=false;
    begin perform public.insurance_request_action(req,'chart_number','WRONG'); exception when insufficient_privilege then blocked=true; end;
    if not blocked then raise exception 'Cross-office chart edit allowed'; end if;
    if exists(select 1 from public.insurance_work_requests where id=req) or exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text) then raise exception 'Cross-office read leak'; end if;
    perform set_config('role','none',true);
    perform set_config('request.jwt.claim.sub',person::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',person,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    result=public.insurance_request_action(req,'resume','Synthetic corrected card confirmed by office.');
    if result->>'status'<>'in_progress' then raise exception 'Request did not resume'; end if;
    perform set_config('role','none',true);
    if exists(select 1 from public.insurance_review_events where id=event and closed_at is null) or
       exists(select 1 from public.insurance_review_notices where event_id=event and sent_at is null and cancelled_at is null) or
       exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text and not is_archived) then raise exception 'Resolved Needs Info alerts still active'; end if;
    -- A claim based on an old chart number cannot advance to sending.
    insert into public.insurance_chart_filings(verification_id,request_id) values(ver,req);
    blocked=false;
    begin perform public.insurance_filing_state(ver,'pending','sending','{"matched_chart_number":"OLD","patient_id":"synthetic","filename":"test"}');
    exception when others then blocked=sqlerrm like 'Chart number changed%'; end;
    if not blocked then raise exception 'Stale chart number could claim a filing'; end if;
  end loop;
end $$;
