-- ============================================================
-- Canonical Provider Seed, Alias Pre-seeding, and Mapping Fix
-- Timestamp: 20260419000000
-- Safe, idempotent, backward-compatible.
-- ============================================================

-- ─── 1. FIX provider_master provider_type CHECK CONSTRAINT ───────────────────
-- Add 'temp_hygienist' as a valid type (was missing, causing insert failures)
ALTER TABLE public.provider_master
  DROP CONSTRAINT IF EXISTS provider_master_provider_type_check;

ALTER TABLE public.provider_master
  ADD CONSTRAINT provider_master_provider_type_check
  CHECK (provider_type IN ('doctor','hygienist','temp_hygienist','unknown'));

-- ─── 2. FIX payroll_provider_mappings normalized_type CHECK ──────────────────
ALTER TABLE public.payroll_provider_mappings
  DROP CONSTRAINT IF EXISTS payroll_provider_mappings_normalized_type_check;

ALTER TABLE public.payroll_provider_mappings
  ADD CONSTRAINT payroll_provider_mappings_normalized_type_check
  CHECK (normalized_type IN ('doctor','hygienist','temp_hygienist','unknown'));

-- ─── 3. ADD failure_reason COLUMN to payroll_provider_mappings ───────────────
ALTER TABLE public.payroll_provider_mappings
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'dentrix',
  ADD COLUMN IF NOT EXISTS pay_period text,
  ADD COLUMN IF NOT EXISTS import_run_id text,
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_ignored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ignored_at timestamptz,
  ADD COLUMN IF NOT EXISTS super_admin_override boolean NOT NULL DEFAULT false;

-- ─── 4. ADD mapping_status 'ignored' and 'placeholder' ───────────────────────
ALTER TABLE public.payroll_provider_mappings
  DROP CONSTRAINT IF EXISTS payroll_provider_mappings_mapping_status_check;

ALTER TABLE public.payroll_provider_mappings
  ADD CONSTRAINT payroll_provider_mappings_mapping_status_check
  CHECK (mapping_status IN ('mapped','needs_review','unknown_type','unknown_office','pending','ignored','placeholder'));

-- ─── 5. FIX RLS: allow authenticated users to read payroll_provider_mappings ──
-- (enrichPayrollRows is called for all payroll loads, not just super_admin)
DROP POLICY IF EXISTS "ppm_super_admin" ON public.payroll_provider_mappings;
DROP POLICY IF EXISTS "ppm_read_authenticated" ON public.payroll_provider_mappings;

CREATE POLICY "ppm_super_admin_write"
  ON public.payroll_provider_mappings FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "ppm_read_authenticated"
  ON public.payroll_provider_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── 6. FIX RLS: allow authenticated users to read provider_master ────────────
-- Remove conflicting policies and consolidate
DROP POLICY IF EXISTS "provider_master_super_admin" ON public.provider_master;
DROP POLICY IF EXISTS "provider_master_read_active" ON public.provider_master;

CREATE POLICY "provider_master_super_admin_write"
  ON public.provider_master FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "provider_master_read_authenticated"
  ON public.provider_master FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── 7. FIX RLS: allow authenticated users to read provider_aliases ───────────
DROP POLICY IF EXISTS "pa_super_admin" ON public.provider_aliases;
DROP POLICY IF EXISTS "pa_read" ON public.provider_aliases;

CREATE POLICY "pa_super_admin_write"
  ON public.provider_aliases FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "pa_read_authenticated"
  ON public.provider_aliases FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── 8. FIX RLS: allow authenticated users to read provider_office_assignments ─
DROP POLICY IF EXISTS "poa_super_admin" ON public.provider_office_assignments;
DROP POLICY IF EXISTS "poa_read_active" ON public.provider_office_assignments;

CREATE POLICY "poa_super_admin_write"
  ON public.provider_office_assignments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "poa_read_authenticated"
  ON public.provider_office_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── 9. SEED CANONICAL PROVIDERS ─────────────────────────────────────────────
