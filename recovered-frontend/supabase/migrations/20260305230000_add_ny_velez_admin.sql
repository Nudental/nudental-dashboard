-- Migration: Add Ny Velez as Admin
-- Creates ny@thenudental.com as admin with proper auth.users + auth.identities + user_profiles entries
-- Timestamp: 20260305230000

DO $$
DECLARE
    admin_uuid UUID;
    existing_uuid UUID;
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO existing_uuid
    FROM auth.users
    WHERE email = 'ny@thenudental.com'
    LIMIT 1;

    IF existing_uuid IS NOT NULL THEN
        -- User exists: update password and ensure profile is correct
        admin_uuid := existing_uuid;

        UPDATE auth.users
        SET
            encrypted_password = crypt('Nudental@123', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now(),
            raw_user_meta_data = jsonb_build_object('full_name', 'Ny Velez', 'role', 'admin'),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[])
        WHERE id = admin_uuid;

        RAISE NOTICE 'Updated existing auth user: %', admin_uuid;
    ELSE
        -- User does not exist: create new
        admin_uuid := gen_random_uuid();

        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current, email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at, phone, phone_change,
            phone_change_token, phone_change_sent_at
        ) VALUES (
            admin_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'ny@thenudental.com',
            crypt('Nudental@123', gen_salt('bf', 10)),
            now(), now(), now(),
            jsonb_build_object('full_name', 'Ny Velez', 'role', 'admin'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
        );

        RAISE NOTICE 'Created new auth user: %', admin_uuid;
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
        admin_uuid,
        'ny@thenudental.com',
        jsonb_build_object(
            'sub', admin_uuid::TEXT,
            'email', 'ny@thenudental.com',
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
        user_id = admin_uuid,
        identity_data = jsonb_build_object(
            'sub', admin_uuid::TEXT,
            'email', 'ny@thenudental.com',
            'email_verified', true,
            'phone_verified', false
        ),
        updated_at = now();

    RAISE NOTICE 'Auth identity ensured for: ny@thenudental.com';

    -- Upsert user_profiles with admin role
    INSERT INTO public.user_profiles (
        id, email, full_name, role, is_active, is_approved, status
    ) VALUES (
        admin_uuid,
        'ny@thenudental.com',
        'Ny Velez',
        'admin'::public.user_role,
        true,
        true,
        'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin'::public.user_role,
        is_active = true,
        is_approved = true,
        status = 'Active',
        full_name = 'Ny Velez',
        updated_at = now();

    RAISE NOTICE 'User profile upserted as admin for: ny@thenudental.com';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Admin user creation failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
