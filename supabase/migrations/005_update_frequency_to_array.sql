-- Migration to update master_tasks table to support multiple frequencies
-- This migration changes frequency from single string to array of strings

-- First, add the new frequencies column as an array
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS frequencies TEXT[] DEFAULT '{}';

-- Update the frequency constraint to include the new options
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;
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

-- Migrate existing single frequency values to the new frequencies array
UPDATE master_tasks 
SET frequencies = ARRAY[frequency]
WHERE frequency IS NOT NULL AND (frequencies IS NULL OR frequencies = '{}');

-- Create index for the new frequencies column
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequencies ON master_tasks USING GIN(frequencies);

-- Add comment to the new column
COMMENT ON COLUMN master_tasks.frequencies IS 'Multi-select array of frequencies - supports multiple recurrence patterns for a single task';

-- Note: We keep the old frequency column for backward compatibility during transition
-- It can be removed in a future migration once all code is updated