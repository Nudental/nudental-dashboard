-- ============================================================
-- Provider Identity & Payroll Mapping Layer
-- Safe, backward-compatible. Does NOT alter existing tables.
-- Adds mapping/adapter tables alongside existing schema.
-- ============================================================

-- ─── 1. PROVIDER MASTER ──────────────────────────────────────────────────────
-- Links a canonical provider record to the existing providers table (staff_id).
-- Preserves all existing providers rows; this is an overlay.
CREATE TABLE IF NOT EXISTS public.provider_master (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id          uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  display_name      text NOT NULL,
  normalized_name   text NOT NULL,
  provider_type     text NOT NULL CHECK (provider_type IN ('doctor','hygienist','unknown')),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_master_staff_id ON public.provider_master(staff_id);
CREATE INDEX IF NOT EXISTS idx_provider_master_normalized_name ON public.provider_master(normalized_name);

-- ─── 2. PROVIDER OFFICE ASSIGNMENTS ──────────────────────────────────────────
-- One provider can belong to many offices (multi-office support).
CREATE TABLE IF NOT EXISTS public.provider_office_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_master_id uuid NOT NULL REFERENCES public.provider_master(id) ON DELETE CASCADE,
  office_id         uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  office_name_raw   text,
  is_active         boolean NOT NULL DEFAULT true,
  effective_from    date,
  effective_to      date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poa_provider_master_id ON public.provider_office_assignments(provider_master_id);
CREATE INDEX IF NOT EXISTS idx_poa_office_id ON public.provider_office_assignments(office_id);

-- ─── 3. PAYROLL PROVIDER MAPPINGS ────────────────────────────────────────────
-- Maps raw payroll/Dentrix provider strings to canonical provider_master records.
-- Preserves raw imported values for audit/traceability.
CREATE TABLE IF NOT EXISTS public.payroll_provider_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_master_id    uuid REFERENCES public.provider_master(id) ON DELETE SET NULL,
  raw_payroll_name      text NOT NULL,
  raw_payroll_office    text,
  normalized_name       text NOT NULL,
  normalized_type       text CHECK (normalized_type IN ('doctor','hygienist','unknown')),
  mapping_status        text NOT NULL DEFAULT 'pending'
                          CHECK (mapping_status IN ('mapped','needs_review','unknown_type','unknown_office','pending')),
  confidence            numeric(5,2) DEFAULT 0,
  needs_review          boolean NOT NULL DEFAULT false,
  review_notes          text,
  reviewed_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppm_raw_name ON public.payroll_provider_mappings(normalized_name);
CREATE INDEX IF NOT EXISTS idx_ppm_status ON public.payroll_provider_mappings(mapping_status);
CREATE INDEX IF NOT EXISTS idx_ppm_provider_master_id ON public.payroll_provider_mappings(provider_master_id);

-- ─── 4. PROVIDER ALIASES ─────────────────────────────────────────────────────
-- Alias names for a provider (e.g. "Fitzpatrick, John" = "Dr. John Fitzpatrick").
CREATE TABLE IF NOT EXISTS public.provider_aliases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_master_id    uuid NOT NULL REFERENCES public.provider_master(id) ON DELETE CASCADE,
  alias_name            text NOT NULL,
  normalized_alias      text NOT NULL,
  source                text DEFAULT 'manual' CHECK (source IN ('manual','dentrix','import','system')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_provider_master_id ON public.provider_aliases(provider_master_id);
CREATE INDEX IF NOT EXISTS idx_pa_normalized_alias ON public.provider_aliases(normalized_alias);

-- ─── 5. MAPPING AUDIT LOG ────────────────────────────────────────────────────
-- Non-destructive audit trail for all mapping changes by Super Admin.
CREATE TABLE IF NOT EXISTS public.provider_mapping_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id      uuid REFERENCES public.payroll_provider_mappings(id) ON DELETE SET NULL,
  action          text NOT NULL,
  old_values      jsonb,
  new_values      jsonb,
  performed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_at    timestamptz NOT NULL DEFAULT now(),
  notes           text
);

-- ─── 6. UPDATED_AT TRIGGERS ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provider_master_updated_at'
  ) THEN
    CREATE TRIGGER trg_provider_master_updated_at
      BEFORE UPDATE ON public.provider_master
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ppm_updated_at'
  ) THEN
    CREATE TRIGGER trg_ppm_updated_at
      BEFORE UPDATE ON public.payroll_provider_mappings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ─── 7. RLS POLICIES ─────────────────────────────────────────────────────────
