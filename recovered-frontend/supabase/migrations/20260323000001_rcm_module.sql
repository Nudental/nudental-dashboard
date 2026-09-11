-- RCM Module: Revenue Cycle Management
-- Migration: 20260323000001_rcm_module.sql

-- ─── Extend user_role enum with regional_manager if not already present ─────
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'regional_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Helper function for role checks ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_rcm_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.role::text IN ('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager')
)
$$;

CREATE OR REPLACE FUNCTION public.is_office_manager_rcm()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.role::text = 'office_manager'
)
$$;

-- ─── 1. claims ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  claim_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  payor TEXT,
  date_created DATE,
  date_submitted DATE,
  date_received DATE,
  last_visit_date DATE,
  date_of_service DATE,
  amount_billed NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','paid','denied','partial','voided')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_office_id ON public.claims(office_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_date_of_service ON public.claims(date_of_service);
CREATE INDEX IF NOT EXISTS idx_claims_date_submitted ON public.claims(date_submitted);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_claims" ON public.claims;
CREATE POLICY "rcm_admin_full_access_claims"
ON public.claims FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_claims" ON public.claims;
CREATE POLICY "rcm_office_manager_scoped_claims"
ON public.claims FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);

-- ─── 2. payment_arrangements ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_arrangements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  arrangement_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','overdue','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_arrangements_office_id ON public.payment_arrangements(office_id);
CREATE INDEX IF NOT EXISTS idx_payment_arrangements_status ON public.payment_arrangements(status);

ALTER TABLE public.payment_arrangements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_payment_arrangements" ON public.payment_arrangements;
CREATE POLICY "rcm_admin_full_access_payment_arrangements"
ON public.payment_arrangements FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_payment_arrangements" ON public.payment_arrangements;
CREATE POLICY "rcm_office_manager_scoped_payment_arrangements"
ON public.payment_arrangements FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);

-- ─── 3. patient_statements ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.patient_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  statement_date DATE,
  balance NUMERIC DEFAULT 0,
  days_outstanding INTEGER DEFAULT 0,
  last_contact_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','paid','sent','overdue','collections')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_statements_office_id ON public.patient_statements(office_id);
CREATE INDEX IF NOT EXISTS idx_patient_statements_status ON public.patient_statements(status);

ALTER TABLE public.patient_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_patient_statements" ON public.patient_statements;
CREATE POLICY "rcm_admin_full_access_patient_statements"
ON public.patient_statements FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_patient_statements" ON public.patient_statements;
CREATE POLICY "rcm_office_manager_scoped_patient_statements"
ON public.patient_statements FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);

-- ─── 4. point_of_service_collections ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.point_of_service_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  claim_id TEXT,
  date_of_service DATE,
  provider_id TEXT,
  provider TEXT,
  line_of_business TEXT,
  service_codes TEXT,
  amount_collected NUMERIC DEFAULT 0,
  expected_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_collections_office_id ON public.point_of_service_collections(office_id);
CREATE INDEX IF NOT EXISTS idx_pos_collections_date ON public.point_of_service_collections(date_of_service);

ALTER TABLE public.point_of_service_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_pos_collections" ON public.point_of_service_collections;
CREATE POLICY "rcm_admin_full_access_pos_collections"
ON public.point_of_service_collections FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_pos_collections" ON public.point_of_service_collections;
CREATE POLICY "rcm_office_manager_scoped_pos_collections"
ON public.point_of_service_collections FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);

-- ─── 5. adjustments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  claim_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  payor TEXT,
  adjustment_type TEXT,
  adjustment_amount NUMERIC DEFAULT 0,
  adjustment_date DATE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_office_id ON public.adjustments(office_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_date ON public.adjustments(adjustment_date);

ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_adjustments" ON public.adjustments;
CREATE POLICY "rcm_admin_full_access_adjustments"
ON public.adjustments FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_adjustments" ON public.adjustments;
CREATE POLICY "rcm_office_manager_scoped_adjustments"
ON public.adjustments FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);

-- ─── 6. collection_refunds ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collection_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  claim_id TEXT,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  refund_amount NUMERIC DEFAULT 0,
  refund_date DATE,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processed','denied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_refunds_office_id ON public.collection_refunds(office_id);
CREATE INDEX IF NOT EXISTS idx_collection_refunds_status ON public.collection_refunds(status);

ALTER TABLE public.collection_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcm_admin_full_access_collection_refunds" ON public.collection_refunds;
CREATE POLICY "rcm_admin_full_access_collection_refunds"
ON public.collection_refunds FOR ALL TO authenticated
USING (public.is_rcm_admin())
WITH CHECK (public.is_rcm_admin());

DROP POLICY IF EXISTS "rcm_office_manager_scoped_collection_refunds" ON public.collection_refunds;
CREATE POLICY "rcm_office_manager_scoped_collection_refunds"
ON public.collection_refunds FOR ALL TO authenticated
USING (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_office_manager_rcm() AND
  office_id IN (
    SELECT office_id FROM public.user_office_assignments WHERE user_id = auth.uid()
  )
);
