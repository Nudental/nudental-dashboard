-- Migration: Fix Super Admin Creation
-- Creates admasu@thenudental.com as super_admin with proper auth.users + auth.identities entries
-- Timestamp: 20260305150000

DO $$
DECLARE
    super_admin_uuid UUID;
    existing_uuid UUID;
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO existing_uuid
    FROM auth.users
    WHERE email = 'admasu@thenudental.com'
    LIMIT 1;

    IF existing_uuid IS NOT NULL THEN
        -- User exists: update password and ensure profile is correct
        super_admin_uuid := existing_uuid;

        UPDATE auth.users
        SET
            encrypted_password = crypt('Yadon@#16', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now(),
            raw_user_meta_data = jsonb_build_object('full_name', 'Admasu', 'role', 'super_admin'),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[])
        WHERE id = super_admin_uuid;

        RAISE NOTICE 'Updated existing auth user: %', super_admin_uuid;
    ELSE
        -- User does not exist: create new
        super_admin_uuid := gen_random_uuid();

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
        );

        RAISE NOTICE 'Created new auth user: %', super_admin_uuid;
    END IF;

    -- Ensure auth.identities entry exists (required for email/password login)
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        super_admin_uuid,
        'admasu@thenudental.com',
        jsonb_build_object(
            'sub', super_admin_uuid::TEXT,
            'email', 'admasu@thenudental.com',
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
        user_id = super_admin_uuid,
        identity_data = jsonb_build_object(
            'sub', super_admin_uuid::TEXT,
            'email', 'admasu@thenudental.com',
            'email_verified', true,
            'phone_verified', false
        ),
        updated_at = now();

    RAISE NOTICE 'Auth identity ensured for: admasu@thenudental.com';

    -- Upsert user_profiles with super_admin role
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
        full_name = 'Admasu',
        updated_at = now();

    RAISE NOTICE 'User profile upserted as super_admin for: admasu@thenudental.com';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Super admin creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
