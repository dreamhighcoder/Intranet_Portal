-- Migration to support the complete Task Recurrence & Status Engine
-- This migration ensures the database schema supports all the new engine features

-- Update master_tasks table to ensure all required columns exist
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS frequencies TEXT[] DEFAULT '{}';

-- Ensure the frequencies column has proper constraint
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_frequencies_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_frequencies_check 
CHECK (
  frequencies <@ ARRAY[
    'once_off', 'every_day', 'once_weekly', 
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul', 'start_of_month_aug',
    'start_of_month_sep', 'start_of_month_oct', 'start_of_month_nov', 'start_of_month_dec',
    'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul', 'end_of_month_aug',
    'end_of_month_sep', 'end_of_month_oct', 'end_of_month_nov', 'end_of_month_dec'
  ]
);

-- Ensure timing column exists and has proper default
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS timing TEXT DEFAULT 'opening';

-- Update timing constraint to match the new engine
ALTER TABLE master_tasks DROP CONSTRAINT IF EXISTS master_tasks_timing_check;
ALTER TABLE master_tasks ADD CONSTRAINT master_tasks_timing_check 
CHECK (timing IN ('opening', 'anytime_during_day', 'before_order_cut_off', 'closing'));

-- Ensure due_time column exists for default timing
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS due_time TIME;

-- Ensure publish_delay column exists (renamed from publish_delay_date for consistency)
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS publish_delay DATE;

-- Update task_instances table to support the new engine
-- Ensure instance_date column exists (some schemas might have 'date' instead)
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS instance_date DATE;

-- Copy data from 'date' column to 'instance_date' if needed
UPDATE task_instances 
SET instance_date = COALESCE(instance_date, due_date)
WHERE instance_date IS NULL;

-- Make instance_date NOT NULL
ALTER TABLE task_instances 
ALTER COLUMN instance_date SET NOT NULL;

-- Update status constraint to include all new statuses
ALTER TABLE task_instances DROP CONSTRAINT IF EXISTS task_instances_status_check;
ALTER TABLE task_instances ADD CONSTRAINT task_instances_status_check 
CHECK (status IN ('pending', 'in_progress', 'overdue', 'missed', 'done', 'not_due', 'due_today', 'completed'));

-- Ensure locked column exists
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

-- Add columns to track carry instances and original appearance
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS is_carry_instance BOOLEAN DEFAULT FALSE;

ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS original_appearance_date DATE;

-- Add due_date_override and due_time_override columns
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS due_date_override DATE;

ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS due_time_override TIME;

-- Create indexes for the new engine
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequencies ON master_tasks USING GIN(frequencies);
CREATE INDEX IF NOT EXISTS idx_master_tasks_timing ON master_tasks(timing);
CREATE INDEX IF NOT EXISTS idx_master_tasks_due_time ON master_tasks(due_time);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_delay ON master_tasks(publish_delay);