-- Insert all 23 canonical providers into provider_master.
-- Uses ON CONFLICT DO NOTHING on normalized_name to be idempotent.
-- We use a unique index on normalized_name for dedup.

-- DEDUP FIRST: Remove duplicate normalized_name rows before creating unique index.
-- Keep the row with the highest updated_at (or created_at) for each normalized_name.
DELETE FROM public.provider_master
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY normalized_name
             ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
           ) AS rn
    FROM public.provider_master
    WHERE normalized_name IS NOT NULL
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_master_normalized_name_unique
  ON public.provider_master(normalized_name);

-- Helper: get office_id by partial name match (case-insensitive)
-- We'll use a DO block to seed providers safely

DO $$
DECLARE
  v_brick_id     uuid;
  v_barnegat_id  uuid;
  v_eatontown_id uuid;
  v_staten_id    uuid;

  -- provider_master IDs for alias seeding
  v_margolies_id     uuid;
  v_schwartz_id      uuid;
  v_wollek_id        uuid;
  v_gmarie_id        uuid;
  v_siddiqui_id      uuid;
  v_henin_id         uuid;
  v_fitzpatrick_id   uuid;
  v_gizachew_id      uuid;
  v_doldidze_id      uuid;
  v_mustafa_id       uuid;
  v_tclark_id        uuid;
  v_jcrigby_id       uuid;
  v_jeffrigby_id     uuid;
  v_dubman_id        uuid;
  v_bushman_id       uuid;
  v_amarie_id        uuid;
  v_abuzahrieh_id    uuid;
  v_soto_id          uuid;
  v_schembari_id     uuid;
  v_vongpranovsky_id uuid;
  v_brick_temp_id    uuid;
  v_eatontown_temp_id uuid;
  v_barnegat_temp_id uuid;
  v_staten_temp_id   uuid;

