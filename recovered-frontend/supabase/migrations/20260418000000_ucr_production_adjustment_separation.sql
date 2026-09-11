-- Migration: UCR Fee and Production Adjustment Separation
-- Timestamp: 20260418000000
-- Purpose: Enforce strict separation of UCR fee (gross billed) and production adjustments
--          as distinct, traceable fields in monthly_executive_analytics.
--
-- BUSINESS RULES ENFORCED:
--   UCR Fee (ucr_fee_amount)         = full usual/customary billed fee before any reductions
--   Production Adjustments (production_adjustment_amount) = reductions applied against production
--   Net Production (net_production)  = UCR Fee minus Production Adjustments
--   Collections (collections_total)  = actual money collected — always separate
--
-- FORMULA: net_production = ucr_fee_amount + production_adjustment_amount
--          (adjustments are stored as negative values, so addition gives net)
--
-- NOTE: production_total is retained as the legacy gross/UCR field for backward compatibility.
--       New code should use ucr_fee_amount for UCR and net_production for net.

-- ─── Add explicit UCR fee field ───────────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS ucr_fee_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.ucr_fee_amount IS
  'UCR / Gross Billed Fee: full usual/customary fee schedule amount before any contractual or other reductions. Source: Dentrix Ascend grossProduction field. NEVER merge with adjustments.';

-- ─── Add explicit production adjustment field ─────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS production_adjustment_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.production_adjustment_amount IS
  'Total Production Adjustments: all reductions applied against production including contractual adjustments, PPO write-offs, insurance-related reductions, discounts, and other adjustment types. Stored as negative values. Source: Dentrix Ascend adjustments field. NEVER merge with UCR fee.';

-- ─── Add explicit net production field ───────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS net_production NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.net_production IS
  'Net Production: UCR Fee minus Production Adjustments. Formula: ucr_fee_amount + production_adjustment_amount (adjustments are negative). This is what the practice actually earned after contractual reductions. Source: Dentrix Ascend netProduction field.';

-- ─── Add write-offs sub-type field ───────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS write_offs NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.write_offs IS
  'PPO / Contractual Write-Offs: insurance discount amounts that reduce gross to net production. Stored as negative values. Sub-type of production_adjustment_amount.';

-- ─── Add charge adjustments sub-type field ───────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS charge_adjustments NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.charge_adjustments IS
  'Charge Adjustments: manual fee corrections applied to procedures. Can be positive or negative. Sub-type of production_adjustment_amount.';

-- ─── Add credit adjustments sub-type field ───────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS credit_adjustments NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.credit_adjustments IS
  'Credit / Refund Adjustments: credits and refunds applied to patient accounts. Typically positive. Sub-type of production_adjustment_amount.';

-- ─── Add insurance adjustments sub-type field ────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS insurance_adjustments NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.insurance_adjustments IS
  'Insurance Payment Adjustments: adjustments related to insurance payment processing. Sub-type of production_adjustment_amount.';

-- ─── Add discounts sub-type field ────────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS discounts NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.discounts IS
  'Discount Plan Adjustments: reductions from discount plans, courtesy adjustments, and similar. Stored as negative values. Sub-type of production_adjustment_amount.';

-- ─── Add reversals sub-type field ────────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS reversals NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.monthly_executive_analytics.reversals IS
  'Reversal / Void Adjustments: adjustments that reverse or void prior transactions. Sub-type of production_adjustment_amount.';

-- ─── Add data source tracking fields ─────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS ucr_data_source TEXT DEFAULT 'api';

COMMENT ON COLUMN public.monthly_executive_analytics.ucr_data_source IS
  'Source of UCR fee data: ''api'' = imported from Dentrix Ascend, ''manual'' = entered manually by authorized user, ''calculated'' = derived from other fields.';

ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS adjustment_data_source TEXT DEFAULT 'api';

COMMENT ON COLUMN public.monthly_executive_analytics.adjustment_data_source IS
  'Source of adjustment data: ''api'' = imported from Dentrix Ascend, ''manual'' = entered manually by authorized user, ''calculated'' = derived from other fields.';

-- ─── Add manual entry audit fields ───────────────────────────────────────────
ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS manual_ucr_entered_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS manual_ucr_entered_at TIMESTAMPTZ;

ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS manual_adjustment_entered_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.monthly_executive_analytics
  ADD COLUMN IF NOT EXISTS manual_adjustment_entered_at TIMESTAMPTZ;

-- ─── Backfill: populate ucr_fee_amount from production_total ─────────────────
-- production_total was storing grossProduction from Dentrix Ascend API
-- Backfill ucr_fee_amount from production_total where ucr_fee_amount is 0
UPDATE public.monthly_executive_analytics
SET ucr_fee_amount = production_total
WHERE ucr_fee_amount = 0 AND production_total > 0;

