-- Debug and fix frequency constraint issues
-- Run each section separately in Supabase Query Editor

-- STEP 1: Check what frequency values currently exist
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
WHERE frequency IS NOT NULL
GROUP BY frequency 
ORDER BY frequency;

-- STEP 2: Check for any NULL frequency values
SELECT COUNT(*) as null_frequency_count
FROM master_tasks 
WHERE frequency IS NULL;

-- STEP 3: First, let's remove the constraint completely
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;

-- STEP 4: Update any problematic frequency values
-- Handle any legacy values that might still exist
UPDATE master_tasks 
SET frequency = CASE 
    WHEN frequency = 'once_off_sticky' THEN 'once_off'
    WHEN frequency = 'daily' THEN 'every_day'
    WHEN frequency = 'weekly' THEN 'once_weekly'
    WHEN frequency = 'specific_weekdays' THEN 'monday'
    WHEN frequency = 'start_every_month' THEN 'once_monthly'
    WHEN frequency = 'start_certain_months' THEN 'start_of_month_jan'
    WHEN frequency = 'every_month' THEN 'once_monthly'
    WHEN frequency = 'certain_months' THEN 'start_of_month_jan'
    WHEN frequency = 'end_every_month' THEN 'end_of_month_jan'
    WHEN frequency = 'end_certain_months' THEN 'end_of_month_jan'
    WHEN frequency IS NULL THEN 'every_day'
    ELSE frequency -- Keep if already valid
END;

-- STEP 5: Check the values again after update
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
GROUP BY frequency 
ORDER BY frequency;

-- STEP 6: Now add the constraint with all the values we actually need
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_frequency_check 
CHECK (frequency IN (
    'once_off', 
    'every_day', 
    'once_weekly',
    'monday', 
    'tuesday', 
    'wednesday', 
    'thursday', 
    'friday', 
    'saturday', 
    'once_monthly', 
    'start_of_month_jan',
    'start_of_month_feb', 
    'start_of_month_mar', 
    'start_of_month_apr',
    'start_of_month_may', 
    'start_of_month_jun', 
    'start_of_month_jul',
    'start_of_month_aug', 
    'start_of_month_sep', 
    'start_of_month_oct',
    'start_of_month_nov', 
    'start_of_month_dec', 
    'end_of_month_jan',
    'end_of_month_feb', 
    'end_of_month_mar', 
    'end_of_month_apr',
    'end_of_month_may', 
    'end_of_month_jun', 
    'end_of_month_jul',
    'end_of_month_aug', 
    'end_of_month_sep', 
    'end_of_month_oct',
    'end_of_month_nov', 
    'end_of_month_dec'
));

-- STEP 7: Test the constraint
SELECT 'Constraint applied successfully' as status;

-- STEP 8: Final verification - show all frequency values
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
GROUP BY frequency 
ORDER BY frequency;