CREATE INDEX IF NOT EXISTS idx_task_instances_instance_date ON task_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_locked ON task_instances(locked);
CREATE INDEX IF NOT EXISTS idx_task_instances_is_carry_instance ON task_instances(is_carry_instance);
CREATE INDEX IF NOT EXISTS idx_task_instances_original_appearance_date ON task_instances(original_appearance_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date_override ON task_instances(due_date_override);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_task_instances_date_status_locked ON task_instances(instance_date, status, locked);
CREATE INDEX IF NOT EXISTS idx_task_instances_master_date ON task_instances(master_task_id, instance_date);

-- Update existing data to use the new frequencies array format
-- Ensure all tasks have at least one frequency (no migration from old frequency column needed)
UPDATE master_tasks 
SET frequencies = ARRAY['every_day']
WHERE frequencies IS NULL OR frequencies = '{}';

-- Update timing values to match new constraint
UPDATE master_tasks 
SET timing = CASE 
  WHEN timing = 'anytime_during_day' THEN 'anytime_during_day'
  WHEN timing = 'specific_time' THEN 'anytime_during_day'
  WHEN timing = 'before_time' THEN 'before_order_cut_off'
  WHEN timing = 'after_time' THEN 'closing'
  ELSE 'opening'
END;

-- Set default due_time based on timing if not already set
UPDATE master_tasks 
SET due_time = CASE 
  WHEN timing = 'opening' THEN '09:30'::TIME
  WHEN timing = 'anytime_during_day' THEN '16:30'::TIME
  WHEN timing = 'before_order_cut_off' THEN '16:55'::TIME
  WHEN timing = 'closing' THEN '17:00'::TIME
  ELSE '09:30'::TIME
END
WHERE due_time IS NULL;

-- Update task instance statuses to match new engine
UPDATE task_instances 
SET status = CASE 
  WHEN status = 'not_due' THEN 'pending'
  WHEN status = 'due_today' THEN 'pending'
  WHEN status = 'completed' THEN 'done'
  ELSE status
END
WHERE status IN ('not_due', 'due_today', 'completed');

-- Create a function to validate frequency arrays
CREATE OR REPLACE FUNCTION validate_frequencies(frequencies TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if array is not empty
  IF frequencies IS NULL OR array_length(frequencies, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if all frequencies are valid
  RETURN frequencies <@ ARRAY[
    'once_off', 'every_day', 'once_weekly', 
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul', 'start_of_month_aug',
    'start_of_month_sep', 'start_of_month_oct', 'start_of_month_nov', 'start_of_month_dec',
    'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul', 'end_of_month_aug',
    'end_of_month_sep', 'end_of_month_oct', 'end_of_month_nov', 'end_of_month_dec'
  ];
END;
$$ LANGUAGE plpgsql;

-- Add a trigger to validate frequencies on insert/update
CREATE OR REPLACE FUNCTION check_frequencies_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_frequencies(NEW.frequencies) THEN
    RAISE EXCEPTION 'Invalid frequencies array: %', NEW.frequencies;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_frequencies_trigger ON master_tasks;
CREATE TRIGGER validate_frequencies_trigger
  BEFORE INSERT OR UPDATE ON master_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_frequencies_trigger();

-- Add comments for documentation
COMMENT ON COLUMN master_tasks.frequencies IS 'Array of frequency types supported by the complete recurrence engine';
COMMENT ON COLUMN master_tasks.timing IS 'Default timing category for due time calculation';
COMMENT ON COLUMN master_tasks.due_time IS 'Default due time based on timing category';
COMMENT ON COLUMN master_tasks.publish_delay IS 'Date before which no instances should be generated';

COMMENT ON COLUMN task_instances.instance_date IS 'Date when this instance appears/is active';
COMMENT ON COLUMN task_instances.locked IS 'Whether this instance is locked and cannot be modified';
COMMENT ON COLUMN task_instances.is_carry_instance IS 'Whether this is a carry-over instance from a previous day';
COMMENT ON COLUMN task_instances.original_appearance_date IS 'Original date when this instance first appeared (for carry instances)';
COMMENT ON COLUMN task_instances.due_date_override IS 'Override for the calculated due date';
COMMENT ON COLUMN task_instances.due_time_override IS 'Override for the calculated due time';

-- Create a view for easy querying of active instances with their master task details
CREATE OR REPLACE VIEW active_task_instances AS
SELECT 
  ti.*,
  mt.title,
  mt.description,
  mt.frequencies,
  mt.timing,
  mt.due_time as master_due_time,
  COALESCE(ti.due_time_override, ti.due_time, mt.due_time) as effective_due_time,
  COALESCE(ti.due_date_override, ti.due_date) as effective_due_date
FROM task_instances ti
JOIN master_tasks mt ON ti.master_task_id = mt.id
WHERE mt.publish_status = 'active'
  AND ti.status != 'done'
  AND NOT ti.locked;

COMMENT ON VIEW active_task_instances IS 'View of active task instances with master task details and effective due dates/times';

-- Insert or update system settings for the new engine
INSERT INTO system_settings (key, value, description) 
VALUES 
  ('recurrence_engine_version', '"2.0"', 'Version of the recurrence engine in use'),
  ('default_business_timezone', '"Australia/Sydney"', 'Default timezone for business operations'),
  ('workday_start_time', '"09:00"', 'Default start time for workdays'),
  ('workday_end_time', '"17:00"', 'Default end time for workdays'),
  ('status_update_enabled', 'true', 'Whether automatic status updates are enabled'),
  ('instance_generation_enabled', 'true', 'Whether automatic instance generation is enabled')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Create a function to get the next business day (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION get_next_business_day(input_date DATE)
RETURNS DATE AS $$
DECLARE
  result_date DATE := input_date + 1;
BEGIN
  WHILE EXTRACT(DOW FROM result_date) IN (0, 6) -- Sunday = 0, Saturday = 6
     OR EXISTS (SELECT 1 FROM public_holidays WHERE date = result_date) LOOP
    result_date := result_date + 1;
  END LOOP;
  
  RETURN result_date;
END;
$$ LANGUAGE plpgsql;

-- Create a function to add business days (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION add_business_days(start_date DATE, days_to_add INTEGER)
RETURNS DATE AS $$
DECLARE
  result_date DATE := start_date;
  days_added INTEGER := 0;
BEGIN
  WHILE days_added < days_to_add LOOP
    result_date := get_next_business_day(result_date);
    days_added := days_added + 1;
  END LOOP;
  
  RETURN result_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_business_day IS 'Returns the next business day after the given date, excluding weekends and public holidays';
COMMENT ON FUNCTION add_business_days IS 'Adds the specified number of business days to a date, excluding weekends and public holidays';

-- Final validation: ensure all master tasks have valid data
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Check for tasks without frequencies
  SELECT COUNT(*) INTO invalid_count
  FROM master_tasks 
  WHERE frequencies IS NULL OR frequencies = '{}';
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % master tasks without frequencies. These will be set to every_day.', invalid_count;
    
    UPDATE master_tasks 
    SET frequencies = ARRAY['every_day']
    WHERE frequencies IS NULL OR frequencies = '{}';
  END IF;
  
  -- Check for tasks without due_time
  SELECT COUNT(*) INTO invalid_count
  FROM master_tasks 
  WHERE due_time IS NULL;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % master tasks without due_time. These will be set based on timing.', invalid_count;
    
    UPDATE master_tasks 
    SET due_time = CASE 
      WHEN timing = 'opening' THEN '09:30'::TIME
      WHEN timing = 'anytime_during_day' THEN '16:30'::TIME
      WHEN timing = 'before_order_cut_off' THEN '16:55'::TIME
      WHEN timing = 'closing' THEN '17:00'::TIME
      ELSE '09:30'::TIME
    END
    WHERE due_time IS NULL;
  END IF;
  
  RAISE NOTICE 'Migration completed successfully. Database is ready for the complete recurrence engine.';
END $$;