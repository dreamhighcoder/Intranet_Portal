-- Manual schema update script for project specifications
-- Run this in Supabase Query Editor

-- Add new columns to master_tasks table
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS due_time TIME,
ADD COLUMN IF NOT EXISTS publish_delay DATE;

-- Update frequency constraint to match specifications
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_frequency_check 
CHECK (frequency IN (
    'once_off', 'every_day', 'once_weekly', 'monday', 'tuesday', 'wednesday', 
    'thursday', 'friday', 'saturday', 'once_monthly', 'start_of_month_jan',
    'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul',
    'start_of_month_aug', 'start_of_month_sep', 'start_of_month_oct',
    'start_of_month_nov', 'start_of_month_dec', 'end_of_month_jan',
    'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul',
    'end_of_month_aug', 'end_of_month_sep', 'end_of_month_oct',
    'end_of_month_nov', 'end_of_month_dec'
));

-- Update timing constraint to match specifications
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_timing_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_timing_check 
CHECK (timing IN ('opening', 'anytime_during_day', 'before_order_cut_off', 'closing'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility);
CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_master_tasks_due_date ON master_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_delay ON master_tasks(publish_delay);

-- Migrate existing data to new structure
-- Migrate single category to categories array
UPDATE master_tasks 
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}');

-- Set default timing for existing records
UPDATE master_tasks 
SET timing = 'opening'
WHERE timing IS NULL;

-- Set default responsibility based on position_id (best effort migration)
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

-- Add comments
COMMENT ON COLUMN master_tasks.responsibility IS 'Multi-select array of responsibilities';
COMMENT ON COLUMN master_tasks.categories IS 'Multi-select array of categories';
COMMENT ON COLUMN master_tasks.timing IS 'Task timing (opening, anytime_during_day, before_order_cut_off, closing)';
COMMENT ON COLUMN master_tasks.due_date IS 'Due date for once-off tasks (auto-calculated for recurring tasks)';
COMMENT ON COLUMN master_tasks.due_time IS 'Due time (auto-filled based on timing or manually set)';
COMMENT ON COLUMN master_tasks.publish_delay IS 'Publishing delay date - tasks remain hidden until this date';