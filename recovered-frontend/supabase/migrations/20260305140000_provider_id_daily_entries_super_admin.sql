-- Migration: Add provider_id to daily_entries and create super admin
-- Timestamp: 20260305140000

-- 1. Add provider_id column to daily_entries
ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_entries_provider_id ON public.daily_entries(provider_id);

-- 2. Create super admin user: admasu@thenudental.com
DO $$
DECLARE
    super_admin_uuid UUID := gen_random_uuid();
BEGIN
    -- Insert into auth.users
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
        'admasu@thenudental.com',
        crypt('Yadon@#16', gen_salt('bf', 10)),
        now(), now(), now(),
        jsonb_build_object('full_name', 'Admasu', 'role', 'super_admin'),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    )
    ON CONFLICT (email) DO UPDATE SET
        encrypted_password = crypt('Yadon@#16', gen_salt('bf', 10)),
        updated_at = now();

    -- Get the actual UUID (in case of conflict, use existing)
    SELECT id INTO super_admin_uuid FROM auth.users WHERE email = 'admasu@thenudental.com' LIMIT 1;

    -- Upsert into user_profiles with super_admin role
    INSERT INTO public.user_profiles (
        id, email, full_name, role, is_active, is_approved, status
    ) VALUES (
        super_admin_uuid,
        'admasu@thenudental.com',
        'Admasu',
        'super_admin'::public.user_role,
        true,
        true,
        'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin'::public.user_role,
        is_active = true,
        is_approved = true,
        status = 'Active',
        updated_at = now();

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Super admin creation error: %', SQLERRM;
END $$;
