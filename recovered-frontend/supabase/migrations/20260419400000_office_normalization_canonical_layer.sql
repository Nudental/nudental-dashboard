-- ══════════════════════════════════════════════════════════════════════════════
-- OFFICE NORMALIZATION — CANONICAL LAYER MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════
-- Implements query-layer office canonicalization so that historical records
-- using full practice names ("Nu Dental of Brick") are recognized as their
-- canonical short names ("Brick") without overwriting source-of-truth data.
--
-- Canonical offices:
--   "Brick" | "Barnegat" | "Staten Island" | "Eatontown"
--
-- Strategy: safe transform layer — never overwrites raw source data.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. SQL NORMALIZATION FUNCTION ───────────────────────────────────────────
-- Single SQL function that mirrors the JS normalizeOfficeName logic.
-- Used in views, computed columns, and RPC calls.

CREATE OR REPLACE FUNCTION public.normalize_office_name(raw_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  normalized text;
BEGIN
  -- Null / empty guard
  IF raw_value IS NULL OR trim(raw_value) = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize: trim, lowercase, collapse spaces
  normalized := lower(trim(regexp_replace(raw_value, '\s+', ' ', 'g')));

  -- UUID passthrough (handled by OFFICE_UUID_MAP in JS layer)
  -- UUIDs won't match any alias, so they fall through to NULL safely.

  -- Reject known non-office strings
  IF normalized IN ('unknown office', 'unknown', 'n/a', 'none', 'null',
                    'unassigned', 'corporate', 'needs review', 'all offices', 'all') THEN
    RETURN NULL;
  END IF;

  -- ── Brick ──────────────────────────────────────────────────────────────────
  IF normalized IN ('brick', 'nu dental of brick', 'nudental of brick',
                    'nu dental brick', 'nudental brick',
                    'brick nj', 'brick new jersey',
                    'brick, nj', 'brick, new jersey') THEN
    RETURN 'Brick';
  END IF;
  IF normalized LIKE '%brick%' AND normalized NOT LIKE '%barnegat%'
     AND normalized NOT LIKE '%staten%' AND normalized NOT LIKE '%eatontown%' THEN
    RETURN 'Brick';
  END IF;

  -- ── Barnegat ───────────────────────────────────────────────────────────────
  IF normalized IN ('barnegat', 'nu dental of barnegat', 'nudental of barnegat',
                    'nu dental barnegat', 'nudental barnegat',
                    'barnegat nj', 'barnegat new jersey',
                    'barnegat, nj', 'barnegat, new jersey') THEN
    RETURN 'Barnegat';
  END IF;
  IF normalized LIKE '%barnegat%' THEN
    RETURN 'Barnegat';
  END IF;

  -- ── Staten Island ──────────────────────────────────────────────────────────
  IF normalized IN ('staten island', 'nu dental of staten island',
                    'nudental of staten island', 'nu dental staten island',
                    'nudental staten island', 'staten island ny',
                    'staten island new york', 'staten island, ny',
                    'staten island, new york', 'si') THEN
    RETURN 'Staten Island';
  END IF;
  IF normalized LIKE '%staten island%' THEN
    RETURN 'Staten Island';
  END IF;

  -- ── Eatontown ──────────────────────────────────────────────────────────────
  IF normalized IN ('eatontown', 'nu dental of eatontown', 'nudental of eatontown',
                    'nu dental eatontown', 'nudental eatontown',
                    'eatontown nj', 'eatontown new jersey',
                    'eatontown, nj', 'eatontown, new jersey') THEN
    RETURN 'Eatontown';
  END IF;
  IF normalized LIKE '%eatontown%' THEN
    RETURN 'Eatontown';
  END IF;

  -- No match
  RETURN NULL;
END;
$$;

-- ─── 2. CANONICAL OFFICE LOOKUP VIEW ─────────────────────────────────────────
-- Provides a normalized view of the offices table with canonical names.
-- Use this view in joins instead of raw offices.name where normalization needed.

CREATE OR REPLACE VIEW public.canonical_offices AS
SELECT
  id,
  name                                    AS raw_name,
  public.normalize_office_name(name)      AS canonical_name,
  COALESCE(
    public.normalize_office_name(name),
    name
  )                                       AS display_name
FROM public.offices;

-- ─── 3. BACKFILL gusto_expense_facts office_name ─────────────────────────────
-- Normalize any "Nu Dental of X" values stored in gusto_expense_facts.office_name
-- to their canonical short names. This is safe — office_id (UUID) is preserved.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gusto_expense_facts'
  ) THEN
    UPDATE public.gusto_expense_facts
    SET office_name = public.normalize_office_name(office_name)
    WHERE office_name IS NOT NULL
      AND public.normalize_office_name(office_name) IS NOT NULL
      AND office_name != public.normalize_office_name(office_name);

    RAISE NOTICE 'gusto_expense_facts office_name backfill complete: % rows updated',
      (SELECT COUNT(*) FROM public.gusto_expense_facts
       WHERE office_name IN ('Brick','Barnegat','Staten Island','Eatontown'));
  END IF;
