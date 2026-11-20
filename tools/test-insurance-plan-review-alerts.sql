begin;
do $$
declare job insurance_internal.plan_entry_jobs; office uuid; initial_count integer; other_alerts jsonb;
begin
  select * into strict job from insurance_internal.plan_entry_jobs where state='needs_review' and plan_id is not null and receipt->>'reopened'='true' limit 1;
  select office_id into strict office from public.insurance_verification_requests where id=job.request_id;
  select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') into other_alerts from public.notifications n where metadata->>'plan_entry_verification_id' is distinct from job.verification_id::text;
  update insurance_internal.plan_entry_jobs set state=state where verification_id=job.verification_id;
  select count(*) into initial_count from public.notifications where metadata->>'plan_entry_verification_id'=job.verification_id::text and not coalesce(is_archived,false);
  if initial_count=0 then raise exception 'Review alerts missing'; end if;
  if exists(select 1 from public.notifications n where metadata->>'plan_entry_verification_id'=job.verification_id::text and not coalesce(is_archived,false)
    and (office_id<>office or not exists(select 1 from insurance_internal.review_recipients(office) r where r.user_id=n.user_id)
      or title<>'Insurance plan attached — benefit review needed' or metadata->>'plan_attached_verified'<>'true')) then raise exception 'Review alert target or attached wording incorrect'; end if;
  update insurance_internal.plan_entry_jobs set state=state where verification_id=job.verification_id;
  if initial_count<>(select count(*) from public.notifications where metadata->>'plan_entry_verification_id'=job.verification_id::text and not coalesce(is_archived,false)) then raise exception 'Duplicate review alert'; end if;
  update insurance_internal.plan_entry_jobs set plan_id=null,state=state where verification_id=job.verification_id;
  if exists(select 1 from public.notifications where metadata->>'plan_entry_verification_id'=job.verification_id::text and not coalesce(is_archived,false) and title<>'Insurance plan entry needs review') then raise exception 'Unattached policy mislabeled'; end if;
  if other_alerts is distinct from (select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.notifications n where metadata->>'plan_entry_verification_id' is distinct from job.verification_id::text) then raise exception 'Unrelated alert changed'; end if;
end;
$$;
rollback;
select 'PASS: attached vs unattached wording, exact office recipients, deduplication and unrelated-alert preservation; all test writes rolled back' as result;
