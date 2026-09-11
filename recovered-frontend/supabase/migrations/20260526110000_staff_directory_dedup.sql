-- ============================================================
-- Phase 2A Dedup Fix: staff_directory duplicate row removal
-- Migration: 20260526110000_staff_directory_dedup.sql
--
-- Root cause: 20260526100000_staff_directory_phase2a.sql was applied
-- twice. Each run used gen_random_uuid() for the PK, so
-- ON CONFLICT (id) DO NOTHING never fired, resulting in 60 rows
-- instead of 30.
--
-- Fix: Delete duplicate rows, keeping the earliest-inserted row
-- per (full_name, office_location_normalized). Then add a unique
-- constraint so future re-runs cannot re-introduce duplicates.
--
-- SAFETY: Only modifies public.staff_directory.
-- No other tables are touched.
-- ============================================================

-- Step 1: Delete duplicate rows, keeping the one with the smallest
-- created_at (earliest insert) per (full_name, office_location_normalized).
-- If created_at is identical, keep the smallest id (deterministic tiebreak).
DELETE FROM public.staff_directory
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY full_name, office_location_normalized
                ORDER BY created_at ASC, id ASC
            ) AS rn
        FROM public.staff_directory
    ) ranked
    WHERE rn > 1
);

-- Step 2: Add a unique constraint so this cannot happen again.
-- If the constraint already exists (idempotent), skip gracefully.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_staff_directory_name_location'
          AND conrelid = 'public.staff_directory'::regclass
    ) THEN
        ALTER TABLE public.staff_directory
            ADD CONSTRAINT uq_staff_directory_name_location
            UNIQUE (full_name, office_location_normalized);
    END IF;
END $$;

-- ============================================================
-- SAFETY CONFIRMATION COMMENT
-- Only public.staff_directory was modified (duplicate rows deleted,
-- unique constraint added).
-- Tables NOT touched: providers, provider_master, user_profiles,
--   offices, payroll_*, gusto_employees, front_desk_inventory,
--   front_desk_amazon_orders, daily_entries, or any other table.
-- Expected result after migration:
--   Total rows: 30
--   Total Staff = 30, Locations = 6, Providers = 13,
--   Management/Admin = 4, Contractors = 1
-- ============================================================
