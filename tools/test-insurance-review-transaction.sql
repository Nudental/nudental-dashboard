-- All fixtures are transaction-isolated; no email worker can see them.
begin;
set local statement_timeout='45s';
do $audit$
declare o record; req uuid; ver uuid; event uuid; second_event uuid; person record; outsider uuid; notice uuid;
  verifier uuid; n integer; expected integer; blocked boolean; target_email text;
  fixture jsonb := $fixture${"date":"2026-11-19","patient_dob":"2026-11-19","subscriber_dob":"2026-11-19","patient_name":"Synthetic Audit","subscriber_name":"Synthetic Subscriber","insurance_name":"TEST ONLY","insurance_phone":"2025550100","member_id":"NOT-A-REAL-MEMBER","claims_address":"Carrier confirmed answer","group_number":"Carrier confirmed answer","employer_group_name":"Carrier confirmed answer","payor_id":"Carrier confirmed answer","fee_schedule":"Carrier confirmed answer","network":"In","year_type":"Calendar","oon_available":true,"eff_date":"2026-11-19","yearly_max":50,"remaining_max":50,"deductible":50,"individual_deductible_remaining":50,"family_deductible":50,"deductible_met":true,"family_deductible_met":true,"waiting_period":true,"missing_tooth_clause":true,"ucr_allowed":true,"self_funded":true,"dep_age_limit":26,"student_age_limit":26,"pct_prev":50,"pct_basic":50,"pct_endo":50,"pct_os":50,"pct_perio":50,"pct_major":50,"pct_crowns":50,"pct_bridges":50,"pct_dentures":50,"max_applies":{"preventive":true,"basic":true,"major":true},"ded_applies":{"preventive":true,"basic":true,"major":true},"notes":"Carrier confirmed answer","prev_diag":{"comp_exam_d0150":"Carrier confirmed answer","periodic_exam_d0120":"Carrier confirmed answer","limited_exam_d0140":"Carrier confirmed answer","prophy":"Carrier confirmed answer","bw_d0272_d0274":"Carrier confirmed answer","pa_d0220":"Carrier confirmed answer","fmx_pano":"Carrier confirmed answer","ct_scan":"Carrier confirmed answer","intraoral_d0350":"Carrier confirmed answer","sealant_d1351":"Carrier confirmed answer","sealant_age_limit":"Carrier confirmed answer","sealant_covered_teeth":"Carrier confirmed answer","fluoride":"Carrier confirmed answer","fluoride_age_limit":"Carrier confirmed answer","shared_freq":true,"tx_with_limited":true,"fmx_pano_shared":true,"eligible_fmx_pano":true},"restorative":{"post_comp_pct":50,"post_comp_freq":"Carrier confirmed answer","post_comp_downgraded":true,"post_comp_downgrade_codes":"Carrier confirmed answer","porc_crown_pct":50,"porc_crown_freq":"Carrier confirmed answer","porc_crown_downgrade":true,"porc_crown_downgrade_code":"Carrier confirmed answer","onlay_pct":50,"onlay_freq":"Carrier confirmed answer","onlay_downgrade":true,"onlay_downgrade_code":"Carrier confirmed answer","crowns_paid_on":"Prep Date","bridges_dentures_pct":50,"bridges_dentures_freq":"Carrier confirmed answer"},"periodontics":{"srp_pct":50,"srp_freq":"Carrier confirmed answer","perio_maint_pct":50,"perio_maint_freq":"Carrier confirmed answer","debridement_pct":50,"debridement_freq":"Carrier confirmed answer","crown_lengthening_pct":50,"crown_lengthening_freq":"Carrier confirmed answer","osseous_pct":50,"osseous_freq":"Carrier confirmed answer","tissue_graft_pct":50,"tissue_graft_freq":"Carrier confirmed answer","arestin_pct":50,"arestin_freq":"Carrier confirmed answer","srp_quads":"Carrier confirmed answer","healing_period_srp_pmr":"Carrier confirmed answer","perio_maint_shared_prophy":true},"oral_surgery":{"os_to_medical_primary":true,"d7210_pct":50,"d7220_pct":50,"d7230_pct":50,"d7240_pct":50,"d7241_pct":50,"d7250_pct":50,"d7251_pct":50,"bone_graft_pct":50,"bone_graft_freq":"Carrier confirmed answer","bone_graft_implant_pct":50,"bone_graft_implant_freq":"Carrier confirmed answer","gtr_pct":50,"gtr_freq":"Carrier confirmed answer","gtr_implant_pct":50,"gtr_implant_freq":"Carrier confirmed answer","incision_drainage_pct":50,"incision_drainage_freq":"Carrier confirmed answer"},"implants":{"implant_body_pct":50,"implant_abutment_pct":50,"implant_crown_pct":50,"porc_pontic_pct":50,"abutment_retainer_pct":50,"implant_freq":"Carrier confirmed answer","implant_downgrade":"Carrier confirmed answer","abutment_downgrade":"Carrier confirmed answer"},"ortho":{"ortho_pct":50,"ortho_max":50,"ortho_age_limit":"Carrier confirmed answer","ortho_deductible":true},"misc":{"consult_pct":50,"consult_freq":"Carrier confirmed answer","nitrous_pct":50,"nitrous_freq":"Carrier confirmed answer","nightguard_pct":50,"nightguard_freq":"Carrier confirmed answer","bruxism_or_osseous":"Carrier confirmed answer"},"history":{"has_history":true,"history_notes":"Carrier confirmed answer"},"rep_name":"Carrier confirmed answer","ref_number":"TEST-REF","employee_initials":"QA","office":"Eatontown"}$fixture$::jsonb;
