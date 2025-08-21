-- Fix Schema Migration for Task Creation Error
-- This script adds the missing responsibility and categories array fields
-- Run this in Supabase SQL Editor to fix the "Could not find a relationship" error

-- Step 1: Add missing array columns to master_tasks table
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS due_time TIME,
ADD COLUMN IF NOT EXISTS publish_delay DATE;

-- Step 2: Create indexes for performance on new array columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility);
CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories);

-- Step 3: Migrate existing data from old schema to new schema
-- Convert single category to categories array
UPDATE master_tasks 
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}');

-- Convert position_id to responsibility array (best effort migration)
UPDATE master_tasks 
SET responsibility = CASE 
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440001' THEN ARRAY['pharmacist-primary']
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440002' THEN ARRAY['pharmacist-supporting']
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440003' THEN ARRAY['pharmacy-assistants']
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440004' THEN ARRAY['dispensary-technicians']
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440005' THEN ARRAY['daa-packers']
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440006' THEN ARRAY['operational-managerial']
    ELSE ARRAY['pharmacy-assistants'] -- Default fallback
END
WHERE responsibility IS NULL OR responsibility = '{}';

-- Step 4: Update constraints to match project specifications
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_timing_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_timing_check 
CHECK (timing IN ('opening', 'anytime_during_day', 'before_order_cut_off', 'closing'));

-- Step 5: Add helpful comments
COMMENT ON COLUMN master_tasks.responsibility IS 'Multi-select array of responsibilities (pharmacist-primary, pharmacy-assistants, etc.)';
COMMENT ON COLUMN master_tasks.categories IS 'Multi-select array of categories (stock-control, compliance, etc.)';
COMMENT ON COLUMN master_tasks.due_time IS 'Due time (auto-filled based on timing or manually set)';
COMMENT ON COLUMN master_tasks.publish_delay IS 'Publishing delay date - tasks remain hidden until this date';

-- Step 6: Verify the migration worked
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'master_tasks' 
    AND column_name IN ('responsibility', 'categories', 'due_time', 'publish_delay')
ORDER BY column_name;

-- Show sample of migrated data
SELECT 
    id,
    title,
    responsibility,
    categories,
    position_id,
    category
FROM master_tasks 
LIMIT 5;