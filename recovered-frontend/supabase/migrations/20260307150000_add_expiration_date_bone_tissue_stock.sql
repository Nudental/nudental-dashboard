-- ============================================================
-- Fix: Add missing expiration_date column to bone_tissue_stock
-- The unifiedInventoryService and boneTissueService query this
-- column but it was not included in the original table schema.
-- ============================================================

ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS expiration_date DATE;
