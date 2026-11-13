create schema if not exists private;
create table private.staff_scorecard_assignments (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  primary key (user_id,office_id)
);
revoke all on private.staff_scorecard_assignments from public,anon,authenticated;
alter table private.staff_scorecard_assignments enable row level security;
insert into private.staff_scorecard_assignments(user_id,office_id)
select proposed.user_id,o.id from (values
('b6e77501-3357-4a25-8655-66746b2eb53d'::uuid,'Barnegat'),
('b6e77501-3357-4a25-8655-66746b2eb53d'::uuid,'Brick'),
('b6e77501-3357-4a25-8655-66746b2eb53d'::uuid,'Eatontown'),
('b6e77501-3357-4a25-8655-66746b2eb53d'::uuid,'Staten Island'),
('2954e9e7-9b8a-4ed3-a624-71f91c36d2c3'::uuid,'Barnegat'),
('2954e9e7-9b8a-4ed3-a624-71f91c36d2c3'::uuid,'Brick'),
('2954e9e7-9b8a-4ed3-a624-71f91c36d2c3'::uuid,'Eatontown'),
('2954e9e7-9b8a-4ed3-a624-71f91c36d2c3'::uuid,'Staten Island'),
('e86cd3c5-22bc-4a04-ba30-ef173479a49b'::uuid,'Barnegat'),
('e86cd3c5-22bc-4a04-ba30-ef173479a49b'::uuid,'Brick'),
('e86cd3c5-22bc-4a04-ba30-ef173479a49b'::uuid,'Eatontown'),
('e86cd3c5-22bc-4a04-ba30-ef173479a49b'::uuid,'Staten Island'),
('5c29c9cc-6db1-4368-9bc6-ff058f32dc20'::uuid,'Barnegat'),
('5c29c9cc-6db1-4368-9bc6-ff058f32dc20'::uuid,'Brick'),
('5c29c9cc-6db1-4368-9bc6-ff058f32dc20'::uuid,'Eatontown'),
('5c29c9cc-6db1-4368-9bc6-ff058f32dc20'::uuid,'Staten Island'),
('300385cb-de78-4bb5-9670-d8245f87aecf'::uuid,'Barnegat'),
('300385cb-de78-4bb5-9670-d8245f87aecf'::uuid,'Brick'),
('300385cb-de78-4bb5-9670-d8245f87aecf'::uuid,'Eatontown'),
('300385cb-de78-4bb5-9670-d8245f87aecf'::uuid,'Staten Island'),
('64a5a13c-72cb-4f4e-92d0-179bf63ac14b'::uuid,'Eatontown'),
('7ca3fc28-5911-4396-ab22-f20344f93279'::uuid,'Barnegat'),
('4c18ab06-3459-4ad2-b1a7-97fa4ffd0c49'::uuid,'Barnegat'),
('4df66747-609f-45ae-b025-7ab20ebb4199'::uuid,'Brick'),
('959da81d-3763-4d35-8f4a-cccbc264daea'::uuid,'Eatontown'),
('8c3cb391-51e6-4a7b-9e22-aff625f93e50'::uuid,'Staten Island'),
('1030c739-bde3-46a8-aa3a-5cd37a493989'::uuid,'Barnegat'),
('222e21c8-4cce-4233-83f6-f2c13f09e548'::uuid,'Barnegat'),
('222e21c8-4cce-4233-83f6-f2c13f09e548'::uuid,'Eatontown'),
('1c5eb01d-e073-4cb7-a244-0082311d1616'::uuid,'Barnegat'),
('1c5eb01d-e073-4cb7-a244-0082311d1616'::uuid,'Eatontown'),
('125562eb-bdec-427b-980a-5387cf462fee'::uuid,'Brick'),
('cb0141d4-e9aa-4f25-a136-56c6f3c18333'::uuid,'Brick'),
('7b60543e-d505-4207-bf07-86ea4d11775f'::uuid,'Brick'),
('16d35105-da57-41ce-93cb-0eec21479ca6'::uuid,'Eatontown'),
('ffacceb7-0157-4668-9fd0-64abfbfa0443'::uuid,'Barnegat'),
('5da2238c-f48d-4f4b-9df9-b19c2afecfb7'::uuid,'Brick'),
('cd9d9eba-3e6b-44c9-8bf3-2c32f55454f0'::uuid,'Eatontown'),
('cd179c35-f555-406c-8c8d-63ac2898a4e0'::uuid,'Staten Island'),
('85dc4f92-f5d7-4311-bfd9-2fb13397c8ba'::uuid,'Barnegat'),
('31a08981-2ace-4f98-b039-e32c2fc28943'::uuid,'Barnegat'),
('ff8373d8-06ad-42f3-99c5-fcb330178135'::uuid,'Barnegat'),
('228797d9-ed4a-4dc4-a686-6d98fc3cde48'::uuid,'Eatontown')
) proposed(user_id,name) join public.offices o on o.name=proposed.name and o.is_active;
create function private.staff_scorecard_office_allowed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from private.staff_scorecard_assignments s
    join public.user_profiles p on p.id=s.user_id
    join public.offices o on o.id=s.office_id and o.is_active
    where s.office_id=target and p.id=(select auth.uid())
      and p.is_active and p.is_approved and p.status='Active'
      and (p.office_id=s.office_id or exists (select 1 from public.user_office_assignments a
        where a.user_id=p.id and (a.all_offices or a.office_id=s.office_id)))
  );
$$;
revoke all on function private.staff_scorecard_office_allowed(uuid) from public,anon;
grant execute on function private.staff_scorecard_office_allowed(uuid) to authenticated;
create table public.staff_office_scorecards (
  office_id uuid primary key references public.offices(id),
  office_name text not null,
  through_date date not null, previous_through_date date not null,
  current_metrics jsonb not null, previous_metrics jsonb not null,
  refreshed_at timestamptz not null default now()
);
alter table public.staff_office_scorecards enable row level security;
revoke all on public.staff_office_scorecards from public,anon,authenticated;
grant select on public.staff_office_scorecards to authenticated;
grant select,insert,update on public.staff_office_scorecards to service_role;
create policy "Named staff read assigned office aggregates" on public.staff_office_scorecards for select to authenticated
using ((select private.staff_scorecard_office_allowed(office_id)));
notify pgrst,'reload schema';
