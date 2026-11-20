create function insurance_internal.plan_review_alert() returns trigger
language plpgsql security definer set search_path='' as $$
declare office uuid; label text;
begin
  select r.office_id,o.name into office,label from public.insurance_verification_requests r
    join public.offices o on o.id=r.office_id where r.id=new.request_id;
  if new.state='needs_review' then
    insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
      select r.user_id,office,'insurance_needs_review','Insurance plan entry needs review',
        label || ': The insurance plan could not be safely entered in Ascend. Open the completed breakdown and confirm the patient, subscriber and exact group plan with Patricia. The PDF filing status is separate.',
        jsonb_build_object('request_id',new.request_id,'plan_entry_verification_id',new.verification_id,'reason_codes',new.reason_codes,'priority','high')
      from insurance_internal.review_recipients(office) r
      where not exists(select 1 from public.notifications n where n.user_id=r.user_id
        and n.metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(n.is_archived,false));
  else
    update public.notifications set is_archived=true,metadata=metadata||jsonb_build_object('resolved',true)
      where metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(is_archived,false);
  end if;
  return null;
end;
$$;
revoke all on function insurance_internal.plan_review_alert() from public,anon,authenticated;
create trigger insurance_plan_review_alert after insert or update of state on insurance_internal.plan_entry_jobs
for each row execute function insurance_internal.plan_review_alert();
-- Surface an already recorded review if this migration follows its live pilot.
update insurance_internal.plan_entry_jobs set state=state where state='needs_review';
