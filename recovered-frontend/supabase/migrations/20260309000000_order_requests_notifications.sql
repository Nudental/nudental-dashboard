-- ============================================================
-- Order Requests Notification System
-- Migration: 20260309000000_order_requests_notifications.sql
-- Creates order_requests table + DB trigger → edge function
-- ============================================================

-- ── 1. ENUM TYPES ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.order_request_type AS ENUM (
    'Front Desk',
    'Back Staff',
    'Dental Supply'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_request_priority AS ENUM (
    'Normal',
    'Important',
    'High',
    'Urgent',
    'Critical'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_request_status AS ENUM (
    'Pending',
    'Acknowledged',
    'In Progress',
    'Fulfilled',
    'Rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. ORDER REQUESTS TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name         TEXT NOT NULL,
  request_type        public.order_request_type NOT NULL DEFAULT 'Back Staff',
  priority            public.order_request_priority NOT NULL DEFAULT 'Normal',
  is_monthly_request  BOOLEAN NOT NULL DEFAULT false,
  submitted_by_id     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_by_name   TEXT,
  items               JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes               TEXT,
  req_status          public.order_request_status NOT NULL DEFAULT 'Pending',
  notification_sent   BOOLEAN NOT NULL DEFAULT false,
  notification_error  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 3. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_order_requests_office
  ON public.order_requests (office_name);

CREATE INDEX IF NOT EXISTS idx_order_requests_type
  ON public.order_requests (request_type);

CREATE INDEX IF NOT EXISTS idx_order_requests_priority
  ON public.order_requests (priority);

CREATE INDEX IF NOT EXISTS idx_order_requests_status
  ON public.order_requests (req_status);

CREATE INDEX IF NOT EXISTS idx_order_requests_created
  ON public.order_requests (created_at DESC);

-- ── 4. UPDATED_AT TRIGGER FUNCTION ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_order_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_requests_updated_at ON public.order_requests;
CREATE TRIGGER trg_order_requests_updated_at
  BEFORE UPDATE ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_requests_updated_at();

-- ── 5. NOTIFICATION TRIGGER FUNCTION ───────────────────────────────────────
-- Uses pg_net (built-in Supabase extension) to call the edge function
-- after every INSERT on order_requests.
-- The SUPABASE_URL and SERVICE_ROLE_KEY are read from vault secrets
-- (set via: SELECT vault.create_secret('...', 'supabase_url'); etc.)
-- Fallback: reads from app.settings GUC if vault is not configured.

CREATE OR REPLACE FUNCTION public.notify_order_request_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  _url         TEXT;
  _service_key TEXT;
  _payload     JSONB;
BEGIN
  -- Read Supabase project URL and service role key from DB settings
  -- These are automatically available inside Supabase edge-function triggers
  -- via the supabase_functions schema or app.settings GUC.
  BEGIN
    _url         := current_setting('app.supabase_url',         true);
    _service_key := current_setting('app.supabase_service_key', true);
  EXCEPTION WHEN OTHERS THEN
    _url         := NULL;
    _service_key := NULL;
  END;

  -- If settings are not configured, skip silently (notifications will be
  -- triggered from the application layer via orderRequestService.js instead)
  IF _url IS NULL OR _url = '' OR _service_key IS NULL OR _service_key = '' THEN
    RAISE WARNING 'order_request_notify: app.supabase_url or app.supabase_service_key not set — skipping DB-level notification';
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'id',                 NEW.id,
    'office_name',        NEW.office_name,
    'request_type',       NEW.request_type,
    'priority',           NEW.priority,
    'is_monthly_request', NEW.is_monthly_request,
    'submitted_by_name',  COALESCE(NEW.submitted_by_name, 'Unknown'),
    'items',              COALESCE(NEW.items, '[]'::JSONB),
    'notes',              COALESCE(NEW.notes, ''),
    'created_at',         NEW.created_at
  );

  PERFORM net.http_post(
    url     := _url || '/functions/v1/order-request-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := _payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the INSERT; log the error silently
    RAISE WARNING 'order_request notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_order_request_notify ON public.order_requests;
CREATE TRIGGER trg_order_request_notify
  AFTER INSERT ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_request_inserted();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own requests
DROP POLICY IF EXISTS "order_requests_insert" ON public.order_requests;
CREATE POLICY "order_requests_insert"
  ON public.order_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by_id = auth.uid());

-- Users can view their own requests; admins/RCM/OM can view all
DROP POLICY IF EXISTS "order_requests_select" ON public.order_requests;
CREATE POLICY "order_requests_select"
  ON public.order_requests
  FOR SELECT
  TO authenticated
  USING (
    submitted_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('super_admin', 'regional_clinical_manager', 'office_manager')
    )
  );

-- Admins/RCM/OM can update status
DROP POLICY IF EXISTS "order_requests_update" ON public.order_requests;
CREATE POLICY "order_requests_update"
  ON public.order_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('super_admin', 'regional_clinical_manager', 'office_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('super_admin', 'regional_clinical_manager', 'office_manager')
    )
  );

-- ── 7. APP-LAYER FALLBACK: configure DB settings if needed ──────────────────────
-- Run this manually in the Supabase SQL editor AFTER deployment,
-- replacing the placeholder values with your actual project URL and service key:
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres SET app.supabase_service_key = '<service-role-key>';
--
-- Without these settings the DB trigger will skip the HTTP call and the
-- application layer (orderRequestService.js) will call the edge function directly.
