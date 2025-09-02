-- Remove Mock Data Script
-- This removes all the demo/test task instances, keeping only master task templates

-- Remove all mock task instances
DELETE FROM task_instances WHERE id IN (
  SELECT ti.id 
  FROM task_instances ti
  JOIN master_tasks mt ON ti.master_task_id = mt.id
  WHERE mt.title IN (
    'Daily Register Check',
    'Daily Temperature Log', 
    'Weekly Safety Review',
    'Monthly Inventory Count'
  )
);

-- Verify removal
SELECT 
  'After cleanup' as status,
  COUNT(*) as remaining_task_instances
FROM task_instances;

-- Show what master tasks remain (these are your templates)
SELECT 
  'Master tasks (templates)' as type,
  title,
  recurrence_pattern,
  responsibility
FROM master_tasks
ORDER BY title;