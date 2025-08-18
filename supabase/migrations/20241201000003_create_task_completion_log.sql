-- Create task completion log table for audit trail
CREATE TABLE IF NOT EXISTS task_completion_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('completed', 'uncompleted')),
    completion_time TIMESTAMPTZ NOT NULL,
    time_to_complete INTERVAL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_completion_log_task_instance_id ON task_completion_log(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_user_id ON task_completion_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_completion_time ON task_completion_log(completion_time);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_action ON task_completion_log(action);

-- Add RLS policies
ALTER TABLE task_completion_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view completion logs for their own actions or if they're admin
CREATE POLICY "Users can view completion logs" ON task_completion_log
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Users can insert completion logs for their own actions
CREATE POLICY "Users can insert completion logs" ON task_completion_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Only admins can update completion logs
CREATE POLICY "Admins can update completion logs" ON task_completion_log
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Only admins can delete completion logs
CREATE POLICY "Admins can delete completion logs" ON task_completion_log
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_completion_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_completion_log_updated_at
    BEFORE UPDATE ON task_completion_log
    FOR EACH ROW
    EXECUTE FUNCTION update_task_completion_log_updated_at();

-- Add comments for documentation
COMMENT ON TABLE task_completion_log IS 'Audit trail for task completion and undo actions';
COMMENT ON COLUMN task_completion_log.task_instance_id IS 'Reference to the task instance';
COMMENT ON COLUMN task_completion_log.user_id IS 'User who performed the action';
COMMENT ON COLUMN task_completion_log.action IS 'Action performed: completed or uncompleted';
COMMENT ON COLUMN task_completion_log.completion_time IS 'When the action was performed';
COMMENT ON COLUMN task_completion_log.time_to_complete IS 'Time taken from task creation to completion';
COMMENT ON COLUMN task_completion_log.notes IS 'Optional notes about the action';