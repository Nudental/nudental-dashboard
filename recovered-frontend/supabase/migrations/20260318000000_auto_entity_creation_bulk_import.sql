-- Migration: Auto-Entity Creation Tracking for Bulk Import
-- Tracks providers and categories auto-created during CSV import
-- so Super Admins can review and enrich them later.

CREATE TABLE IF NOT EXISTS public.auto_created_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('provider', 'service_category', 'expense_category')),
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_during_import BOOLEAN DEFAULT true,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  import_batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auto_created_entities_type ON public.auto_created_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_auto_created_entities_reviewed ON public.auto_created_entities(reviewed);
CREATE INDEX IF NOT EXISTS idx_auto_created_entities_entity_id ON public.auto_created_entities(entity_id);

ALTER TABLE public.auto_created_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_auto_created_entities" ON public.auto_created_entities;
CREATE POLICY "super_admin_manage_auto_created_entities"
ON public.auto_created_entities
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'super_admin'
  )
);

-- Allow authenticated users to insert (needed during import)
DROP POLICY IF EXISTS "authenticated_insert_auto_created_entities" ON public.auto_created_entities;
CREATE POLICY "authenticated_insert_auto_created_entities"
ON public.auto_created_entities
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add color column to service_categories if not present
ALTER TABLE public.service_categories
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';

-- Add npi column to providers if not present
ALTER TABLE public.providers
ADD COLUMN IF NOT EXISTS npi TEXT DEFAULT '';
