-- Migration: Add profile_update and birthday_reminder notification support
-- The notifications table already exists; this migration adds indexes and
-- a helper function to insert these two new notification types safely.

-- 1. Ensure the notifications table has indexes for the new types
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON public.notifications (notification_type);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- 2. Helper function: create a profile_update notification for a user
CREATE OR REPLACE FUNCTION public.create_profile_update_notification(
  p_user_id UUID,
  p_full_name TEXT,
  p_changed_fields TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    notification_type,
    title,
    message,
    metadata
  ) VALUES (
    p_user_id,
    'profile_update',
    'Profile Updated',
    'Your profile information was successfully updated.',
    jsonb_build_object(
      'full_name', p_full_name,
      'changed_fields', p_changed_fields,
      'updated_at', now()::TEXT
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'create_profile_update_notification failed: %', SQLERRM;
END;
$$;

-- 3. Helper function: create birthday_reminder notifications
--    Called once per session from the birthday check hook
CREATE OR REPLACE FUNCTION public.create_birthday_reminder_notification(
  p_user_id UUID,
  p_birthday_person_name TEXT,
  p_is_own_birthday BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF p_is_own_birthday THEN
    v_title  := '🎉 Happy Birthday!';
    v_message := 'Wishing you a wonderful birthday, ' || p_birthday_person_name || '!';
  ELSE
    v_title  := '🎂 Birthday Reminder';
    v_message := 'Today is ' || p_birthday_person_name || '''s birthday! Send them a wish!';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    notification_type,
    title,
    message,
    metadata
  ) VALUES (
    p_user_id,
    'birthday_reminder',
    v_title,
    v_message,
    jsonb_build_object(
      'birthday_person', p_birthday_person_name,
      'is_own_birthday', p_is_own_birthday,
      'birthday_date', to_char(now(), 'MM-DD')
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'create_birthday_reminder_notification failed: %', SQLERRM;
END;
$$;