ALTER TABLE public.provider_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_office_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_provider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_mapping_audit ENABLE ROW LEVEL SECURITY;

-- Super admin helper (reuse if exists, else create)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

-- provider_master: super_admin full access, others read active records
DROP POLICY IF EXISTS "provider_master_super_admin" ON public.provider_master;
CREATE POLICY "provider_master_super_admin"
  ON public.provider_master FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "provider_master_read_active" ON public.provider_master;
CREATE POLICY "provider_master_read_active"
  ON public.provider_master FOR SELECT
  USING (is_active = true);

-- provider_office_assignments: super_admin full, others read active
DROP POLICY IF EXISTS "poa_super_admin" ON public.provider_office_assignments;
CREATE POLICY "poa_super_admin"
  ON public.provider_office_assignments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "poa_read_active" ON public.provider_office_assignments;
CREATE POLICY "poa_read_active"
  ON public.provider_office_assignments FOR SELECT
  USING (is_active = true);

-- payroll_provider_mappings: super_admin only
DROP POLICY IF EXISTS "ppm_super_admin" ON public.payroll_provider_mappings;
CREATE POLICY "ppm_super_admin"
  ON public.payroll_provider_mappings FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- provider_aliases: super_admin full, others read
DROP POLICY IF EXISTS "pa_super_admin" ON public.provider_aliases;
CREATE POLICY "pa_super_admin"
  ON public.provider_aliases FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "pa_read" ON public.provider_aliases;
CREATE POLICY "pa_read"
  ON public.provider_aliases FOR SELECT
  USING (true);

-- provider_mapping_audit: super_admin only
DROP POLICY IF EXISTS "pma_super_admin" ON public.provider_mapping_audit;
CREATE POLICY "pma_super_admin"
  ON public.provider_mapping_audit FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── 8. BACKFILL: Seed provider_master from existing providers table ──────────
-- Safe insert: only adds records not already present (idempotent).
INSERT INTO public.provider_master (staff_id, display_name, normalized_name, provider_type, is_active)
SELECT
  p.id AS staff_id,
  p.name AS display_name,
  lower(trim(regexp_replace(regexp_replace(p.name, '^Dr\.?\s*', '', 'i'), '[^a-z0-9 ]', '', 'gi'))) AS normalized_name,
  CASE
    WHEN lower(p.provider_type::text) IN ('doctor','dentist','dds','dmd','oral_surgeon','orthodontist','periodontist','endodontist','prosthodontist','pediatric_dentist','general_dentist','specialist') THEN 'doctor'
    WHEN lower(p.provider_type::text) IN ('hygienist','rdh','dental_hygienist','hygiene','temp_hygiene','temp hygiene') THEN 'hygienist'
    ELSE 'unknown'
  END AS provider_type,
  COALESCE(p.is_active, true) AS is_active
FROM public.providers p
WHERE NOT EXISTS (
  SELECT 1 FROM public.provider_master pm WHERE pm.staff_id = p.id
)
ON CONFLICT DO NOTHING;

-- ─── 9. BACKFILL: Seed provider_office_assignments from providers table ───────
INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
SELECT
  pm.id AS provider_master_id,
  p.office_id,
  o.name AS office_name_raw,
  COALESCE(p.is_active, true) AS is_active
FROM public.providers p
JOIN public.provider_master pm ON pm.staff_id = p.id
LEFT JOIN public.offices o ON o.id = p.office_id
WHERE p.office_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.provider_office_assignments poa
    WHERE poa.provider_master_id = pm.id AND poa.office_id = p.office_id
  )
ON CONFLICT DO NOTHING;
