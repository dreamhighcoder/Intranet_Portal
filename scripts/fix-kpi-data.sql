-- Fix KPI Data Script
-- This script updates existing task instances to have proper completed_at timestamps
-- and adds missed tasks for accurate KPI calculations

-- First, let's update existing completed tasks to have completed_at timestamps
UPDATE task_instances 
SET completed_at = (due_date::timestamp + due_time + INTERVAL '15 minutes')
WHERE status = 'done' AND completed_at IS NULL;

-- Add some sample missed tasks for the last 7 days if they don't exist
INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published, completed_at, completed_by
) 
SELECT 
  mt.id,
  CURRENT_DATE - 3,
  CURRENT_DATE - 3,
  '09:00:00',
  'missed',
  true,
  NULL,
  NULL
FROM master_tasks mt 
WHERE mt.title = 'Daily Register Check'
AND NOT EXISTS (
  SELECT 1 FROM task_instances ti 
  WHERE ti.master_task_id = mt.id 
  AND ti.due_date = CURRENT_DATE - 3
);

INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published, completed_at, completed_by
) 
SELECT 
  mt.id,
  CURRENT_DATE - 3,
  CURRENT_DATE - 3,
  '08:30:00',
  'missed',
  true,
  NULL,
  NULL
FROM master_tasks mt 
WHERE mt.title = 'Daily Temperature Log'
AND NOT EXISTS (
  SELECT 1 FROM task_instances ti 
  WHERE ti.master_task_id = mt.id 
  AND ti.due_date = CURRENT_DATE - 3
);

-- Add another missed task from 5 days ago
INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published, completed_at, completed_by
) 
SELECT 
  mt.id,
  CURRENT_DATE - 5,
  CURRENT_DATE - 5,
  '09:00:00',
  'missed',
  true,
  NULL,
  NULL
FROM master_tasks mt 
WHERE mt.title = 'Daily Register Check'
AND NOT EXISTS (
  SELECT 1 FROM task_instances ti 
  WHERE ti.master_task_id = mt.id 
  AND ti.due_date = CURRENT_DATE - 5
);

-- Add some completed tasks with varied completion times for better KPI data
INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published, completed_at, completed_by
) 
SELECT 
  mt.id,
  CURRENT_DATE - 2,
  CURRENT_DATE - 2,
  '09:00:00',
  'done',
  true,
  (CURRENT_DATE - 2)::timestamp + '11:30:00'::time, -- Completed late (2.5 hours after due)
  NULL
FROM master_tasks mt 
WHERE mt.title = 'Daily Register Check'
AND NOT EXISTS (
  SELECT 1 FROM task_instances ti 
  WHERE ti.master_task_id = mt.id 
  AND ti.due_date = CURRENT_DATE - 2
);

INSERT INTO task_instances (
  master_task_id, instance_date, due_date, due_time, status, is_published, completed_at, completed_by
) 
SELECT 
  mt.id,
  CURRENT_DATE - 4,
  CURRENT_DATE - 4,
  '09:00:00',
  'done',
  true,
  (CURRENT_DATE - 4)::timestamp + '09:05:00'::time, -- Completed on time
  NULL
FROM master_tasks mt 
WHERE mt.title = 'Daily Register Check'
AND NOT EXISTS (
  SELECT 1 FROM task_instances ti 
  WHERE ti.master_task_id = mt.id 
  AND ti.due_date = CURRENT_DATE - 4
);

-- Verify the data
SELECT 
  'Summary' as type,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_tasks,
  COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed_tasks,
  COUNT(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN 1 END) as completed_with_timestamp
FROM task_instances 
WHERE due_date >= CURRENT_DATE - 7;