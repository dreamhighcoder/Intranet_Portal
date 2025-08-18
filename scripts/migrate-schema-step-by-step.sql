-- Step-by-step migration script for project specifications
-- Run each section separately in Supabase Query Editor

-- STEP 1: Add new columns without constraints
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS due_time TIME,
ADD COLUMN IF NOT EXISTS publish_delay DATE;

-- STEP 2: Check current frequency values
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
GROUP BY frequency 
ORDER BY frequency;

-- STEP 3: Migrate existing frequency values to new format
-- Update old frequency values to new ones
UPDATE master_tasks 
SET frequency = CASE 
    WHEN frequency = 'once_off_sticky' THEN 'once_off'
    WHEN frequency = 'every_day' THEN 'every_day'
    WHEN frequency = 'weekly' THEN 'once_weekly'
    WHEN frequency = 'specific_weekdays' THEN 'monday' -- Default to monday, will need manual review
    WHEN frequency = 'start_every_month' THEN 'once_monthly'
    WHEN frequency = 'start_certain_months' THEN 'start_of_month_jan' -- Default to January, will need manual review
    WHEN frequency = 'every_month' THEN 'once_monthly'
    WHEN frequency = 'certain_months' THEN 'start_of_month_jan' -- Default to January, will need manual review
    WHEN frequency = 'end_every_month' THEN 'end_of_month_jan' -- Default to January, will need manual review
    WHEN frequency = 'end_certain_months' THEN 'end_of_month_jan' -- Default to January, will need manual review
    ELSE 'every_day' -- Default fallback
END
WHERE frequency IS NOT NULL;

-- STEP 4: Verify frequency migration
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
GROUP BY frequency 
ORDER BY frequency;

-- STEP 5: Now apply the frequency constraint
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

-- STEP 6: Check current timing values
SELECT DISTINCT timing, COUNT(*) as count 
FROM master_tasks 
GROUP BY timing 
ORDER BY timing;

-- STEP 7: Migrate existing timing values to new format
UPDATE master_tasks 
SET timing = CASE 
    WHEN timing = 'morning' THEN 'opening'
    WHEN timing = 'before_close' THEN 'closing'
    WHEN timing = 'custom' THEN 'anytime_during_day'
    WHEN timing IS NULL THEN 'opening'
    ELSE timing -- Keep if already in new format
END;

-- STEP 8: Apply timing constraint
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_timing_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_timing_check 
CHECK (timing IN ('opening', 'anytime_during_day', 'before_order_cut_off', 'closing'));

-- STEP 9: Migrate existing data to new structure
-- Migrate single category to categories array
UPDATE master_tasks 
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}');

-- STEP 10: Set default responsibility based on position_id (best effort migration)
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

-- STEP 11: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility);
CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_master_tasks_due_date ON master_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_delay ON master_tasks(publish_delay);

-- STEP 12: Add comments
COMMENT ON COLUMN master_tasks.responsibility IS 'Multi-select array of responsibilities';
COMMENT ON COLUMN master_tasks.categories IS 'Multi-select array of categories';
COMMENT ON COLUMN master_tasks.timing IS 'Task timing (opening, anytime_during_day, before_order_cut_off, closing)';
COMMENT ON COLUMN master_tasks.due_date IS 'Due date for once-off tasks (auto-calculated for recurring tasks)';
COMMENT ON COLUMN master_tasks.due_time IS 'Due time (auto-filled based on timing or manually set)';
COMMENT ON COLUMN master_tasks.publish_delay IS 'Publishing delay date - tasks remain hidden until this date';

-- STEP 13: Verify final state
SELECT 
    id, title, frequency, timing, responsibility, categories, 
    due_date, due_time, publish_delay, publish_status
FROM master_tasks 
LIMIT 5;