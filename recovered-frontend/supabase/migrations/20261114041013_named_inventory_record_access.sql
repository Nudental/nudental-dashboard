-- Individual grants keep stock maintenance independent of order placement.
alter table public.staff_workflow_grants drop constraint staff_workflow_grants_permission_check;
alter table public.staff_workflow_grants add constraint staff_workflow_grants_permission_check check (
  permission in ('workflow.huddle.view','huddle:view','huddle:edit','workflow.eod.view','workflow.tasks.view',
    'workflow.insurance.view','workflow.insurance.submit','inventory:view','inventory:edit','resources.inventory.view',
    'resources.inventory.overview.view','resources.inventory.front_desk.view','resources.inventory.monthly_supply.view',
    'resources.inventory.bone_tissue.view','resources.inventory.implant.view','resources.inventory.reports.view')
);
do $$
declare who uuid;
begin
 select p.id into strict who from public.user_profiles p join public.purchasing_record_admins a on a.user_id=p.id
 where p.username='caitlin' and lower(p.email)='invoice@thenudental.com' and p.is_active and p.role='staff';
 insert into public.staff_workflow_grants(user_id,permission)
 select who,unnest(array['inventory:view','inventory:edit','resources.inventory.view','resources.inventory.overview.view',
   'resources.inventory.front_desk.view','resources.inventory.monthly_supply.view','resources.inventory.bone_tissue.view',
   'resources.inventory.implant.view','resources.inventory.reports.view'])
 on conflict do nothing;
end;
$$;
create policy inventory_admin_read_own_grants on public.staff_workflow_grants for select to authenticated
using (user_id=(select auth.uid()) and public.dashboard_has_active_profile() and
  (permission like 'inventory:%' or permission like 'resources.inventory.%'));
