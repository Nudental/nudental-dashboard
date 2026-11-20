begin;
do $$
declare v uuid; token uuid; result jsonb; saved boolean; rejected boolean:=false; fingerprint text; other_jobs jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(j) order by j.verification_id),'[]'::jsonb) into other_jobs from insurance_internal.plan_entry_jobs j;
  select x.id into strict v from public.insurance_verifications x where x.status='completed' and x.request_id is not null
    and not exists(select 1 from insurance_internal.plan_entry_jobs j where j.verification_id=x.id) order by x.completed_at desc limit 1;
  if exists(select 1 from insurance_internal.plan_entry_jobs where verification_id=v) then raise exception 'Test requires unqueued source'; end if;
  update public.insurance_verifications set status=status where id=v;
  set constraints insurance_plan_entry_enqueue immediate;
  if (select count(*) from insurance_internal.plan_entry_jobs where verification_id=v)<>1 then raise exception 'Completion trigger failed'; end if;
  update public.insurance_verifications set status=status where id=v;
  if (select count(*) from insurance_internal.plan_entry_jobs where verification_id=v)<>1 then raise exception 'Duplicate queue entry'; end if;
  result:=insurance_internal.claim_plan_entry(v); token:=(result->>'claim_token')::uuid;
  if result->>'status'<>'CLAIMED' or token is null then raise exception 'Initial claim failed'; end if;
  if insurance_internal.claim_plan_entry(v)->>'status'<>'BUSY' then raise exception 'Concurrent claim was not blocked'; end if;
  if insurance_internal.plan_entry_before_save(v,gen_random_uuid()) then raise exception 'Invalid token permitted'; end if;
  if not insurance_internal.plan_entry_before_save(v,token) then raise exception 'Valid source blocked'; end if;
  begin
    perform insurance_internal.finish_plan_entry(v,token,'SUCCESS','1','2','{}');
  exception when others then rejected:=true;
  end;
  if not rejected then raise exception 'Success without readback allowed'; end if;
  rejected:=false;
  begin
    perform insurance_internal.finish_plan_entry(v,token,'SUCCESS','1','2',
      '{"patient":true,"office":true,"carrier":true,"payer":true,"group":true,"subscriber":true,"relationship":true,"order":true,"effective_date":true,"benefits":false,"reopened":true}');
  exception when others then rejected:=true;
  end;
  if not rejected then raise exception 'Partially mapped benefits were reported fully synced'; end if;
  update insurance_internal.plan_entry_jobs set lease_until=now()-interval '1 minute' where verification_id=v;
  result:=insurance_internal.claim_plan_entry(v); token:=(result->>'claim_token')::uuid;
  if result->>'status'<>'RECONCILE_ONLY' then raise exception 'Interrupted save was retried'; end if;
  if insurance_internal.plan_entry_before_save(v,token) then raise exception 'Reconcile attempt allowed a write'; end if;
  if not insurance_internal.finish_plan_entry(v,token,'NEEDS_HUMAN_REVIEW','1',null,'{}',array['READBACK_REQUIRED']) then raise exception 'Review result missing'; end if;
  if insurance_internal.claim_plan_entry(v)->>'status'<>'needs_review' then raise exception 'Review job replayed'; end if;
  update insurance_internal.plan_entry_jobs set state='pending',source_hash='changed',lease_until=null where verification_id=v;
  if insurance_internal.claim_plan_entry(v)->>'status'<>'NEEDS_HUMAN_REVIEW' then raise exception 'Source change ignored'; end if;
  if other_jobs is distinct from (select coalesce(jsonb_agg(to_jsonb(j) order by j.verification_id),'[]'::jsonb) from insurance_internal.plan_entry_jobs j where j.verification_id<>v) then raise exception 'Processing one job changed another job'; end if;
  if has_table_privilege('anon','insurance_internal.plan_entry_jobs','select') or has_table_privilege('authenticated','insurance_internal.plan_entry_jobs','select') then raise exception 'Queue exposed'; end if;
  if has_function_privilege('anon','insurance_internal.claim_plan_entry(uuid)','execute') or has_function_privilege('authenticated','insurance_internal.finish_plan_entry(uuid,uuid,text,text,text,jsonb,text[])','execute') then raise exception 'Worker function exposed'; end if;
end;
$$;
rollback;
select 'PASS: completion queue, deduplication, exclusive claim, stale token, mandatory readback, partial-benefit rejection, interrupted save reconciliation, per-record review isolation, source change, restricted access; test writes rolled back' as result;
