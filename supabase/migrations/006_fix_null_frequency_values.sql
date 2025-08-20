-- Migration to fix null frequency values in master_tasks table
-- This addresses the runtime error where formatFrequency receives null values

-- Update any null frequency values to a default value
UPDATE master_tasks 
SET frequency = 'every_day'
WHERE frequency IS NULL;

-- Ensure the NOT NULL constraint is properly enforced
-- First drop the existing constraint if it exists
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;

-- Add the constraint back with the updated frequency options and NOT NULL enforcement
ALTER TABLE master_tasks 
ALTER COLUMN frequency SET NOT NULL;

-- Re-add the frequency constraint with all valid options
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_frequency_check 
CHECK (frequency IN (
    'once_off', 'every_day', 'once_weekly', 'monday', 'tuesday', 'wednesday', 
    'thursday', 'friday', 'saturday', 'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul',
    'start_of_month_aug', 'start_of_month_sep', 'start_of_month_oct',
    'start_of_month_nov', 'start_of_month_dec', 'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar',
    'end_of_month_apr', 'end_of_month_may', 'end_of_month_jun',
    'end_of_month_jul', 'end_of_month_aug', 'end_of_month_sep',
    'end_of_month_oct', 'end_of_month_nov', 'end_of_month_dec'
));

-- Also ensure that any records with empty frequencies array get populated from frequency
UPDATE master_tasks 
SET frequencies = ARRAY[frequency]
WHERE (frequencies IS NULL OR frequencies = '{}') AND frequency IS NOT NULL;

-- Add comment explaining the fix
COMMENT ON COLUMN master_tasks.frequency IS 'Legacy frequency field - kept for backward compatibility. Use frequencies array for new implementations.';