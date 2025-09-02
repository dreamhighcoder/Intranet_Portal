-- Migration: Add position-specific task completion tracking
-- Date: 2025-01-15
-- Description: Adds support for tracking task completion per position for shared tasks

-- Add new columns to task_instances for position-specific completion
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS completed_by_type TEXT CHECK (completed_by_type IN ('user', 'position')),
ADD COLUMN IF NOT EXISTS position_completions JSONB DEFAULT '{}';

-- Create a new table for position-specific task completions
CREATE TABLE IF NOT EXISTS task_position_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    position_name TEXT NOT NULL, -- Store position name for historical tracking
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    uncompleted_at TIMESTAMPTZ, -- Track when task was uncompleted
    is_completed BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_instance_id, position_id) -- One completion record per task per position
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_position_completions_task_instance_id ON task_position_completions(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_position_id ON task_position_completions(position_id);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_completed_at ON task_position_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_task_position_completions_is_completed ON task_position_completions(is_completed);

-- Add RLS policies for the new table
ALTER TABLE task_position_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view completions for their position or if they're admin
CREATE POLICY "Users can view position completions" ON task_position_completions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            JOIN positions p ON up.position_id = p.id
            WHERE up.id = auth.uid() 
            AND (p.id = position_id OR up.role = 'admin')
        )
    );

-- Policy: Users can insert completions for their own position
CREATE POLICY "Users can insert position completions" ON task_position_completions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.position_id = position_id
        )
    );

-- Policy: Users can update completions for their own position or admins can update any
CREATE POLICY "Users can update position completions" ON task_position_completions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND (up.position_id = position_id OR up.role = 'admin')
        )
    );

-- Policy: Only admins can delete completions
CREATE POLICY "Admins can delete position completions" ON task_position_completions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_position_completions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_position_completions_updated_at
    BEFORE UPDATE ON task_position_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_task_position_completions_updated_at();

-- Create a view for easy querying of position-specific completion status
CREATE OR REPLACE VIEW task_completion_status AS
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

-- Add comments for documentation
COMMENT ON TABLE task_position_completions IS 'Position-specific completion tracking for shared tasks';
COMMENT ON COLUMN task_position_completions.task_instance_id IS 'Reference to the task instance';
COMMENT ON COLUMN task_position_completions.position_id IS 'Position that completed the task';
COMMENT ON COLUMN task_position_completions.position_name IS 'Position name for historical tracking';
COMMENT ON COLUMN task_position_completions.completed_by IS 'User who completed the task';
COMMENT ON COLUMN task_position_completions.completed_at IS 'When the task was completed';
COMMENT ON COLUMN task_position_completions.uncompleted_at IS 'When the task was uncompleted (if applicable)';
COMMENT ON COLUMN task_position_completions.is_completed IS 'Current completion status for this position';
COMMENT ON VIEW task_completion_status IS 'View showing task completion status per position';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added position-specific task completion tracking';
    RAISE NOTICE 'New table: task_position_completions';
    RAISE NOTICE 'New view: task_completion_status';
    RAISE NOTICE 'Added columns to task_instances: completed_by_type, position_completions';
END $$;