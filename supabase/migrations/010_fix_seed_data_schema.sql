-- Migration: Fix seed data to use current schema
-- Date: 2024-12-19
-- Description: Updates existing master_tasks to use the current schema with responsibility arrays and frequencies arrays

-- First, ensure all master_tasks have proper responsibility arrays
UPDATE master_tasks 
SET responsibility = CASE 
  WHEN title = 'Daily Register Check' THEN ARRAY['pharmacist-primary']
  WHEN title = 'Daily Temperature Log' THEN ARRAY['pharmacist-primary']
  WHEN title = 'Weekly Safety Review' THEN ARRAY['pharmacist-primary']
  WHEN title = 'Monthly Inventory Count' THEN ARRAY['dispensary-technicians']
  WHEN title = 'Annual CPR Training' THEN ARRAY['pharmacist-primary']
  WHEN title = 'Delivery Schedule Check' THEN ARRAY['operational-managerial']
  WHEN title = 'Monthly P&L Review' THEN ARRAY['operational-managerial']
  ELSE responsibility
END
WHERE responsibility IS NULL OR responsibility = '{}';

-- Ensure all master_tasks have proper frequencies arrays
UPDATE master_tasks 
SET frequencies = CASE 
  WHEN title = 'Daily Register Check' THEN ARRAY['every_day']
  WHEN title = 'Daily Temperature Log' THEN ARRAY['every_day']
  WHEN title = 'Weekly Safety Review' THEN ARRAY['weekly']
  WHEN title = 'Monthly Inventory Count' THEN ARRAY['start_every_month']
  WHEN title = 'Annual CPR Training' THEN ARRAY['once_off_sticky']
  WHEN title = 'Delivery Schedule Check' THEN ARRAY['specific_weekdays']
  WHEN title = 'Monthly P&L Review' THEN ARRAY['end_every_month']
  ELSE frequencies
END
WHERE frequencies IS NULL OR frequencies = '{}';

-- Ensure all master_tasks have proper categories arrays
UPDATE master_tasks 
SET categories = CASE 
  WHEN title = 'Daily Register Check' THEN ARRAY['compliance']
  WHEN title = 'Daily Temperature Log' THEN ARRAY['pharmacy-services']
  WHEN title = 'Weekly Safety Review' THEN ARRAY['compliance']
  WHEN title = 'Monthly Inventory Count' THEN ARRAY['stock-control']
  WHEN title = 'Annual CPR Training' THEN ARRAY['compliance']
  WHEN title = 'Delivery Schedule Check' THEN ARRAY['business-management']
  WHEN title = 'Monthly P&L Review' THEN ARRAY['business-management']
  ELSE categories
END
WHERE categories IS NULL OR categories = '{}';

-- Ensure proper due_time values
UPDATE master_tasks 
SET due_time = CASE 
  WHEN title = 'Daily Register Check' THEN '09:00:00'::time
  WHEN title = 'Daily Temperature Log' THEN '08:30:00'::time
  WHEN title = 'Weekly Safety Review' THEN '09:30:00'::time
  WHEN title = 'Monthly Inventory Count' THEN '08:00:00'::time
  WHEN title = 'Annual CPR Training' THEN '17:00:00'::time
  WHEN title = 'Delivery Schedule Check' THEN '08:15:00'::time
  WHEN title = 'Monthly P&L Review' THEN '16:00:00'::time
  ELSE due_time
END
WHERE due_time IS NULL;

-- Ensure proper timing values
UPDATE master_tasks 
SET timing = CASE 
  WHEN title = 'Daily Register Check' THEN 'opening'
  WHEN title = 'Daily Temperature Log' THEN 'opening'
  WHEN title = 'Weekly Safety Review' THEN 'opening'
  WHEN title = 'Monthly Inventory Count' THEN 'opening'
  WHEN title = 'Annual CPR Training' THEN 'anytime_during_day'
  WHEN title = 'Delivery Schedule Check' THEN 'opening'
  WHEN title = 'Monthly P&L Review' THEN 'closing'
  ELSE timing
END
WHERE timing IS NULL OR timing = '';

-- Set weekdays for specific_weekdays tasks
UPDATE master_tasks 
SET weekdays = ARRAY[1, 3, 5] -- Monday, Wednesday, Friday
WHERE title = 'Delivery Schedule Check' AND 'specific_weekdays' = ANY(frequencies);

-- Ensure all tasks are published
UPDATE master_tasks 
SET publish_status = 'active'
WHERE publish_status IS NULL OR publish_status = '';

-- Log the migration results
DO $$
DECLARE
  updated_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Count updated tasks
  SELECT COUNT(*) INTO updated_count
  FROM master_tasks 
  WHERE responsibility IS NOT NULL AND responsibility != '{}' 
    AND frequencies IS NOT NULL AND frequencies != '{}'
    AND categories IS NOT NULL AND categories != '{}';
  
  SELECT COUNT(*) INTO total_count
  FROM master_tasks;
  
  RAISE NOTICE 'Schema fix completed: % out of % tasks now have proper arrays', updated_count, total_count;
  
  -- Show sample of fixed data
  RAISE NOTICE 'Sample fixed tasks:';
  FOR rec IN 
    SELECT title, responsibility, frequencies, categories, due_time
    FROM master_tasks 
    WHERE responsibility IS NOT NULL AND responsibility != '{}'
    LIMIT 5
  LOOP
    RAISE NOTICE '  Task: % | Responsibility: % | Frequencies: % | Categories: % | Due Time: %', 
      rec.title, rec.responsibility, rec.frequencies, rec.categories, rec.due_time;
  END LOOP;
END $$;