BEGIN
  -- Resolve office IDs
  SELECT id INTO v_brick_id     FROM public.offices WHERE lower(name) LIKE '%brick%'      LIMIT 1;
  SELECT id INTO v_barnegat_id  FROM public.offices WHERE lower(name) LIKE '%barnegat%'   LIMIT 1;
  SELECT id INTO v_eatontown_id FROM public.offices WHERE lower(name) LIKE '%eatontown%'  LIMIT 1;
  SELECT id INTO v_staten_id    FROM public.offices WHERE lower(name) LIKE '%staten%'     LIMIT 1;

  -- ── DOCTORS ──────────────────────────────────────────────────────────────

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Norman Margolies', 'norman margolies', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_margolies_id;
  IF v_margolies_id IS NULL THEN
    SELECT id INTO v_margolies_id FROM public.provider_master WHERE normalized_name = 'norman margolies';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Alan Schwartz', 'alan schwartz', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_schwartz_id;
  IF v_schwartz_id IS NULL THEN
    SELECT id INTO v_schwartz_id FROM public.provider_master WHERE normalized_name = 'alan schwartz';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Nelson Wollek', 'nelson wollek', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_wollek_id;
  IF v_wollek_id IS NULL THEN
    SELECT id INTO v_wollek_id FROM public.provider_master WHERE normalized_name = 'nelson wollek';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Glenn Marie', 'glenn marie', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_gmarie_id;
  IF v_gmarie_id IS NULL THEN
    SELECT id INTO v_gmarie_id FROM public.provider_master WHERE normalized_name = 'glenn marie';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Amtul Siddiqui', 'amtul siddiqui', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_siddiqui_id;
  IF v_siddiqui_id IS NULL THEN
    SELECT id INTO v_siddiqui_id FROM public.provider_master WHERE normalized_name = 'amtul siddiqui';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Mark Henin', 'mark henin', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_henin_id;
  IF v_henin_id IS NULL THEN
    SELECT id INTO v_henin_id FROM public.provider_master WHERE normalized_name = 'mark henin';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('John Fitzpatrick', 'john fitzpatrick', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_fitzpatrick_id;
  IF v_fitzpatrick_id IS NULL THEN
    SELECT id INTO v_fitzpatrick_id FROM public.provider_master WHERE normalized_name = 'john fitzpatrick';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Dr. Admasu Gizachew', 'admasu gizachew', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_gizachew_id;
  IF v_gizachew_id IS NULL THEN
    SELECT id INTO v_gizachew_id FROM public.provider_master WHERE normalized_name = 'admasu gizachew';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Maia Doldidze', 'maia doldidze', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_doldidze_id;
  IF v_doldidze_id IS NULL THEN
    SELECT id INTO v_doldidze_id FROM public.provider_master WHERE normalized_name = 'maia doldidze';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Noah Mustafa', 'noah mustafa', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_mustafa_id;
  IF v_mustafa_id IS NULL THEN
    SELECT id INTO v_mustafa_id FROM public.provider_master WHERE normalized_name = 'noah mustafa';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Tamara Clark', 'tamara clark', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_tclark_id;
  IF v_tclark_id IS NULL THEN
    SELECT id INTO v_tclark_id FROM public.provider_master WHERE normalized_name = 'tamara clark';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('James Clifford Rigby', 'james clifford rigby', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_jcrigby_id;
  IF v_jcrigby_id IS NULL THEN
    SELECT id INTO v_jcrigby_id FROM public.provider_master WHERE normalized_name = 'james clifford rigby';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Jeffrey C Rigby', 'jeffrey c rigby', 'doctor', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'doctor', is_active = true
  RETURNING id INTO v_jeffrigby_id;
  IF v_jeffrigby_id IS NULL THEN
    SELECT id INTO v_jeffrigby_id FROM public.provider_master WHERE normalized_name = 'jeffrey c rigby';
  END IF;

  -- ── HYGIENISTS ────────────────────────────────────────────────────────────

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Sheryl Dubman', 'sheryl dubman', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_dubman_id;
  IF v_dubman_id IS NULL THEN
    SELECT id INTO v_dubman_id FROM public.provider_master WHERE normalized_name = 'sheryl dubman';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Tracy Bushman', 'tracy bushman', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_bushman_id;
  IF v_bushman_id IS NULL THEN
    SELECT id INTO v_bushman_id FROM public.provider_master WHERE normalized_name = 'tracy bushman';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Alyssa Marie', 'alyssa marie', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_amarie_id;
  IF v_amarie_id IS NULL THEN
    SELECT id INTO v_amarie_id FROM public.provider_master WHERE normalized_name = 'alyssa marie';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Rawan Abuzahrieh', 'rawan abuzahrieh', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_abuzahrieh_id;
  IF v_abuzahrieh_id IS NULL THEN
    SELECT id INTO v_abuzahrieh_id FROM public.provider_master WHERE normalized_name = 'rawan abuzahrieh';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Katherine Soto', 'katherine soto', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_soto_id;
  IF v_soto_id IS NULL THEN
    SELECT id INTO v_soto_id FROM public.provider_master WHERE normalized_name = 'katherine soto';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Christina Schembari', 'christina schembari', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_schembari_id;
  IF v_schembari_id IS NULL THEN
    SELECT id INTO v_schembari_id FROM public.provider_master WHERE normalized_name = 'christina schembari';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Andrey Vongpranovsky', 'andrey vongpranovsky', 'hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'hygienist', is_active = true
  RETURNING id INTO v_vongpranovsky_id;
  IF v_vongpranovsky_id IS NULL THEN
    SELECT id INTO v_vongpranovsky_id FROM public.provider_master WHERE normalized_name = 'andrey vongpranovsky';
  END IF;

  -- ── TEMP HYGIENISTS ───────────────────────────────────────────────────────

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Brick Temp Hygiene', 'brick temp hygiene', 'temp_hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'temp_hygienist', is_active = true
  RETURNING id INTO v_brick_temp_id;
  IF v_brick_temp_id IS NULL THEN
    SELECT id INTO v_brick_temp_id FROM public.provider_master WHERE normalized_name = 'brick temp hygiene';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Eatontown Temp Hygiene', 'eatontown temp hygiene', 'temp_hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'temp_hygienist', is_active = true
  RETURNING id INTO v_eatontown_temp_id;
  IF v_eatontown_temp_id IS NULL THEN
    SELECT id INTO v_eatontown_temp_id FROM public.provider_master WHERE normalized_name = 'eatontown temp hygiene';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Barnegat Temp Hygiene', 'barnegat temp hygiene', 'temp_hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'temp_hygienist', is_active = true
  RETURNING id INTO v_barnegat_temp_id;
  IF v_barnegat_temp_id IS NULL THEN
    SELECT id INTO v_barnegat_temp_id FROM public.provider_master WHERE normalized_name = 'barnegat temp hygiene';
  END IF;

  INSERT INTO public.provider_master (display_name, normalized_name, provider_type, is_active)
  VALUES ('Staten Island Temp Hygiene', 'staten island temp hygiene', 'temp_hygienist', true)
  ON CONFLICT (normalized_name) DO UPDATE SET provider_type = 'temp_hygienist', is_active = true
  RETURNING id INTO v_staten_temp_id;
  IF v_staten_temp_id IS NULL THEN
    SELECT id INTO v_staten_temp_id FROM public.provider_master WHERE normalized_name = 'staten island temp hygiene';
  END IF;

  -- ── OFFICE ASSIGNMENTS ────────────────────────────────────────────────────
  -- Seed primary office assignments (multi-office: Gizachew gets 3 offices)

  -- Doctors → Brick
  IF v_brick_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    SELECT pm.id, v_brick_id, 'Nu Dental of Brick', true
    FROM (VALUES
      (v_margolies_id), (v_siddiqui_id), (v_doldidze_id),
      (v_mustafa_id), (v_jcrigby_id), (v_jeffrigby_id)
    ) AS t(pid)
    JOIN public.provider_master pm ON pm.id = t.pid
    WHERE t.pid IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- Doctors → Barnegat
  IF v_barnegat_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    SELECT pm.id, v_barnegat_id, 'Nu Dental of Barnegat', true
    FROM (VALUES
      (v_schwartz_id), (v_gmarie_id), (v_fitzpatrick_id), (v_tclark_id)
    ) AS t(pid)
    JOIN public.provider_master pm ON pm.id = t.pid
    WHERE t.pid IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- Doctors → Eatontown
  IF v_eatontown_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    SELECT pm.id, v_eatontown_id, 'Nu Dental of Eatontown', true
    FROM (VALUES (v_wollek_id), (v_henin_id)) AS t(pid)
    JOIN public.provider_master pm ON pm.id = t.pid
    WHERE t.pid IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- Gizachew → multi-office: Staten Island, Barnegat, Eatontown
  IF v_gizachew_id IS NOT NULL THEN
    IF v_staten_id IS NOT NULL THEN
      INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
      VALUES (v_gizachew_id, v_staten_id, 'Nu Dental of Staten Island', true)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_barnegat_id IS NOT NULL THEN
      INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
      VALUES (v_gizachew_id, v_barnegat_id, 'Nu Dental of Barnegat', true)
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_eatontown_id IS NOT NULL THEN
      INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
      VALUES (v_gizachew_id, v_eatontown_id, 'Nu Dental of Eatontown', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Hygienists
  IF v_brick_id IS NOT NULL AND v_dubman_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_dubman_id, v_brick_id, 'Nu Dental of Brick', true) ON CONFLICT DO NOTHING;
  END IF;
  IF v_barnegat_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    SELECT pm.id, v_barnegat_id, 'Nu Dental of Barnegat', true
    FROM (VALUES (v_bushman_id), (v_soto_id), (v_schembari_id)) AS t(pid)
    JOIN public.provider_master pm ON pm.id = t.pid
    WHERE t.pid IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  IF v_eatontown_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    SELECT pm.id, v_eatontown_id, 'Nu Dental of Eatontown', true
    FROM (VALUES (v_amarie_id), (v_vongpranovsky_id)) AS t(pid)
    JOIN public.provider_master pm ON pm.id = t.pid
    WHERE t.pid IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  IF v_staten_id IS NOT NULL AND v_abuzahrieh_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_abuzahrieh_id, v_staten_id, 'Nu Dental of Staten Island', true) ON CONFLICT DO NOTHING;
  END IF;

  -- Temp Hygienists → their offices
  IF v_brick_id IS NOT NULL AND v_brick_temp_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_brick_temp_id, v_brick_id, 'Nu Dental of Brick', true) ON CONFLICT DO NOTHING;
  END IF;
  IF v_eatontown_id IS NOT NULL AND v_eatontown_temp_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_eatontown_temp_id, v_eatontown_id, 'Nu Dental of Eatontown', true) ON CONFLICT DO NOTHING;
  END IF;
  IF v_barnegat_id IS NOT NULL AND v_barnegat_temp_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_barnegat_temp_id, v_barnegat_id, 'Nu Dental of Barnegat', true) ON CONFLICT DO NOTHING;
  END IF;
  IF v_staten_id IS NOT NULL AND v_staten_temp_id IS NOT NULL THEN
    INSERT INTO public.provider_office_assignments (provider_master_id, office_id, office_name_raw, is_active)
    VALUES (v_staten_temp_id, v_staten_id, 'Nu Dental of Staten Island', true) ON CONFLICT DO NOTHING;
  END IF;

  -- ── ALIASES ───────────────────────────────────────────────────────────────
  -- Seed all known import name variants as aliases for persistent auto-matching

  -- Fitzpatrick aliases (most common import variant)
  IF v_fitzpatrick_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_fitzpatrick_id, 'Fitzpatrick, John',       'fitzpatrick john',       'system'),
      (v_fitzpatrick_id, 'Dr. John Fitzpatrick',    'john fitzpatrick',       'system'),
      (v_fitzpatrick_id, 'John Fitzpatrick',         'john fitzpatrick',       'system'),
      (v_fitzpatrick_id, 'FITZPATRICK JOHN',         'fitzpatrick john',       'system'),
      (v_fitzpatrick_id, 'Fitzpatrick John',         'fitzpatrick john',       'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Gizachew aliases
  IF v_gizachew_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_gizachew_id, 'Gizachew, Admasu',           'gizachew admasu',        'system'),
      (v_gizachew_id, 'Dr. Admasu Gizachew',        'admasu gizachew',        'system'),
      (v_gizachew_id, 'Admasu Gizachew',             'admasu gizachew',        'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Margolies aliases
  IF v_margolies_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_margolies_id, 'Margolies, Norman',          'margolies norman',       'system'),
      (v_margolies_id, 'Norman Margolies',            'norman margolies',       'system'),
      (v_margolies_id, 'Dr Norman Margolies',         'norman margolies',       'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Schwartz aliases
  IF v_schwartz_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_schwartz_id, 'Schwartz, Alan',              'schwartz alan',          'system'),
      (v_schwartz_id, 'Alan Schwartz',                'alan schwartz',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Wollek aliases
  IF v_wollek_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_wollek_id, 'Wollek, Nelson',                'wollek nelson',          'system'),
      (v_wollek_id, 'Nelson Wollek',                  'nelson wollek',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Glenn Marie aliases
  IF v_gmarie_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_gmarie_id, 'Marie, Glenn',                  'marie glenn',            'system'),
      (v_gmarie_id, 'Glenn Marie',                    'glenn marie',            'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Siddiqui aliases
  IF v_siddiqui_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_siddiqui_id, 'Siddiqui, Amtul',             'siddiqui amtul',         'system'),
      (v_siddiqui_id, 'Amtul Siddiqui',               'amtul siddiqui',         'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Henin aliases
  IF v_henin_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_henin_id, 'Henin, Mark',                    'henin mark',             'system'),
      (v_henin_id, 'Mark Henin',                      'mark henin',             'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Doldidze aliases
  IF v_doldidze_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_doldidze_id, 'Doldidze, Maia',              'doldidze maia',          'system'),
      (v_doldidze_id, 'Maia Doldidze',                'maia doldidze',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mustafa aliases
  IF v_mustafa_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_mustafa_id, 'Mustafa, Noah',                'mustafa noah',           'system'),
      (v_mustafa_id, 'Noah Mustafa',                  'noah mustafa',           'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tamara Clark aliases
  IF v_tclark_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_tclark_id, 'Clark, Tamara',                 'clark tamara',           'system'),
      (v_tclark_id, 'Tamara Clark',                   'tamara clark',           'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- James Rigby aliases
  IF v_jcrigby_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_jcrigby_id, 'Rigby, James Clifford',        'rigby james clifford',   'system'),
      (v_jcrigby_id, 'James Rigby',                   'james rigby',            'system'),
      (v_jcrigby_id, 'James C Rigby',                 'james c rigby',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Jeffrey Rigby aliases
  IF v_jeffrigby_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_jeffrigby_id, 'Rigby, Jeffrey C',            'rigby jeffrey c',        'system'),
      (v_jeffrigby_id, 'Jeffrey Rigby',                'jeffrey rigby',          'system'),
      (v_jeffrigby_id, 'Jeff Rigby',                   'jeff rigby',             'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Dubman aliases
  IF v_dubman_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_dubman_id, 'Dubman, Sheryl',                'dubman sheryl',          'system'),
      (v_dubman_id, 'Sheryl Dubman',                  'sheryl dubman',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bushman aliases
  IF v_bushman_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_bushman_id, 'Bushman, Tracy',               'bushman tracy',          'system'),
      (v_bushman_id, 'Tracy Bushman',                 'tracy bushman',          'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Alyssa Marie aliases
  IF v_amarie_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_amarie_id, 'Marie, Alyssa',                 'marie alyssa',           'system'),
      (v_amarie_id, 'Alyssa Marie',                   'alyssa marie',           'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Abuzahrieh aliases
  IF v_abuzahrieh_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_abuzahrieh_id, 'Abuzahrieh, Rawan',         'abuzahrieh rawan',       'system'),
      (v_abuzahrieh_id, 'Rawan Abuzahrieh',           'rawan abuzahrieh',       'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Soto aliases
  IF v_soto_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_soto_id, 'Soto, Katherine',                 'soto katherine',         'system'),
      (v_soto_id, 'Katherine Soto',                   'katherine soto',         'system'),
      (v_soto_id, 'Kathy Soto',                       'kathy soto',             'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Schembari aliases
  IF v_schembari_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_schembari_id, 'Schembari, Christina',       'schembari christina',    'system'),
      (v_schembari_id, 'Christina Schembari',         'christina schembari',    'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Vongpranovsky aliases
  IF v_vongpranovsky_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_vongpranovsky_id, 'Vongpranovsky, Andrey',  'vongpranovsky andrey',   'system'),
      (v_vongpranovsky_id, 'Andrey Vongpranovsky',    'andrey vongpranovsky',   'system')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Temp Hygiene aliases (generic import variants)
  IF v_brick_temp_id IS NOT NULL THEN
    INSERT INTO public.provider_aliases (provider_master_id, alias_name, normalized_alias, source)
    VALUES
      (v_brick_temp_id, 'Temp Hygiene',               'temp hygiene',           'system'),
      (v_brick_temp_id, 'Hygiene, Temp',               'hygiene temp',           'system'),
      (v_brick_temp_id, 'Temp Hygienist',              'temp hygienist',         'system')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

