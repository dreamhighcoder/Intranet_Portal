-- Migration to add missing fields to master_tasks table
-- This adds the fields that the application code expects

-- Add responsibility array field (multi-select responsibilities)
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}';

-- Add categories array field (multi-select categories)
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- Add due_time field (the app expects this instead of default_due_time)
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS due_time TIME;

-- Add frequency_rules JSONB field for complex recurrence patterns
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS frequency_rules JSONB DEFAULT '{}';

-- Add publish_delay field (the app expects this instead of publish_delay_date)
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS publish_delay DATE;

-- Add start_date and end_date fields
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Migrate existing data from old fields to new fields
-- Convert position_id to responsibility array
UPDATE master_tasks 
SET responsibility = ARRAY[
  CASE 
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440001' THEN 'Pharmacist (Primary)'
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440002' THEN 'Pharmacist (Supporting)'
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440003' THEN 'Pharmacy Assistants'
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440004' THEN 'Dispensary Technicians'
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440005' THEN 'DAA Packers'
    WHEN position_id = '550e8400-e29b-41d4-a716-446655440006' THEN 'Operational/Managerial'
    ELSE 'Unknown'
  END
]
WHERE position_id IS NOT NULL;

-- Convert category to categories array
UPDATE master_tasks 
SET categories = ARRAY[category]
WHERE category IS NOT NULL;

-- Copy default_due_time to due_time
UPDATE master_tasks 
SET due_time = default_due_time
WHERE default_due_time IS NOT NULL;

-- Copy publish_delay_date to publish_delay
UPDATE master_tasks 
SET publish_delay = publish_delay_date
WHERE publish_delay_date IS NOT NULL;

-- Set default frequency_rules based on frequency
UPDATE master_tasks 
SET frequency_rules = 
  CASE 
    WHEN frequency = 'every_day' THEN '{"type": "daily", "every_n_days": 1}'::jsonb
    WHEN frequency = 'weekly' THEN '{"type": "weekly", "every_n_weeks": 1}'::jsonb
    WHEN frequency = 'specific_weekdays' THEN 
      ('{"type": "specific_weekdays", "weekdays": ' || COALESCE(weekdays::text, '[1,3,5]') || '}')::jsonb
    WHEN frequency = 'start_every_month' THEN '{"type": "start_of_month", "every_n_months": 1}'::jsonb
    WHEN frequency = 'end_every_month' THEN '{"type": "end_of_month", "every_n_months": 1}'::jsonb
    WHEN frequency = 'once_off_sticky' THEN '{"type": "once_off_sticky"}'::jsonb
    ELSE '{"type": "daily", "every_n_days": 1}'::jsonb
  END
WHERE frequency_rules = '{}' OR frequency_rules IS NULL;

-- Add some default categories for existing tasks that don't have any
UPDATE master_tasks 
SET categories = ARRAY['general']
WHERE categories = '{}' OR categories IS NULL;

-- Add some default responsibilities for tasks that don't have any
UPDATE master_tasks 
SET responsibility = ARRAY['Pharmacist (Primary)']
WHERE responsibility = '{}' OR responsibility IS NULL;