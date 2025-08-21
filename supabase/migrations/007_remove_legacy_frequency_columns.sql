-- Migration to remove legacy frequency columns from master_tasks table
-- This migration removes the old frequency and frequency_rules columns
-- since the system now uses the frequencies array column

-- Remove the old frequency column constraint first
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequency_check;

-- Remove the old frequency column
ALTER TABLE master_tasks DROP COLUMN IF EXISTS frequency;

-- Remove the old frequency_rules column
ALTER TABLE master_tasks DROP COLUMN IF EXISTS frequency_rules;

-- Remove any indexes on the old columns
DROP INDEX IF EXISTS idx_master_tasks_frequency;

-- Add a comment to document the change
COMMENT ON COLUMN master_tasks.frequencies IS 'Multi-select array of frequencies - supports multiple recurrence patterns for a single task. Replaces the legacy frequency and frequency_rules columns.';

-- Ensure the frequencies column has proper constraints
ALTER TABLE master_tasks 
ADD CONSTRAINT master_tasks_frequencies_not_empty 
CHECK (frequencies IS NOT NULL AND array_length(frequencies, 1) > 0);

-- Add a constraint to ensure valid frequency values
ALTER TABLE master_tasks 
ADD CONSTRAINT master_tasks_frequencies_valid_values 
CHECK (
  frequencies <@ ARRAY[
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
  ]::text[]
);