-- ─── 10. UNIQUE CONSTRAINT on provider_aliases to prevent duplicate aliases ───
-- DEDUP FIRST: Remove duplicate (provider_master_id, normalized_alias) rows
-- before creating the unique index. Keep the row with the lowest id (earliest inserted).
DELETE FROM public.provider_aliases
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY provider_master_id, normalized_alias
             ORDER BY id ASC
           ) AS rn
    FROM public.provider_aliases
    WHERE normalized_alias IS NOT NULL
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_unique_alias
  ON public.provider_aliases(provider_master_id, normalized_alias);

-- ─── 11. UNIQUE CONSTRAINT on payroll_provider_mappings raw_payroll_name ──────
-- Use raw_payroll_name as the primary dedup key (not normalized_name)
-- so "Fitzpatrick, John" and "John Fitzpatrick" both get their own mapping rows
-- but the same raw string never creates duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppm_unique_raw_name
  ON public.payroll_provider_mappings(raw_payroll_name);

-- Drop the old normalized_name-based unique index if it exists
DROP INDEX IF EXISTS idx_ppm_unique_normalized_name;

-- ─── 12. BACKFILL: link existing provider_master records to canonical seeds ───
-- If providers table has matching names, link them via staff_id
UPDATE public.provider_master pm
SET staff_id = p.id
FROM public.providers p
WHERE pm.staff_id IS NULL
  AND pm.normalized_name = lower(trim(regexp_replace(regexp_replace(p.name, '^Dr\.?\s*', '', 'i'), '[^a-z0-9 ]', '', 'gi')))
  AND p.id IS NOT NULL;

