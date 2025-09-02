-- Simple Mock Data Cleanup
-- Run this in Supabase Dashboard > SQL Editor

-- Remove all existing task instances (they're all mock data)
DELETE FROM task_instances;

-- Verify cleanup
SELECT 
  'After cleanup' as status,
  COUNT(*) as task_instances_remaining
FROM task_instances;

-- Show master tasks that will be used for generation
SELECT 
  'Master tasks available' as info,
  title,
  recurrence_pattern,
  responsibility,
  is_active
FROM master_tasks 
WHERE is_active = true
ORDER BY title;