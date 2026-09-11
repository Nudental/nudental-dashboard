-- ============================================================
-- Phase 4A Seed: Add four new staff cards to staff_directory
-- Idempotent: uses ON CONFLICT (full_name, office_location_normalized)
-- to upsert — no duplicates will be created.
-- Does NOT modify providers, provider_master, user_profiles,
-- payroll tables, Gusto tables, or offices.
-- Expected total after insert: 34 (if none of these four exist yet)
-- ============================================================

INSERT INTO public.staff_directory (
  full_name,
  directory_display_name,
  office_location_normalized,
  job_title,
  role_category,
  worker_type,
  preferred_email,
  work_email,
  personal_email,
  phone,
  date_of_birth,
  notes,
  is_active,
  imported_from
)
VALUES
  -- A. Kathy Corbin
  (
    'Kathy Corbin',
    'Kathy Corbin',
    'Management',
    'CHRO',
    'Management/Admin',
    'Employee',
    'kathy@thenudental.com',
    'kathy@thenudental.com',
    NULL,
    '+17324405699',
    '1964-07-11',
    '178 State Route 35 S suite 6, Eatontown, NJ 07724. Tel: (732) 440-5699.',
    true,
    'manual'
  ),
  -- B. Caitlin Wedgwood
  (
    'Caitlin Wedgwood',
    'Caitlin Wedgwood',
    'Management',
    'Accounting and Bookkeeping',
    'Management/Admin',
    'Employee',
    'invoice@thenudental.com',
    'invoice@thenudental.com',
    NULL,
    NULL,
    '1994-08-10',
    '178 State Route 35 S suite 6, Eatontown, NJ 07724.',
    true,
    'manual'
  ),
  -- C. William Goodman
  (
    'William Goodman',
    'William Goodman',
    'Management',
    'Accountant — Nu Holding LLC',
    'Management/Admin',
    'Employee',
    'accounting@thenudental.com',
    'accounting@thenudental.com',
    NULL,
    NULL,
    '1972-03-28',
    'Accountant, Nu Holding LLC.',
    true,
    'manual'
  ),
  -- D. Crystal Sullivan
  (
    'Crystal Sullivan',
    'Crystal Sullivan',
    'Eatontown',
    'RDH',
    'Hygienist',
    'Employee',
    'leighsunny@aol.com',
    NULL,
    'leighsunny@aol.com',
    '+17324031486',
    '1964-07-05',
    'Added by Dr. G as active RDH.',
    true,
    'manual'
  )
ON CONFLICT (full_name, office_location_normalized)
DO UPDATE SET
  directory_display_name     = EXCLUDED.directory_display_name,
  job_title                  = EXCLUDED.job_title,
  role_category              = EXCLUDED.role_category,
  worker_type                = EXCLUDED.worker_type,
  preferred_email            = EXCLUDED.preferred_email,
  work_email                 = EXCLUDED.work_email,
  personal_email             = EXCLUDED.personal_email,
  phone                      = EXCLUDED.phone,
  date_of_birth              = EXCLUDED.date_of_birth,
  notes                      = EXCLUDED.notes,
  is_active                  = EXCLUDED.is_active;
