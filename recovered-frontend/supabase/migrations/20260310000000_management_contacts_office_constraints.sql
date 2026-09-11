-- ============================================================
-- Management Contacts, Office Validation & Order Routing
-- Migration: 20260310000000_management_contacts_office_constraints.sql
-- ============================================================
-- 1. Ensure all 4 canonical offices exist (idempotent upsert)
-- 2. Create management_contacts table with seeded contacts
-- 3. Add CHECK constraints on office_location/office_name TEXT columns
-- 4. Add helper function for order_request routing lookup
-- ============================================================

-- ── STEP 1: Ensure the 4 canonical offices exist ─────────────────────────────
-- The offices table already has a UNIQUE index on LOWER(TRIM(name)).
-- We use INSERT ... ON CONFLICT DO NOTHING so this is fully idempotent.

DO $$
BEGIN
  INSERT INTO public.offices (name, is_active)
  VALUES
    ('Nu Dental of Eatontown',   true),
    ('Nu Dental of Brick',       true),
    ('Nu Dental of Barnegat',    true),
    ('Nu Dental of Staten Island', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'One or more offices already exist — skipping insert.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Office seed skipped: %', SQLERRM;
END $$;

-- Ensure all 4 offices are active
UPDATE public.offices
SET is_active = true
WHERE LOWER(TRIM(name)) IN (
  'nu dental of eatontown',
  'nu dental of brick',
  'nu dental of barnegat',
  'nu dental of staten island'
);

-- ── STEP 2: management_contacts table ────────────────────────────────────────
-- Stores the two regional managers and the supply categories they own.
-- The `linked_categories` column is a TEXT[] array of supply category keywords
-- that route order_requests to this contact.

CREATE TABLE IF NOT EXISTS public.management_contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title         TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  phone              TEXT NOT NULL,
  linked_categories  TEXT[] NOT NULL DEFAULT '{}',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_management_contacts_email
  ON public.management_contacts (email);

CREATE INDEX IF NOT EXISTS idx_management_contacts_role
  ON public.management_contacts (role_title);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_management_contacts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_management_contacts_updated_at ON public.management_contacts;
CREATE TRIGGER trg_management_contacts_updated_at
  BEFORE UPDATE ON public.management_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_management_contacts_updated_at();

-- RLS
ALTER TABLE public.management_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "management_contacts_read" ON public.management_contacts;
CREATE POLICY "management_contacts_read"
  ON public.management_contacts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "management_contacts_write" ON public.management_contacts;
CREATE POLICY "management_contacts_write"
  ON public.management_contacts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── STEP 3: Seed the two management contacts ─────────────────────────────────
-- Ny Velez  → Regional Manager → Front Desk categories
-- Maia Dolidze → Regional Clinical Manager → Back Staff + Clinical categories

INSERT INTO public.management_contacts
  (role_title, full_name, email, phone, linked_categories, is_active)
VALUES
  (
    'Regional Manager',
    'Nyasiah Velez',
    'Ny@thenudental.com',
    '+17328242033',
    ARRAY['Front Desk']::TEXT[],
    true
  ),
  (
    'Regional Clinical Manager',
    'Maia Dolidze',
    'Maia@thenudental.com',
    '+19084943163',
    ARRAY['Back Staff', 'Clinical', 'Dental Supply']::TEXT[],
    true
  )
ON CONFLICT (email) DO UPDATE
  SET
    role_title        = EXCLUDED.role_title,
    full_name         = EXCLUDED.full_name,
    phone             = EXCLUDED.phone,
    linked_categories = EXCLUDED.linked_categories,
    is_active         = EXCLUDED.is_active,
    updated_at        = now();

-- ── STEP 4: Helper function — resolve notification recipient ─────────────────
-- Returns the management_contacts row whose linked_categories array contains
-- the given request_type (case-insensitive prefix match).
-- Used by the edge function and any server-side logic.

CREATE OR REPLACE FUNCTION public.get_order_request_recipient(
  p_request_type TEXT
)
RETURNS TABLE (
  contact_id   UUID,
  role_title   TEXT,
  full_name    TEXT,
  email        TEXT,
  phone        TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.role_title,
    mc.full_name,
    mc.email,
    mc.phone
  FROM public.management_contacts mc
  WHERE mc.is_active = true
    AND EXISTS (
      SELECT 1
      FROM unnest(mc.linked_categories) AS cat
      WHERE LOWER(cat) = LOWER(p_request_type)
    )
  LIMIT 1;
END;
$func$;

-- ── STEP 5: CHECK constraints — office_name TEXT column ──────────────────────
-- order_requests.office_name must be one of the 4 canonical names.

ALTER TABLE public.order_requests
  DROP CONSTRAINT IF EXISTS chk_order_requests_office_name;

ALTER TABLE public.order_requests
  ADD CONSTRAINT chk_order_requests_office_name
  CHECK (
    office_name IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- ── STEP 6: CHECK constraints — office_id TEXT columns in supply tables ──────
-- These tables store office names as plain TEXT in the office_id column.
-- We add CHECK constraints so only the 4 canonical names are accepted.

-- office_supply_inventory
ALTER TABLE public.office_supply_inventory
  DROP CONSTRAINT IF EXISTS chk_osi_office_id;

ALTER TABLE public.office_supply_inventory
  ADD CONSTRAINT chk_osi_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- supply_inventory_history
ALTER TABLE public.supply_inventory_history
  DROP CONSTRAINT IF EXISTS chk_sih_office_id;

ALTER TABLE public.supply_inventory_history
  ADD CONSTRAINT chk_sih_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- supply_request_batches
ALTER TABLE public.supply_request_batches
  DROP CONSTRAINT IF EXISTS chk_srb_office_id;

ALTER TABLE public.supply_request_batches
  ADD CONSTRAINT chk_srb_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- supply_request_items
ALTER TABLE public.supply_request_items
  DROP CONSTRAINT IF EXISTS chk_sri_office_id;

ALTER TABLE public.supply_request_items
  ADD CONSTRAINT chk_sri_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- urgent_supply_requests
ALTER TABLE public.urgent_supply_requests
  DROP CONSTRAINT IF EXISTS chk_usr_office_id;

ALTER TABLE public.urgent_supply_requests
  ADD CONSTRAINT chk_usr_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- supply_fulfillment_logs
ALTER TABLE public.supply_fulfillment_logs
  DROP CONSTRAINT IF EXISTS chk_sfl_office_id;

ALTER TABLE public.supply_fulfillment_logs
  ADD CONSTRAINT chk_sfl_office_id
  CHECK (
    office_id IN (
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island'
    )
  );

-- ── STEP 7: Update the notification trigger to use management_contacts ────────
-- The trigger function now performs a DB lookup via get_order_request_recipient()
-- to resolve the recipient dynamically from the management_contacts table.
-- This ensures any future changes to contacts are automatically picked up.

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
  BEGIN
    _url         := current_setting('app.supabase_url',         true);
    _service_key := current_setting('app.supabase_service_key', true);
  EXCEPTION WHEN OTHERS THEN
    _url         := NULL;
    _service_key := NULL;
  END;

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
    RAISE WARNING 'order_request notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$func$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_order_request_notify ON public.order_requests;
CREATE TRIGGER trg_order_request_notify
  AFTER INSERT ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_request_inserted();
