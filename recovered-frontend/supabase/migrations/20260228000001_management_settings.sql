-- NU Dental Management & Settings Module Migration
-- Tables: user_profiles, offices, providers, cost_drivers, back_staff_orders, audit_logs

-- 1. TYPES
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('staff', 'admin', 'super_admin');

DROP TYPE IF EXISTS public.provider_type CASCADE;
CREATE TYPE public.provider_type AS ENUM ('doctor', 'hygienist');

-- 2. CORE TABLES

-- User Profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    role public.user_role DEFAULT 'staff'::public.user_role,
    office_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Offices
CREATE TABLE IF NOT EXISTS public.offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    contact_info TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add FK from user_profiles to offices after offices table exists
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL;

-- Providers (Doctors & Hygienists)
CREATE TABLE IF NOT EXISTS public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider_type public.provider_type NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Cost Drivers (Payroll & Payment Categories)
CREATE TABLE IF NOT EXISTS public.cost_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Back Staff Orders (Vendor & Expense Categories)
CREATE TABLE IF NOT EXISTS public.back_staff_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_office_id ON public.user_profiles(office_id);
CREATE INDEX IF NOT EXISTS idx_providers_type ON public.providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_office_id ON public.providers(office_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 4. FUNCTIONS (BEFORE RLS POLICIES)

-- Function to check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'super_admin'::public.user_role
    )
$$;

-- Function to check if current user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
$$;

-- Trigger function to auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.back_staff_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- user_profiles: users manage own profile; super_admin manages all
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "super_admin_manage_all_profiles" ON public.user_profiles;
CREATE POLICY "super_admin_manage_all_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.user_profiles;
CREATE POLICY "authenticated_read_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- offices: all authenticated can read; only super_admin can write
DROP POLICY IF EXISTS "authenticated_read_offices" ON public.offices;
CREATE POLICY "authenticated_read_offices"
ON public.offices
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_offices" ON public.offices;
CREATE POLICY "super_admin_manage_offices"
ON public.offices
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- providers: all authenticated can read; only super_admin can write
DROP POLICY IF EXISTS "authenticated_read_providers" ON public.providers;
CREATE POLICY "authenticated_read_providers"
ON public.providers
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_providers" ON public.providers;
CREATE POLICY "super_admin_manage_providers"
ON public.providers
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- cost_drivers: all authenticated can read; only super_admin can write
DROP POLICY IF EXISTS "authenticated_read_cost_drivers" ON public.cost_drivers;
CREATE POLICY "authenticated_read_cost_drivers"
ON public.cost_drivers
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_cost_drivers" ON public.cost_drivers;
CREATE POLICY "super_admin_manage_cost_drivers"
ON public.cost_drivers
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- back_staff_orders: all authenticated can read; only super_admin can write
DROP POLICY IF EXISTS "authenticated_read_back_staff_orders" ON public.back_staff_orders;
CREATE POLICY "authenticated_read_back_staff_orders"
ON public.back_staff_orders
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_back_staff_orders" ON public.back_staff_orders;
CREATE POLICY "super_admin_manage_back_staff_orders"
ON public.back_staff_orders
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- audit_logs: super_admin can read all; authenticated can insert
DROP POLICY IF EXISTS "super_admin_read_audit_logs" ON public.audit_logs;
CREATE POLICY "super_admin_read_audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin());

DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 7. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_offices_updated_at ON public.offices;
CREATE TRIGGER update_offices_updated_at
    BEFORE UPDATE ON public.offices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_providers_updated_at ON public.providers;
CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON public.providers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cost_drivers_updated_at ON public.cost_drivers;
CREATE TRIGGER update_cost_drivers_updated_at
    BEFORE UPDATE ON public.cost_drivers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_back_staff_orders_updated_at ON public.back_staff_orders;
CREATE TRIGGER update_back_staff_orders_updated_at
    BEFORE UPDATE ON public.back_staff_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. SEED DATA
DO $$
DECLARE
    super_admin_uuid UUID := gen_random_uuid();
    eatontown_id UUID := gen_random_uuid();
    brick_id UUID := gen_random_uuid();
    howell_id UUID := gen_random_uuid();
    neptune_id UUID := gen_random_uuid();
    toms_river_id UUID := gen_random_uuid();
