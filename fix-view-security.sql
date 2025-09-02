-- Fix the security issue with task_completion_status view
-- This recreates the view with SECURITY INVOKER to use the querying user's permissions

-- Drop the existing view
DROP VIEW IF EXISTS task_completion_status;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW task_completion_status 
WITH (security_invoker = true) AS
SELECT
    ti.id as task_instance_id,
    ti.master_task_id,
    ti.instance_date,
    ti.due_date,
    ti.status as global_status,
    mt.title,
    mt.responsibility,
    COALESCE(
        jsonb_object_agg(
            tpc.position_name,
            jsonb_build_object(
                'completed', tpc.is_completed,
                'completed_at', tpc.completed_at,
                'completed_by', tpc.completed_by,
                'uncompleted_at', tpc.uncompleted_at
            )
        ) FILTER (WHERE tpc.position_name IS NOT NULL),
        '{}'::jsonb
    ) as position_completions
FROM task_instances ti
JOIN master_tasks mt ON ti.master_task_id = mt.id
LEFT JOIN task_position_completions tpc ON ti.id = tpc.task_instance_id
GROUP BY ti.id, ti.master_task_id, ti.instance_date, ti.due_date, ti.status, mt.title, mt.responsibility;

-- Add comment for documentation
COMMENT ON VIEW task_completion_status IS 'View showing task completion status per position (uses SECURITY INVOKER for proper RLS enforcement)';

-- Log the fix
DO $$
BEGIN
    RAISE NOTICE 'Security fix applied: task_completion_status view now uses SECURITY INVOKER';
END $$;