begin
  select user_id into strict verifier from insurance_internal.current_verifier();
  for o in select id,name from public.offices where is_active order by name loop
    expected:=case o.name when 'Barnegat' then 4 when 'Brick' then 3 when 'Eatontown' then 3 when 'Staten Island' then 2 else 0 end;
    if expected=0 then raise exception 'Unexpected office; update review test expectations'; end if;
    select p.id into strict outsider from public.user_profiles p where p.role='staff' and p.office_id=o.id and lower(p.email)=lower((select email from public.offices where id=o.id)) and p.is_active;
    perform set_config('request.jwt.claim.sub',outsider::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    insert into public.insurance_verification_requests(office_id,submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status)
      values(o.id,current_date,'SYSTEM ROLLBACK TEST',current_date,'09:00','SYSTEM REVIEW AUDIT',o.name||' ROLLBACK','2000-01-01','','TEST ONLY','2025550100','TEST-NOT-VALID','requested') returning id into req;
    perform set_config('role','none',true);
    perform set_config('request.jwt.claim.sub',verifier::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',verifier,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    insert into public.insurance_verifications(request_id,status,patient_name) values(req,'draft','SYSTEM REVIEW AUDIT') returning id into ver;
    update public.insurance_verifications v set "date"=filled."date","patient_dob"=filled."patient_dob","subscriber_dob"=filled."subscriber_dob","patient_name"=filled."patient_name","subscriber_name"=filled."subscriber_name","insurance_name"=filled."insurance_name","insurance_phone"=filled."insurance_phone","member_id"=filled."member_id","claims_address"=filled."claims_address","group_number"=filled."group_number","employer_group_name"=filled."employer_group_name","payor_id"=filled."payor_id","fee_schedule"=filled."fee_schedule","network"=filled."network","year_type"=filled."year_type","oon_available"=filled."oon_available","eff_date"=filled."eff_date","yearly_max"=filled."yearly_max","remaining_max"=filled."remaining_max","deductible"=filled."deductible","individual_deductible_remaining"=filled."individual_deductible_remaining","family_deductible"=filled."family_deductible","deductible_met"=filled."deductible_met","family_deductible_met"=filled."family_deductible_met","waiting_period"=filled."waiting_period","missing_tooth_clause"=filled."missing_tooth_clause","ucr_allowed"=filled."ucr_allowed","self_funded"=filled."self_funded","dep_age_limit"=filled."dep_age_limit","student_age_limit"=filled."student_age_limit","pct_prev"=filled."pct_prev","pct_basic"=filled."pct_basic","pct_endo"=filled."pct_endo","pct_os"=filled."pct_os","pct_perio"=filled."pct_perio","pct_major"=filled."pct_major","pct_crowns"=filled."pct_crowns","pct_bridges"=filled."pct_bridges","pct_dentures"=filled."pct_dentures","max_applies"=filled."max_applies","ded_applies"=filled."ded_applies","notes"=filled."notes","prev_diag"=filled."prev_diag","restorative"=filled."restorative","periodontics"=filled."periodontics","oral_surgery"=filled."oral_surgery","implants"=filled."implants","ortho"=filled."ortho","misc"=filled."misc","history"=filled."history","rep_name"=filled."rep_name","ref_number"=filled."ref_number","employee_initials"=filled."employee_initials","office"=filled."office",status='completed' from jsonb_populate_record(null::public.insurance_verifications,fixture) filled where v.id=ver;
    perform set_config('role','none',true);
    if not exists(select 1 from public.insurance_chart_filings where verification_id=ver and state='pending') then raise exception 'Completed breakdown was not queued'; end if;
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims','{"role":"service_role"}',true);
    perform set_config('role','service_role',true);
    if not public.insurance_filing_state(ver,'pending','review','{"message":"Synthetic chart match needs review"}') then raise exception 'Filing transition failed'; end if;
    perform set_config('role','none',true);
    select id into strict event from public.insurance_review_events where request_id=req and closed_at is null;
    select count(*) into n from public.insurance_review_notices where event_id=event;
    if n<>expected+1 then raise exception 'Incorrect mail count for %: %',o.name,n; end if;
    select count(*) into n from public.notifications where metadata->>'review_event_id'=event::text;
    if n<>expected then raise exception 'Incorrect dashboard count for %: %',o.name,n; end if;
    if not exists(select 1 from public.insurance_review_notices n join insurance_internal.current_verifier() p on p.email=n.recipient where n.event_id=event) then raise exception 'Patricia omitted'; end if;
    if exists(select 1 from public.insurance_review_notices n where n.event_id=event and not exists(select 1 from insurance_internal.review_recipients(o.id) p where p.email=n.recipient)) then raise exception 'Unexpected recipient'; end if;
    if exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text and (message like '%SYSTEM REVIEW AUDIT%' or message like '%2000-01-01%' or message like '%TEST-NOT-VALID%')) then raise exception 'Patient details leaked to alert'; end if;
    for person in select p.id,p.full_name from insurance_internal.review_recipients(o.id) r join public.user_profiles p on p.id=r.user_id where r.office_staff loop
      perform set_config('request.jwt.claim.sub',person.id::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',person.id,'role','authenticated')::text,true);
      perform set_config('role','authenticated',true);
      if not exists(select 1 from public.insurance_workflow_offices() x where x.id=o.id and x.can_submit) then raise exception 'Front-office access missing: %',person.full_name; end if;
      if (select count(*) from public.insurance_work_requests where id=req)<>1 then raise exception 'Request link unavailable to %',person.full_name; end if;
      if (select count(*) from public.notifications where metadata->>'review_event_id'=event::text)<>1 then raise exception 'Notification RLS failed for %',person.full_name; end if;
      blocked:=false;
      begin perform count(*) from public.insurance_review_notices; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Staff can read private email queue'; end if;
      perform set_config('role','none',true);
    end loop;
    select id into strict outsider from public.user_profiles where role='staff' and office_id<>o.id and is_active and lower(coalesce(job_title,'')) like '%front desk%' limit 1;
    perform set_config('request.jwt.claim.sub',outsider::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    if exists(select 1 from public.insurance_work_requests where id=req) or exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text) then raise exception 'Cross-office access leak'; end if;
    blocked:=false;
    begin perform * from public.insurance_review_destination(gen_random_uuid()); exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Staff can resolve private email destinations'; end if;
    perform set_config('role','none',true);
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims','{"role":"service_role"}',true);
    update public.insurance_verification_requests set dentrix_document_upload_status='review' where id=req;
    if (select count(*) from public.insurance_review_events where request_id=req)<>1 or (select count(*) from public.insurance_review_notices where event_id=event)<>expected+1 then raise exception 'Duplicate review alerted twice'; end if;
    select n.id,n.recipient into notice,target_email from public.insurance_review_notices n join public.user_profiles p on lower(trim(p.email))=n.recipient where n.event_id=event and p.role='staff' limit 1;
    perform set_config('role','service_role',true);
    if (select count(*) from public.insurance_review_destination(notice))<>1 then raise exception 'Valid worker destination unavailable'; end if;
    perform set_config('role','none',true);
    update public.user_profiles set is_active=false where lower(trim(email))=target_email;
    if exists(select 1 from public.insurance_review_destination(notice)) then raise exception 'Deactivated staff still eligible'; end if;
    update public.user_profiles set is_active=true where lower(trim(email))=target_email;
    perform set_config('role','service_role',true);
    perform public.insurance_filing_state(ver,'review','sending','{}');
    perform set_config('role','none',true);
    if exists(select 1 from public.insurance_review_notices where event_id=event and cancelled_at is null) or exists(select 1 from public.notifications where metadata->>'review_event_id'=event::text and not is_archived) or exists(select 1 from public.insurance_review_destination(notice)) then raise exception 'Resolved review left active alerts'; end if;
    perform set_config('role','service_role',true);
    perform public.insurance_filing_state(ver,'sending','review','{"message":"Synthetic second review"}');
    perform set_config('role','none',true);
    select id into strict second_event from public.insurance_review_events where request_id=req and closed_at is null;
    if second_event=event or (select count(*) from public.insurance_review_events where request_id=req)<>2 then raise exception 'New review episode missing'; end if;
    if (select count(*) from public.insurance_review_notices where event_id=second_event)<>expected+1 then raise exception 'New episode recipients missing'; end if;
  end loop;
end;
$audit$;
rollback;
select 'PASS: four-office completion-to-review flow; 12 front-office accounts; Patricia; office isolation; recipient revocation; repeat-event deduplication; resolution; new review episode; no committed fixtures' result,
(select count(*) from public.insurance_verification_requests) requests,
(select count(*) from public.insurance_office_notices) old_notices,
(select count(*) from public.insurance_review_events) review_events,
(select count(*) from public.insurance_review_notices) review_notices,
(select count(*) from public.notifications) notifications;

