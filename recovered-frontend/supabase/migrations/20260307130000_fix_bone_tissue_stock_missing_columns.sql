-- ============================================================
-- Fix: Safely add missing columns to bone_tissue_stock
-- minimum_stock_level and bone_tissue_type are referenced in
-- the application but may be missing from the table.
-- restock_history already exists in the original migration.
-- ============================================================

ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS minimum_stock_level INTEGER NOT NULL DEFAULT 2;

ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS bone_tissue_type TEXT NOT NULL DEFAULT '';

ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS restock_history JSONB DEFAULT '[]'::JSONB;
