-- Named insurance coordinator access. Existing global role grants and business records stay unchanged.
alter table public.staff_workflow_grants drop constraint staff_workflow_grants_permission_check;
alter table public.staff_workflow_grants add constraint staff_workflow_grants_permission_check
  check (permission in ('workflow.huddle.view',
    'huddle:view',
    'huddle:edit',
    'workflow.eod.view',
    'workflow.tasks.view',
    'workflow.insurance.view',
    'workflow.insurance.submit',
    'inventory:view',
    'inventory:edit',
    'resources.inventory.view',
    'resources.inventory.overview.view',
    'resources.inventory.front_desk.view',
    'resources.inventory.monthly_supply.view',
    'resources.inventory.bone_tissue.view',
    'resources.inventory.implant.view',
    'resources.inventory.reports.view',
    'workflow.patient_followup.view',
    'workflow.office_calls.view',
    'workflow.insurance.assign',
    'workflow.insurance.complete',
    'workflow.insurance.cancel',
    'workflow.insurance.email_office',
    'workflow.insurance.mark_uploaded',
    'workflow.insurance.upload_to_dentrix',
    'resources.directory.view',
    'finance.rcm.view',
    'finance.rcm.claims.view',
    'finance.rcm.payment.view',
    'finance.rcm.adjustment.view',
    'finance.rcm.dashboard.view',
    'finance.rcm.ar_aging.view',
    'finance.rcm.daily_comparison.view',
    'finance.rcm.eassist_daily.view'));

-- Resolve the existing account; never create a second profile.
do $$ declare coordinator uuid; begin
 select id into strict coordinator from public.user_profiles
 where username='nebraska' and lower(email)='nebraskachaplick@gmail.com'
   and full_name='Nebraska Chaplick' and role='staff' and is_active and is_approved and status='Active';
 if not exists(select 1 from public.user_office_assignments where user_id=coordinator and all_offices) then
   raise exception 'Expected existing all-office coordinator assignment';
 end if;
 insert into public.staff_workflow_grants(user_id,permission)
 select coordinator, unnest(array['workflow.patient_followup.view',
    'workflow.office_calls.view',
    'workflow.huddle.view',
    'huddle:view',
    'huddle:edit',
    'workflow.eod.view',
    'workflow.tasks.view',
    'workflow.insurance.view',
    'workflow.insurance.submit',
    'workflow.insurance.assign',
    'workflow.insurance.complete',
    'workflow.insurance.cancel',
    'workflow.insurance.email_office',
    'workflow.insurance.mark_uploaded',
    'workflow.insurance.upload_to_dentrix',
    'resources.directory.view',
    'finance.rcm.view',
    'finance.rcm.claims.view',
    'finance.rcm.payment.view',
    'finance.rcm.adjustment.view',
    'finance.rcm.dashboard.view',
    'finance.rcm.ar_aging.view',
    'finance.rcm.daily_comparison.view',
    'finance.rcm.eassist_daily.view']) on conflict do nothing;
 insert into public.insurance_daily_reviewers(user_id) values(coordinator) on conflict do nothing;
 update public.user_profiles set work_email='insurance@thenudental.com',updated_at=now()
 where id=coordinator and coalesce(work_email,'') in ('','insurance@thenudental.com');
end $$;
notify pgrst,'reload schema';

