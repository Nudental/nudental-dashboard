create or replace function insurance_internal.plan_review_alert() returns trigger
language plpgsql security definer set search_path='' as $$
declare office uuid; label text; attached boolean; alert_title text; alert_message text;
begin
  select r.office_id,o.name into office,label from public.insurance_verification_requests r
    join public.offices o on o.id=r.office_id where r.id=new.request_id;
  if new.state='needs_review' then
    attached := new.patient_id is not null and new.plan_id is not null
      and new.receipt @> '{"patient":true,"office":true,"carrier":true,"payer":true,"group":true,"subscriber":true,"relationship":true,"order":true,"effective_date":true,"reopened":true}'::jsonb;
    alert_title := case when attached then 'Insurance plan attached — benefit review needed' else 'Insurance plan entry needs review' end;
    alert_message := label || case when attached
      then ': The native insurance plan is already attached. Review the remaining benefits and restrictions with Patricia and the office manager in the request discrepancy log. Do not attach a duplicate policy. PDF filing is separate.'
      else ': The insurance plan could not be safely entered in Ascend. Open the completed breakdown and confirm the patient, subscriber and exact group plan with Patricia. PDF filing is separate.' end;
    update public.notifications set title=alert_title,message=alert_message,
      metadata=metadata||jsonb_build_object('reason_codes',new.reason_codes,'plan_attached_verified',attached)
      where metadata->>'plan_entry_verification_id'=new.verification_id::text and not coalesce(is_archived,false);
    insert into public.notifications(user_id,office_id,notification_type,title,message,metadata)
      select r.user_id,office,'insurance_needs_review',alert_title,alert_message,
        jsonb_build_object('request_id',new.request_id,'plan_entry_verification_id',new.verification_id,'reason_codes',new.reason_codes,'plan_attached_verified',attached,'priority','high')
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