-- ─── 13. BACKFILL: auto-resolve existing payroll_provider_mappings ────────────
-- For any existing 'needs_review' mappings that now match a seeded provider_master,
-- auto-resolve them using exact normalized_name match
UPDATE public.payroll_provider_mappings ppm
SET
  provider_master_id = pm.id,
  normalized_type    = pm.provider_type,
  mapping_status     = CASE WHEN pm.provider_type = 'unknown' THEN 'unknown_type' ELSE 'mapped' END,
  needs_review       = CASE WHEN pm.provider_type = 'unknown' THEN true ELSE false END,
  confidence         = 100,
  failure_reason     = NULL
FROM public.provider_master pm
WHERE ppm.provider_master_id IS NULL
  AND ppm.mapping_status IN ('needs_review', 'pending', 'unknown_type')
  AND ppm.reviewed_at IS NULL
  AND ppm.normalized_name = pm.normalized_name;

-- Also resolve via alias match
UPDATE public.payroll_provider_mappings ppm
SET
  provider_master_id = pa.provider_master_id,
  normalized_type    = pm.provider_type,
  mapping_status     = CASE WHEN pm.provider_type = 'unknown' THEN 'unknown_type' ELSE 'mapped' END,
  needs_review       = CASE WHEN pm.provider_type = 'unknown' THEN true ELSE false END,
  confidence         = 95,
  failure_reason     = NULL
FROM public.provider_aliases pa
JOIN public.provider_master pm ON pm.id = pa.provider_master_id
WHERE ppm.provider_master_id IS NULL
  AND ppm.mapping_status IN ('needs_review', 'pending', 'unknown_type')
  AND ppm.reviewed_at IS NULL
  AND ppm.normalized_name = pa.normalized_alias;

-- ─── 14. MARK placeholder rows ───────────────────────────────────────────────
UPDATE public.payroll_provider_mappings
SET
  is_placeholder  = true,
  mapping_status  = 'placeholder',
  failure_reason  = 'Placeholder import label — not a real provider identity'
WHERE normalized_name IN ('nu dental provider', 'provider nu dental', 'nu dental', 'provider nudental')
  AND reviewed_at IS NULL;
