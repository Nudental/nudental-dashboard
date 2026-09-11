-- Migration: 20260331180000_error_log_notification_trigger.sql
-- Sends real-time email notifications to admins when critical or error-level events are logged

-- 1. Create a helper function that invokes the edge function via pg_net (HTTP)
--    pg_net is available on all Supabase projects.
CREATE OR REPLACE FUNCTION public.notify_admins_on_critical_error()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only fire for critical or error severity
  IF NEW.severity NOT IN ('critical', 'error') THEN
    RETURN NEW;
  END IF;

  -- Retrieve project URL and service role key from vault/settings
  -- These are automatically available as GUC settings in Supabase
  v_url := current_setting('app.supabase_url', true);
  v_service_key := current_setting('app.supabase_service_role_key', true);

  -- Use pg_net to call the edge function asynchronously (non-blocking)
  IF v_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/error-log-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'severity', NEW.severity::text,
          'message', NEW.message,
          'stack_trace', NEW.stack_trace,
          'component_name', NEW.component_name,
          'page_url', NEW.page_url,
          'user_email', NEW.user_email,
          'user_role', NEW.user_role,
          'environment', NEW.environment,
          'created_at', NEW.created_at
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_error_log_notify_admins ON public.error_logs;

CREATE TRIGGER trg_error_log_notify_admins
  AFTER INSERT ON public.error_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_critical_error();