BEGIN
    -- Seed Offices
    INSERT INTO public.offices (id, name, address, contact_info, is_active) VALUES
        (eatontown_id, 'Eatontown', '1 Industrial Way W, Eatontown, NJ 07724', '(732) 542-0000', true),
        (brick_id, 'Brick', '1972 Hooper Ave, Brick, NJ 08724', '(732) 477-0000', true),
        (howell_id, 'Howell', '4256 US-9, Howell, NJ 07731', '(732) 363-0000', true),
        (neptune_id, 'Neptune', '3350 NJ-33, Neptune, NJ 07753', '(732) 774-0000', true),
        (toms_river_id, 'Toms River', '1430 Hooper Ave, Toms River, NJ 08753', '(732) 349-0000', true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Doctors
    INSERT INTO public.providers (id, name, provider_type, office_id, is_active) VALUES
        (gen_random_uuid(), 'Dr. Admasu Gizachew', 'doctor'::public.provider_type, eatontown_id, true),
        (gen_random_uuid(), 'Dr. Alan Schwartz', 'doctor'::public.provider_type, brick_id, true),
        (gen_random_uuid(), 'Dr. Avi Weisfogel', 'doctor'::public.provider_type, howell_id, true),
        (gen_random_uuid(), 'Dr. Benny Gorelik', 'doctor'::public.provider_type, neptune_id, true),
        (gen_random_uuid(), 'Dr. David Rosen', 'doctor'::public.provider_type, toms_river_id, true),
        (gen_random_uuid(), 'Dr. Elana Weisfogel', 'doctor'::public.provider_type, eatontown_id, true),
        (gen_random_uuid(), 'Dr. Erica Weisfogel', 'doctor'::public.provider_type, brick_id, true),
        (gen_random_uuid(), 'Dr. Gary Weisfogel', 'doctor'::public.provider_type, howell_id, true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Hygienists
    INSERT INTO public.providers (id, name, provider_type, office_id, is_active) VALUES
        (gen_random_uuid(), 'Sheryl Dubman', 'hygienist'::public.provider_type, eatontown_id, true),
        (gen_random_uuid(), 'Tracy Bushman', 'hygienist'::public.provider_type, brick_id, true),
        (gen_random_uuid(), 'Alicia Morales', 'hygienist'::public.provider_type, howell_id, true),
        (gen_random_uuid(), 'Brenda Kessler', 'hygienist'::public.provider_type, neptune_id, true),
        (gen_random_uuid(), 'Carol Feinstein', 'hygienist'::public.provider_type, toms_river_id, true),
        (gen_random_uuid(), 'Donna Shapiro', 'hygienist'::public.provider_type, eatontown_id, true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Cost Drivers
    INSERT INTO public.cost_drivers (id, name, category, is_active) VALUES
        (gen_random_uuid(), 'Payroll Tax', 'Payroll', true),
        (gen_random_uuid(), 'QuickBooks Payments', 'Payment Processing', true),
        (gen_random_uuid(), 'Workers Compensation', 'Payroll', true),
        (gen_random_uuid(), 'Health Insurance', 'Benefits', true),
        (gen_random_uuid(), 'Dental Insurance', 'Benefits', true),
        (gen_random_uuid(), 'Credit Card Processing Fees', 'Payment Processing', true),
        (gen_random_uuid(), 'Bank Fees', 'Payment Processing', true),
        (gen_random_uuid(), '401k Employer Match', 'Benefits', true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Back Staff Orders
    INSERT INTO public.back_staff_orders (id, name, category, is_active) VALUES
        (gen_random_uuid(), 'Amazon', 'Office Supplies', true),
        (gen_random_uuid(), 'Dental Laboratory Group', 'Lab Fees', true),
        (gen_random_uuid(), 'Rent', 'Facilities', true),
        (gen_random_uuid(), 'Patterson Dental', 'Dental Supplies', true),
        (gen_random_uuid(), 'Henry Schein', 'Dental Supplies', true),
        (gen_random_uuid(), 'Utilities', 'Facilities', true),
        (gen_random_uuid(), 'Dental City', 'Dental Supplies', true),
        (gen_random_uuid(), 'Benco Dental', 'Dental Supplies', true),
        (gen_random_uuid(), 'Staples', 'Office Supplies', true),
        (gen_random_uuid(), 'Waste Management', 'Facilities', true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Super Admin user
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES (
        super_admin_uuid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@nudental.com',
        crypt('Admin@123', gen_salt('bf', 10)),
        now(), now(), now(),
        jsonb_build_object('full_name', 'NU Dental Admin', 'role', 'super_admin'),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    ) ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
