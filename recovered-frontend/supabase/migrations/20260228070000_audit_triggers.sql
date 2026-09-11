-- NU Dental Internal Auditing: Database Triggers for Tamper-Proof Audit Logs
-- Automatically captures old/new data on every INSERT, UPDATE, DELETE
-- across all critical tables.

-- ─── 1. Ensure audit_logs table has ip_address and session_id columns ────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS changed_fields TEXT[];

-- ─── 2. Core audit trigger function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action       TEXT;
  v_old_values   JSONB := NULL;
  v_new_values   JSONB := NULL;
  v_record_id    UUID := NULL;
  v_user_id      UUID := NULL;
  v_changed_fields TEXT[] := NULL;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action     := 'INSERT';
    v_new_values := to_jsonb(NEW);
    -- Try to extract id field
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action     := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Capture which fields changed
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value;
  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    BEGIN v_record_id := (to_jsonb(OLD)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Attempt to get current user from auth.uid()
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Insert audit record (fire-and-forget, never block the original operation)
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      changed_fields,
      created_at
    ) VALUES (
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      v_old_values,
      v_new_values,
      v_changed_fields,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let audit failure block the main operation
    NULL;
  END;

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ─── 3. Helper macro to attach trigger to a table ────────────────────────────
-- We use DO blocks with IF NOT EXISTS checks for idempotency

-- revenue_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'revenue_entries') THEN
    DROP TRIGGER IF EXISTS trg_audit_revenue_entries ON public.revenue_entries;
    CREATE TRIGGER trg_audit_revenue_entries
      AFTER INSERT OR UPDATE OR DELETE ON public.revenue_entries
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- expense_entries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_entries') THEN
    DROP TRIGGER IF EXISTS trg_audit_expense_entries ON public.expense_entries;
    CREATE TRIGGER trg_audit_expense_entries
      AFTER INSERT OR UPDATE OR DELETE ON public.expense_entries
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- aging_snapshots
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'aging_snapshots') THEN
    DROP TRIGGER IF EXISTS trg_audit_aging_snapshots ON public.aging_snapshots;
    CREATE TRIGGER trg_audit_aging_snapshots
      AFTER INSERT OR UPDATE OR DELETE ON public.aging_snapshots
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- offices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offices') THEN
    DROP TRIGGER IF EXISTS trg_audit_offices ON public.offices;
    CREATE TRIGGER trg_audit_offices
      AFTER INSERT OR UPDATE OR DELETE ON public.offices
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- providers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'providers') THEN
    DROP TRIGGER IF EXISTS trg_audit_providers ON public.providers;
    CREATE TRIGGER trg_audit_providers
      AFTER INSERT OR UPDATE OR DELETE ON public.providers
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- user_profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    DROP TRIGGER IF EXISTS trg_audit_user_profiles ON public.user_profiles;
    CREATE TRIGGER trg_audit_user_profiles
      AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- categories (cost_drivers used as categories)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_drivers') THEN
    DROP TRIGGER IF EXISTS trg_audit_cost_drivers ON public.cost_drivers;
    CREATE TRIGGER trg_audit_cost_drivers
      AFTER INSERT OR UPDATE OR DELETE ON public.cost_drivers
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- back_staff_orders (expense categories)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'back_staff_orders') THEN
    DROP TRIGGER IF EXISTS trg_audit_back_staff_orders ON public.back_staff_orders;
    CREATE TRIGGER trg_audit_back_staff_orders
      AFTER INSERT OR UPDATE OR DELETE ON public.back_staff_orders
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
  END IF;
END $$;

-- ─── 4. Index for changed_fields GIN search ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
