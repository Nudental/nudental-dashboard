-- ─────────────────────────────────────────────────────────────────────────────
-- Gusto Time & Attendance Tables (Source B only — isolated from Dentrix/Source A)
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Time entries (clock-in / clock-out per employee per shift)
create table if not exists gusto_time_entries (
  id                      text primary key,
  employee_id             text not null,
  employee_uuid           text,
  employee_name           text,
  company_id              text not null,
  clockin_time            timestamptz,
  clockout_time           timestamptz,
  hours_worked            numeric(6,2),
  break_minutes           integer default 0,
  job_code                text,
  location_id             text,
  office_name             text,
  status                  text,  -- 'approved' | 'pending' | 'rejected'
  note                    text,
  pay_period_start        date,
  pay_period_end          date,
  created_at              timestamptz,
  updated_at              timestamptz,
  imported_at             timestamptz default now()
);

-- B. Time off requests (vacation, sick, PTO, etc.)
create table if not exists gusto_time_off_requests (
  id                      text primary key,
  employee_id             text not null,
  employee_uuid           text,
  employee_name           text,
  company_id              text not null,
  time_off_type           text,   -- 'Vacation' | 'Sick' | 'PTO' | 'Unpaid' | 'Holiday' | etc.
  status                  text,   -- 'pending' | 'approved' | 'denied' | 'cancelled'
  request_date            date,
  start_date              date,
  end_date                date,
  days_requested          numeric(5,2),
  hours_requested         numeric(6,2),
  reason                  text,
  approver_name           text,
  approved_at             timestamptz,
  denied_at               timestamptz,
  created_at              timestamptz,
  updated_at              timestamptz,
  imported_at             timestamptz default now()
);

-- C. Time off policies (vacation cap, sick cap, etc. per company)
create table if not exists gusto_time_off_policies (
  id                      text primary key,
  company_id              text not null,
  policy_name             text,
  time_off_type           text,   -- 'Vacation' | 'Sick' | 'PTO' etc.
  accrual_method          text,   -- 'unlimited' | 'accrued' | 'manual'
  accrual_rate            numeric(6,4),   -- hours per pay period
  accrual_unit            text,           -- 'hours' | 'days'
  max_accrual_hours       numeric(8,2),
  max_carry_over_hours    numeric(8,2),
  waiting_period_days     integer,
  is_active               boolean default true,
  created_at              timestamptz,
  updated_at              timestamptz,
  imported_at             timestamptz default now()
);

-- D. Time off balances per employee per policy (current snapshot)
create table if not exists gusto_time_off_balances (
  id                      text primary key,
  employee_id             text not null,
  employee_uuid           text,
  employee_name           text,
  company_id              text not null,
  time_off_type           text,       -- 'Vacation' | 'Sick' | 'PTO' etc.
  policy_id               text,
  balance_hours           numeric(8,2),
  balance_days            numeric(6,2),
  used_ytd_hours          numeric(8,2),
  used_ytd_days           numeric(6,2),
  accrued_ytd_hours       numeric(8,2),
  pending_hours           numeric(8,2),   -- approved requests not yet taken
  snapshot_date           date,
  imported_at             timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (employee_id, time_off_type, snapshot_date)
);

-- E. YTD hours summary per employee per year (aggregated from time entries + payroll)
create table if not exists gusto_hours_summary (
  id                      text primary key default gen_random_uuid()::text,
  employee_id             text not null,
  employee_uuid           text,
  employee_name           text,
  company_id              text not null,
  year                    integer not null,
  regular_hours           numeric(8,2) default 0,
  overtime_hours          numeric(8,2) default 0,
  pto_hours_used          numeric(8,2) default 0,
  sick_hours_used         numeric(8,2) default 0,
  vacation_hours_used     numeric(8,2) default 0,
  holiday_hours           numeric(8,2) default 0,
  total_hours_worked      numeric(8,2) default 0,
  pay_periods_count       integer default 0,
  imported_at             timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (employee_id, year)
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

alter table gusto_time_entries enable row level security;
alter table gusto_time_off_requests enable row level security;
alter table gusto_time_off_policies enable row level security;
alter table gusto_time_off_balances enable row level security;
alter table gusto_hours_summary enable row level security;

-- gusto_time_entries
create policy "super_admin_all_time_entries" on gusto_time_entries
  for all using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'super_admin'
    )
  );

create policy "admin_read_time_entries" on gusto_time_entries
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );

-- gusto_time_off_requests
create policy "super_admin_all_time_off_requests" on gusto_time_off_requests
  for all using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'super_admin'
    )
  );

create policy "admin_read_time_off_requests" on gusto_time_off_requests
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );

-- gusto_time_off_policies
create policy "super_admin_all_time_off_policies" on gusto_time_off_policies
  for all using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'super_admin'
    )
  );

create policy "admin_read_time_off_policies" on gusto_time_off_policies
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );

-- gusto_time_off_balances
create policy "super_admin_all_time_off_balances" on gusto_time_off_balances
  for all using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'super_admin'
    )
  );

create policy "admin_read_time_off_balances" on gusto_time_off_balances
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );

-- gusto_hours_summary
create policy "super_admin_all_hours_summary" on gusto_hours_summary
  for all using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'super_admin'
    )
  );

create policy "admin_read_hours_summary" on gusto_hours_summary
  for select using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );
