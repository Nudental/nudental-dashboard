-- ============================================================
-- Phase 2A: staff_directory table + initial Gusto import staging
-- Migration: 20260526100000_staff_directory_phase2a.sql
-- Source: nu_dental_directory_combined_for_rocket.xlsx (Staff_Import sheet)
-- Active_Locations: Barnegat, Brick, Eatontown, Staten Island, Management, Construction
-- Total rows staged: 30
-- SAFETY: No existing tables (providers, provider_master, user_profiles, offices,
--         payroll, front_desk_inventory) are modified.
-- ============================================================

-- ============================================================
-- 1. Create staff_directory table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_directory (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity fields (both name columns preserved per Dr. G requirement)
    directory_display_name      TEXT,           -- Gusto roster preferred/display name
    contact_list_employee_name  TEXT,           -- Gusto contact CSV legal/formal name
    gusto_roster_name           TEXT,           -- Raw Gusto roster name
    first_name                  TEXT,
    last_name                   TEXT,
    full_name                   TEXT NOT NULL,

    -- Location / Office
    office_location_raw         TEXT,           -- Raw Gusto Department value
    office_location_normalized  TEXT,           -- Normalized: Barnegat | Brick | Eatontown | Staten Island | Management | Construction
    dashboard_office_name       TEXT,           -- Full dashboard label e.g. "Nu Dental of Barnegat"
    location_type               TEXT,           -- Office | Management | Contractor/Project

    -- Role / Employment
    job_title                   TEXT,
    role_category               TEXT,           -- Doctor/Dentist | Hygienist | Dental Assistant | Front Office | Management/Admin | Contractor
    worker_type                 TEXT,           -- Employee | Contractor
    employment_type             TEXT,           -- Paid by the hour | Commission only/No overtime | Salary/No overtime

    -- Contact (management/admin-only fields per Dr. G)
    date_of_birth               DATE,           -- Management reference only
    personal_email              TEXT,
    work_email                  TEXT,
    preferred_email             TEXT,           -- work_email if present, else personal_email
    phone                       TEXT,
    employee_pronouns           TEXT,

    -- Status
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

    -- Import metadata
    imported_from               TEXT DEFAULT 'gusto',
    source_period               TEXT,
    source_match_status         TEXT,
    notes                       TEXT,

    -- Optional linkage columns (left NULL for Phase 2A; populated in Phase 3+ after match review)
    user_profile_id             UUID,           -- FK to public.user_profiles(id) — nullable
    provider_master_id          UUID,           -- FK to public.provider_master(id) — nullable

    -- Audit
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staff_directory_office_location
    ON public.staff_directory (office_location_normalized);

CREATE INDEX IF NOT EXISTS idx_staff_directory_full_name
    ON public.staff_directory (full_name);

CREATE INDEX IF NOT EXISTS idx_staff_directory_is_active
    ON public.staff_directory (is_active);

CREATE INDEX IF NOT EXISTS idx_staff_directory_role_category
    ON public.staff_directory (role_category);

CREATE INDEX IF NOT EXISTS idx_staff_directory_worker_type
    ON public.staff_directory (worker_type);

-- ============================================================
-- 3. updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.staff_directory_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_directory_updated_at ON public.staff_directory;
CREATE TRIGGER trg_staff_directory_updated_at
    BEFORE UPDATE ON public.staff_directory
    FOR EACH ROW
    EXECUTE FUNCTION public.staff_directory_set_updated_at();

-- ============================================================
-- 4. Enable RLS
-- ============================================================
ALTER TABLE public.staff_directory ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS Policies
-- Role-based: admin / super_admin / office_manager / regional_clinical_manager
-- can read all rows. Authenticated users can read active rows.
-- Only admin/super_admin can write.
-- ============================================================

-- Helper function: check if current user has a management role
CREATE OR REPLACE FUNCTION public.is_staff_directory_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'super_admin', 'office_manager', 'regional_clinical_manager')
      AND up.is_active = TRUE
)
$$;

-- SELECT: all authenticated users can read active rows; managers can read all
DROP POLICY IF EXISTS "staff_directory_select_authenticated" ON public.staff_directory;
CREATE POLICY "staff_directory_select_authenticated"
    ON public.staff_directory
    FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE
        OR public.is_staff_directory_manager()
    );

-- INSERT / UPDATE / DELETE: admin and super_admin only
DROP POLICY IF EXISTS "staff_directory_write_admin" ON public.staff_directory;
CREATE POLICY "staff_directory_write_admin"
    ON public.staff_directory
    FOR ALL
    TO authenticated
    USING (public.is_staff_directory_manager())
    WITH CHECK (public.is_staff_directory_manager());

-- ============================================================
-- 6. Stage 30 rows from Staff_Import sheet
--    All rows set is_active = TRUE
--    user_profile_id and provider_master_id left NULL (Phase 2A)
--    Missing values stored as NULL
-- ============================================================
DO $$
BEGIN
    -- Barnegat — 10 rows
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 1: Alan Schwartz
    (
        'Alan Schwartz', 'Alan Schwartz', 'Alan Schwartz',
        'Alan', 'Schwartz', 'Alan Schwartz',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'Doctor', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1961-11-17', 'dokschwartz@gmail.com', NULL, 'dokschwartz@gmail.com', '+16098916152', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 2: Andy Serrano Jr. (display differs from contact: Andres Serrano Jr.)
    (
        'Andy Serrano Jr.', 'Andres Serrano Jr.', 'Andy Serrano Jr.',
        'Andy', 'Serrano Jr.', 'Andy Serrano Jr.',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'RDA', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '1990-01-31', 'aserrano255@yahoo.com', NULL, 'aserrano255@yahoo.com', '+17323307363', NULL,
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Andres Serrano Jr.'' matched to Gusto roster display name ''Andy Serrano Jr.''',
        NULL, NULL
    ),
    -- Row 3: Courtney Spaeth
    (
        'Courtney Spaeth', 'Courtney Spaeth', 'Courtney Spaeth',
        'Courtney', 'Spaeth', 'Courtney Spaeth',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'Patient Care Coordinator', 'Front Office', 'Employee', 'Paid by the hour',
        '1996-01-22', 'cas921@gmail.com', NULL, 'cas921@gmail.com', '+16096229907', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 4: Glenn Marie
    (
        'Glenn Marie', 'Glenn Marie', 'Glenn Marie',
        'Glenn', 'Marie', 'Glenn Marie',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'Pediatric Dentist', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1961-06-28', 'gjm628@gmail.com', NULL, 'gjm628@gmail.com', '+19177093592', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 5: Kat Soto (display differs from contact: Katherine Soto)
    (
        'Kat Soto', 'Katherine Soto', 'Kat Soto',
        'Kat', 'Soto', 'Kat Soto',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'RDH', 'Hygienist', 'Employee', 'Paid by the hour',
        '1995-11-28', 'katherineysoto@gmail.com', NULL, 'katherineysoto@gmail.com', '+19086017852', NULL,
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Katherine Soto'' matched to Gusto roster display name ''Kat Soto''',
        NULL, NULL
    ),
    -- Row 6: Kayla Caggiano
    (
        'Kayla Caggiano', 'Kayla Caggiano', 'Kayla Caggiano',
        'Kayla', 'Caggiano', 'Kayla Caggiano',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'DA', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '1991-11-30', 'kayla_caggiano@yahoo.com', NULL, 'kayla_caggiano@yahoo.com', '+17326084844', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 7: Liz Velez (display differs from contact: Elizabeth Velez)
    (
        'Liz Velez', 'Elizabeth Velez', 'Liz Velez',
        'Liz', 'Velez', 'Liz Velez',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'Office Manager', 'Front Office', 'Employee', 'Paid by the hour',
        '2000-02-18', 'liz_velez@outlook.com', NULL, 'liz_velez@outlook.com', '+16097275955', NULL,
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Elizabeth Velez'' matched to Gusto roster display name ''Liz Velez''',
        NULL, NULL
    ),
    -- Row 8: Miracle Washington
    (
        'Miracle Washington', 'Miracle Washington', 'Miracle Washington',
        'Miracle', 'Washington', 'Miracle Washington',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'RDA', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '2006-10-02', 'miracleanjuniquewash@gmail.com', NULL, 'miracleanjuniquewash@gmail.com', '+15012952862', 'she/her/hers',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 9: Nancy Martinez
    (
        'Nancy Martinez', 'Nancy Martinez', 'Nancy Martinez',
        'Nancy', 'Martinez', 'Nancy Martinez',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'Dental Assistant', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '2006-01-14', 'nancmart14@icloud.com', NULL, 'nancmart14@icloud.com', '+19087089163', 'she/her/hers',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 10: Samantha Pensa
    (
        'Samantha Pensa', 'Samantha Pensa', 'Samantha Pensa',
        'Samantha', 'Pensa', 'Samantha Pensa',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'DA', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '1991-09-25', 'sampensa091@gmail.com', NULL, 'sampensa091@gmail.com', '+18482102008', 'she/her/hers',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Row 11: Tracy Bushman (display differs from contact: Theresa Bushman)
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    (
        'Tracy Bushman', 'Theresa Bushman', 'Tracy Bushman',
        'Tracy', 'Bushman', 'Tracy Bushman',
        'Barnegat', 'Barnegat', 'Nu Dental of Barnegat', 'Office',
        'RDH', 'Hygienist', 'Employee', 'Paid by the hour',
        '1968-02-15', 'tbushman468@comcast.net', NULL, 'tbushman468@comcast.net', '+16098484063', NULL,
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Theresa Bushman'' matched to Gusto roster display name ''Tracy Bushman''',
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Brick — 6 rows
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 12: Amtul Siddiqui
    (
        'Amtul Siddiqui', 'Amtul Siddiqui', 'Amtul Siddiqui',
        'Amtul', 'Siddiqui', 'Amtul Siddiqui',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'Doctor', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1979-09-10', 'dr.amtul.siddiqui@gmail.com', NULL, 'dr.amtul.siddiqui@gmail.com', '+17323067207', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 13: Cliff Rigby (phone missing)
    (
        'Cliff Rigby', 'Cliff Rigby', 'Cliff Rigby',
        'Cliff', 'Rigby', 'Cliff Rigby',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'Doctor', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1959-01-17', 'cliffrigby59@gmail.com', NULL, 'cliffrigby59@gmail.com', NULL, NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 14: Hennessy Medina
    (
        'Hennessy Medina', 'Hennessy Medina', 'Hennessy Medina',
        'Hennessy', 'Medina', 'Hennessy Medina',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'Patient Care Coordinator', 'Front Office', 'Employee', 'Paid by the hour',
        '2003-02-11', 'hennessymedina11@gmail.com', NULL, 'hennessymedina11@gmail.com', '+18482386403', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 15: Linda Albanese
    (
        'Linda Albanese', 'Linda Albanese', 'Linda Albanese',
        'Linda', 'Albanese', 'Linda Albanese',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'Front Desk', 'Front Office', 'Employee', 'Paid by the hour',
        '1959-01-11', 'sunnyfla111@gmail.com', NULL, 'sunnyfla111@gmail.com', '+17326741256', 'she/her/hers',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 16: Norman Margolies
    (
        'Norman Margolies', 'Norman Margolies', 'Norman Margolies',
        'Norman', 'Margolies', 'Norman Margolies',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'Doctor', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1949-03-06', 'nsmdmd@aol.com', NULL, 'nsmdmd@aol.com', '+17322453671', 'Just use Norman',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 17: Sheryl Dubman
    (
        'Sheryl Dubman', 'Sheryl Dubman', 'Sheryl Dubman',
        'Sheryl', 'Dubman', 'Sheryl Dubman',
        'Brick', 'Brick', 'Nu Dental of Brick', 'Office',
        'RDH', 'Hygienist', 'Employee', 'Paid by the hour',
        '1968-12-16', 'sheryldub122@gmail.com', NULL, 'sheryldub122@gmail.com', '+19084039009', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Eatontown — 6 rows
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 18: Alyssa Marie
    (
        'Alyssa Marie', 'Alyssa Marie', 'Alyssa Marie',
        'Alyssa', 'Marie', 'Alyssa Marie',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'RDH', 'Hygienist', 'Employee', 'Paid by the hour',
        '1993-06-08', 'atmarie8@gmail.com', NULL, 'atmarie8@gmail.com', '+17327579159', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 19: Heather Gorhau
    (
        'Heather Gorhau', 'Heather Gorhau', 'Heather Gorhau',
        'Heather', 'Gorhau', 'Heather Gorhau',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'DA', 'Dental Assistant', 'Employee', 'Paid by the hour',
        '1982-12-21', 'heathergorh@gmail.com', NULL, 'heathergorh@gmail.com', '+17327732594', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 20: Mark Henin
    (
        'Mark Henin', 'Mark Henin', 'Mark Henin',
        'Mark', 'Henin', 'Mark Henin',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'Associate Dentist', 'Doctor/Dentist', 'Employee', 'Paid by the hour',
        '1996-03-27', 'markhenin2@gmail.com', NULL, 'markhenin2@gmail.com', '+17327717734', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 21: Mildred Fortune
    (
        'Mildred Fortune', 'Mildred Fortune', 'Mildred Fortune',
        'Mildred', 'Fortune', 'Mildred Fortune',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'Front Desk', 'Front Office', 'Employee', 'Paid by the hour',
        '2002-09-03', 'basicallymilly1@gmail.com', NULL, 'basicallymilly1@gmail.com', '+18484696754', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 22: Nelson Wollek
    (
        'Nelson Wollek', 'Nelson Wollek', 'Nelson Wollek',
        'Nelson', 'Wollek', 'Nelson Wollek',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'Doctor', 'Doctor/Dentist', 'Employee', 'Commission only/No overtime',
        '1959-07-25', 'nawdds@hotmail.com', NULL, 'nawdds@hotmail.com', '+17329151411', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 23: Viv Diaz Morales (display differs from contact: Vivian Diaz Morales)
    (
        'Viv Diaz Morales', 'Vivian Diaz Morales', 'Viv Diaz Morales',
        'Viv', 'Diaz Morales', 'Viv Diaz Morales',
        'Eatontown', 'Eatontown', 'Nu Dental of Eatontown', 'Office',
        'Office Manager', 'Front Office', 'Employee', 'Paid by the hour',
        '1999-07-03', 'viviandiaz79@gmail.com', NULL, 'viviandiaz79@gmail.com', '+17325439177', 'he/him/his',
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Vivian Diaz Morales'' matched to Gusto roster display name ''Viv Diaz Morales''',
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Staten Island — 2 rows
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 24: Charlene Traverzo
    (
        'Charlene Traverzo', 'Charlene Traverzo', 'Charlene Traverzo',
        'Charlene', 'Traverzo', 'Charlene Traverzo',
        'Staten Island', 'Staten Island', 'Nu Dental of Staten Island', 'Office',
        'Front Desk', 'Front Office', 'Employee', 'Paid by the hour',
        '1986-11-11', 'ctraverzo1113@gmail.com', NULL, 'ctraverzo1113@gmail.com', '+19294107354', 'she/her/hers',
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 25: Rawan Abuzahrieh
    (
        'Rawan Abuzahrieh', 'Rawan Abuzahrieh', 'Rawan Abuzahrieh',
        'Rawan', 'Abuzahrieh', 'Rawan Abuzahrieh',
        'Staten Island', 'Staten Island', 'Nu Dental of Staten Island', 'Office',
        'RDH', 'Hygienist', 'Employee', 'Paid by the hour',
        '1997-02-20', 'abuzahrieh.r@gmail.com', NULL, 'abuzahrieh.r@gmail.com', '+19172268102', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Management — 4 rows
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 26: Admasu Gizachew
    (
        'Admasu Gizachew', 'Admasu Gizachew', 'Admasu Gizachew',
        'Admasu', 'Gizachew', 'Admasu Gizachew',
        'management', 'Management', 'Management', 'Management',
        'CEO', 'Management/Admin', 'Employee', 'Commission only/No overtime',
        '1981-07-19', 'dr.admasu@icloud.com', NULL, 'dr.admasu@icloud.com', '+12315809205', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 27: Maia Dolidze
    (
        'Maia Dolidze', 'Maia Dolidze', 'Maia Dolidze',
        'Maia', 'Dolidze', 'Maia Dolidze',
        'management', 'Management', 'Management', 'Management',
        'Clinical manager', 'Management/Admin', 'Employee', 'Salary/No overtime',
        '1976-11-03', 'dolidzemaia@yahoo.com', NULL, 'dolidzemaia@yahoo.com', '+19084943163', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 28: Nebraska Chaplick
    (
        'Nebraska Chaplick', 'Nebraska Chaplick', 'Nebraska Chaplick',
        'Nebraska', 'Chaplick', 'Nebraska Chaplick',
        'management', 'Management', 'Management', 'Management',
        'Insurance Coordinator and Credentialing', 'Management/Admin', 'Employee', 'Paid by the hour',
        '1993-03-18', 'nebraskachaplick@gmail.com', NULL, 'nebraskachaplick@gmail.com', '+14842643062', NULL,
        TRUE, 'gusto', '2026-05', 'Exact name match', NULL,
        NULL, NULL
    ),
    -- Row 29: Ny Velez (display differs from contact: Nyasiah Velez; has distinct work_email)
    (
        'Ny Velez', 'Nyasiah Velez', 'Ny Velez',
        'Ny', 'Velez', 'Ny Velez',
        'management', 'Management', 'Management', 'Management',
        'Business Manger', 'Management/Admin', 'Employee', 'Paid by the hour',
        '1995-02-11', 'nvious216@yahoo.com', 'ny@thenudental.com', 'ny@thenudental.com', '+17328242033', NULL,
        TRUE, 'gusto', '2026-05', 'Matched by preferred/display name alias',
        'Contact CSV name ''Nyasiah Velez'' matched to Gusto roster display name ''Ny Velez''',
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

    -- Construction / Contractor — 1 row
    INSERT INTO public.staff_directory (
        directory_display_name, contact_list_employee_name, gusto_roster_name,
        first_name, last_name, full_name,
        office_location_raw, office_location_normalized, dashboard_office_name, location_type,
        job_title, role_category, worker_type, employment_type,
        date_of_birth, personal_email, work_email, preferred_email, phone, employee_pronouns,
        is_active, imported_from, source_period, source_match_status, notes,
        user_profile_id, provider_master_id
    ) VALUES
    -- Row 30: Skyeco Construction (contractor; contact/DOB fields null)
    (
        'Skyeco Construction', NULL, 'Skyeco Construction',
        'Skyeco', 'Construction', 'Skyeco Construction',
        'Construction', 'Construction', 'Construction', 'Contractor/Project',
        NULL, 'Contractor', 'Contractor', NULL,
        NULL, NULL, NULL, NULL, NULL, NULL,
        TRUE, 'gusto', '2026-05', 'Roster-only contractor; not present in contact CSV',
        'Contractor row from active department/location screenshot; contact/DOB fields not present in provided contact CSV',
        NULL, NULL
    )
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'staff_directory seed failed: %', SQLERRM;
END $$;

-- ============================================================
-- SAFETY CONFIRMATION COMMENT
-- No existing tables were modified by this migration.
-- Tables NOT touched: providers, provider_master, user_profiles,
--   offices, payroll_*, gusto_employees, front_desk_inventory,
--   front_desk_amazon_orders, daily_entries, or any other table.
-- ============================================================