-- ─── Backfill: populate production_adjustment_amount from adjustments_net ─────
-- adjustments_net was the combined adjustment total
-- Backfill production_adjustment_amount from adjustments_net where it is 0
UPDATE public.monthly_executive_analytics
SET production_adjustment_amount = adjustments_net
WHERE production_adjustment_amount = 0 AND adjustments_net != 0;

-- ─── Backfill: populate net_production ───────────────────────────────────────
-- net_production = ucr_fee_amount + production_adjustment_amount (adjustments are negative)
UPDATE public.monthly_executive_analytics
SET net_production = ucr_fee_amount + production_adjustment_amount
WHERE net_production = 0 AND ucr_fee_amount > 0;

-- ─── Backfill: populate write_offs from writeoffs_total ──────────────────────
UPDATE public.monthly_executive_analytics
SET write_offs = CASE WHEN writeoffs_total > 0 THEN -writeoffs_total ELSE writeoffs_total END
WHERE write_offs = 0 AND writeoffs_total != 0;

-- ─── Create manual_production_entries table for missing API data ──────────────
-- This table stores manually entered UCR fee and adjustment data for periods
-- where Dentrix Ascend API does not provide the data directly.
CREATE TABLE IF NOT EXISTS public.manual_production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL,
  report_month INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  report_year INTEGER NOT NULL CHECK (report_year >= 2020),
  -- UCR / Gross Production (manually entered)
  ucr_fee_amount NUMERIC DEFAULT 0,
  -- Production Adjustments (manually entered, stored as negative)
  production_adjustment_amount NUMERIC DEFAULT 0,
  -- Net Production (calculated: ucr_fee_amount + production_adjustment_amount)
  net_production NUMERIC GENERATED ALWAYS AS (ucr_fee_amount + production_adjustment_amount) STORED,
  -- Adjustment sub-types (optional breakdown)
  write_offs NUMERIC DEFAULT 0,
  charge_adjustments NUMERIC DEFAULT 0,
  credit_adjustments NUMERIC DEFAULT 0,
  insurance_adjustments NUMERIC DEFAULT 0,
  discounts NUMERIC DEFAULT 0,
  reversals NUMERIC DEFAULT 0,
  -- Provider context (optional)
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_name TEXT,
  -- Entry metadata
  entry_type TEXT NOT NULL DEFAULT 'ucr_and_adjustments' CHECK (entry_type IN ('ucr_only', 'adjustments_only', 'ucr_and_adjustments')),
  notes TEXT,
  -- Audit trail
  entered_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  last_edited_at TIMESTAMPTZ,
  -- Version history (JSON array of prior values)
  edit_history JSONB DEFAULT '[]'::jsonb,
  -- Integration flags
  is_applied_to_analytics BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- Prevent duplicate entries per office/month/year/provider
  UNIQUE (office_id, report_month, report_year, provider_id)
);

COMMENT ON TABLE public.manual_production_entries IS
  'Manual entry table for UCR fee and production adjustment data when Dentrix Ascend API does not provide these values directly. All entries are office-specific, date-specific, and provider-aware. Entries are labeled as manual and never overwrite imported API data silently.';

-- Indexes for manual_production_entries
CREATE INDEX IF NOT EXISTS idx_mpe_office_month_year ON public.manual_production_entries(office_id, report_month, report_year);
CREATE INDEX IF NOT EXISTS idx_mpe_entered_by ON public.manual_production_entries(entered_by);
CREATE INDEX IF NOT EXISTS idx_mpe_provider ON public.manual_production_entries(provider_id);

-- Enable RLS on manual_production_entries
ALTER TABLE public.manual_production_entries ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins and super_admins can insert/update/delete manual entries
DROP POLICY IF EXISTS "mpe_select" ON public.manual_production_entries;
CREATE POLICY "mpe_select"
  ON public.manual_production_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role::text IN ('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager', 'office_manager')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "mpe_insert" ON public.manual_production_entries;
CREATE POLICY "mpe_insert"
  ON public.manual_production_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role::text IN ('super_admin', 'admin', 'regional_manager')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "mpe_update" ON public.manual_production_entries;
CREATE POLICY "mpe_update"
  ON public.manual_production_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role::text IN ('super_admin', 'admin', 'regional_manager')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role::text IN ('super_admin', 'admin', 'regional_manager')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "mpe_delete" ON public.manual_production_entries;
CREATE POLICY "mpe_delete"
  ON public.manual_production_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role::text IN ('super_admin', 'admin')
        AND is_active = true
    )
  );

-- ─── Indexes for new monthly_executive_analytics columns ─────────────────────
CREATE INDEX IF NOT EXISTS idx_mea_ucr_fee ON public.monthly_executive_analytics(ucr_fee_amount);
CREATE INDEX IF NOT EXISTS idx_mea_net_production ON public.monthly_executive_analytics(net_production);
CREATE INDEX IF NOT EXISTS idx_mea_ucr_data_source ON public.monthly_executive_analytics(ucr_data_source);
