-- ============================================================
-- Fix: Add missing columns to bone_tissue_stock
-- Adds minimum_stock_level and restock_history that are
-- referenced in the application but missing from the table.
-- ============================================================

ALTER TABLE public.bone_tissue_stock
ADD COLUMN IF NOT EXISTS minimum_stock_level INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS restock_history JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS bone_tissue_type TEXT NOT NULL DEFAULT '';
