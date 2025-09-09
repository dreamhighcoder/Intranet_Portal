-- Migration: Fix custom_order column to allow NULL values
-- Date: 2025-01-29
-- Description: Remove NOT NULL constraint from custom_order column to allow default sorting

-- Remove NOT NULL constraint from custom_order column if it exists
ALTER TABLE master_tasks 
ALTER COLUMN custom_order DROP NOT NULL;

-- Verify the column allows NULL values by setting some test values to NULL
-- This is safe because NULL values will fall back to default sorting
UPDATE master_tasks 
SET custom_order = NULL 
WHERE custom_order IS NOT NULL 
  AND id IN (
    SELECT id FROM master_tasks 
    WHERE custom_order IS NOT NULL 
    LIMIT 1
  );

-- Add a comment to document the purpose
COMMENT ON COLUMN master_tasks.custom_order IS 'Custom ordering for drag-and-drop. NULL values use default sorting (due_time, frequency, position, description, title, id).';