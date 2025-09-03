-- Migration: Add custom_order to master_tasks for drag-and-drop ordering
-- Date: 2025-01-29

-- 1) Add custom_order column to master_tasks table
ALTER TABLE master_tasks
ADD COLUMN IF NOT EXISTS custom_order integer;

-- 2) Create index for faster ordering
CREATE INDEX IF NOT EXISTS idx_master_tasks_custom_order
ON master_tasks(custom_order);

-- 3) Add API endpoint support for updating custom_order
-- This will be handled in the API routes