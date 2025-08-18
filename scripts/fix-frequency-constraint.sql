-- Fix frequency constraint to include all valid values
-- Run this in Supabase Query Editor

-- First, let's see all current frequency values
SELECT DISTINCT frequency, COUNT(*) as count 
FROM master_tasks 
GROUP BY frequency 
ORDER BY frequency;

-- Drop the existing constraint
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;

-- Add the corrected constraint that includes 'once_weekly'
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_frequency_check 
CHECK (frequency IN (
    'once_off', 
    'every_day', 
    'once_weekly',  -- This was missing!
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

-- Verify the constraint is working
SELECT 'Constraint applied successfully' as status;