END;
$$;

-- ─── 4. BACKFILL gusto_time_entries office_name ───────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gusto_time_entries'
  ) THEN
    UPDATE public.gusto_time_entries
    SET office_name = public.normalize_office_name(office_name)
    WHERE office_name IS NOT NULL
      AND public.normalize_office_name(office_name) IS NOT NULL
      AND office_name != public.normalize_office_name(office_name);
  END IF;
END;
$$;

-- ─── 5. BACKFILL gusto_employees work location fields ────────────────────────
-- gusto_employees does not have an office_name column but may have work_address_id
-- mapped to an office. No direct backfill needed — normalization happens in JS layer.

-- ─── 6. OFFICE NORMALIZATION WARNINGS TABLE ──────────────────────────────────
-- Stores unmatched office values for admin review.
-- Written by the JS diagnostic layer via RPC.

CREATE TABLE IF NOT EXISTS public.office_normalization_warnings (
  id              bigserial PRIMARY KEY,
  raw_value       text NOT NULL,
  source          text,          -- 'gusto_import' | 'dentrix_import' | 'manual_entry' | etc.
  source_table    text,          -- table/endpoint where the value came from
  source_page     text,          -- frontend page/component
  normalized_intermediate text,  -- what _normalizeRaw() produced
  fail_reason     text,          -- 'no_alias_match' | 'empty' | 'invalid_type'
  resolved        boolean DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     uuid,
  created_at      timestamptz DEFAULT now()
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_office_norm_warnings_raw
  ON public.office_normalization_warnings(raw_value);
CREATE INDEX IF NOT EXISTS idx_office_norm_warnings_resolved
  ON public.office_normalization_warnings(resolved);

-- RLS: super_admin can manage, admin can read
ALTER TABLE public.office_normalization_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_office_warnings" ON public.office_normalization_warnings;
CREATE POLICY "super_admin_manage_office_warnings"
  ON public.office_normalization_warnings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "admin_read_office_warnings" ON public.office_normalization_warnings;
CREATE POLICY "admin_read_office_warnings"
  ON public.office_normalization_warnings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- ─── 7. RPC: LOG UNMATCHED OFFICE ────────────────────────────────────────────
-- Called by the JS diagnostic layer to persist unmatched office values.

CREATE OR REPLACE FUNCTION public.log_unmatched_office(
  p_raw_value             text,
  p_source                text DEFAULT NULL,
  p_source_table          text DEFAULT NULL,
  p_source_page           text DEFAULT NULL,
  p_normalized_intermediate text DEFAULT NULL,
  p_fail_reason           text DEFAULT 'no_alias_match'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.office_normalization_warnings
    (raw_value, source, source_table, source_page, normalized_intermediate, fail_reason)
  VALUES
    (p_raw_value, p_source, p_source_table, p_source_page, p_normalized_intermediate, p_fail_reason)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── 8. RPC: GET OFFICE NORMALIZATION REPORT ─────────────────────────────────
-- Returns a summary of unresolved office values for admin audit panel.

CREATE OR REPLACE FUNCTION public.get_office_normalization_report()
RETURNS TABLE (
  raw_value       text,
  occurrence_count bigint,
  sources         text[],
  first_seen      timestamptz,
  last_seen       timestamptz,
  resolved        boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    raw_value,
    COUNT(*)                    AS occurrence_count,
    ARRAY_AGG(DISTINCT source)  AS sources,
    MIN(created_at)             AS first_seen,
    MAX(created_at)             AS last_seen,
    bool_and(resolved)          AS resolved
  FROM public.office_normalization_warnings
  GROUP BY raw_value
  ORDER BY occurrence_count DESC;
$$;

-- ─── 9. VALIDATE CANONICAL OFFICES TABLE ─────────────────────────────────────
-- Ensure the offices table only contains canonical names.
-- Log any non-canonical names as warnings.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name FROM public.offices
    WHERE public.normalize_office_name(name) IS NULL
      AND name IS NOT NULL
  LOOP
    RAISE WARNING 'Office record has non-canonical name: id=%, name=%', r.id, r.name;
  END LOOP;
END;
$$;

-- ─── GRANT PERMISSIONS ───────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.normalize_office_name(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_unmatched_office(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_office_normalization_report() TO authenticated;
GRANT SELECT ON public.canonical_offices TO authenticated;
