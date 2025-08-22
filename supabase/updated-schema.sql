-- ========================================
-- UPDATED SCHEMA FOR PHARMACY INTRANET PORTAL
-- This schema fixes compatibility issues with task completion
-- ========================================

-- Drop existing tables if they exist (be careful in production!)
-- DROP TABLE IF EXISTS audit_log CASCADE;
-- DROP TABLE IF EXISTS task_completion_log CASCADE;
-- DROP TABLE IF EXISTS task_instances CASCADE;
-- DROP TABLE IF EXISTS master_tasks CASCADE;
-- DROP TABLE IF EXISTS user_profiles CASCADE;
-- DROP TABLE IF EXISTS positions CASCADE;
-- DROP TABLE IF EXISTS public_holidays CASCADE;
-- DROP TABLE IF EXISTS system_settings CASCADE;
-- DROP TABLE IF EXISTS notification_settings CASCADE;

-- ========================================
-- CORE TABLES
-- ========================================

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
    position_id UUID REFERENCES positions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create master_tasks table with updated structure
CREATE TABLE IF NOT EXISTS master_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    timing TEXT CHECK (timing IN ('anytime_during_day', 'specific_time', 'before_time', 'after_time')) DEFAULT 'anytime_during_day',
    due_time TIME,
    responsibility TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    frequency_rules JSONB DEFAULT '{"type": "daily"}',
    start_date DATE,
    end_date DATE,
    position_id UUID REFERENCES positions(id),
    frequency TEXT DEFAULT 'daily',
    category TEXT,
    publish_status TEXT CHECK (publish_status IN ('active', 'draft', 'inactive')) DEFAULT 'active',
    publish_delay DATE,
    publish_delay_date DATE,
    sticky_once_off BOOLEAN DEFAULT FALSE,
    allow_edit_when_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_instances table with flexible completed_by field
CREATE TABLE IF NOT EXISTS task_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_task_id UUID REFERENCES master_tasks(id),
    instance_date DATE NOT NULL,
    due_date DATE NOT NULL,
    due_time TIME,
    status TEXT CHECK (status IN ('not_due', 'due_today', 'overdue', 'missed', 'done', 'pending', 'completed')) DEFAULT 'not_due',
    is_published BOOLEAN DEFAULT TRUE,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Make completed_by flexible to handle both user IDs and position IDs
    completed_by TEXT, -- Changed from UUID with FK constraint to TEXT
    completed_by_type TEXT CHECK (completed_by_type IN ('user', 'position')) DEFAULT 'user',
    locked BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    notes TEXT,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create public_holidays table
CREATE TABLE IF NOT EXISTS public_holidays (
    date DATE NOT NULL,
    name TEXT NOT NULL,
    region TEXT DEFAULT 'National',
    source TEXT DEFAULT 'data.gov.au',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (date, region)
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_log table with enhanced tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    task_instance_id UUID REFERENCES task_instances(id),
    user_id UUID, -- Nullable for position-based auth
    position_id TEXT, -- For position-based auth tracking
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    auth_type TEXT CHECK (auth_type IN ('supabase', 'position')) DEFAULT 'supabase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_completion_log table for detailed completion tracking
CREATE TABLE IF NOT EXISTS task_completion_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID REFERENCES task_instances(id) ON DELETE CASCADE,
    user_id UUID, -- Nullable for position-based auth
    position_id TEXT, -- For position-based auth
    action TEXT CHECK (action IN ('completed', 'uncompleted', 'reopened')) NOT NULL,
    completion_time TIMESTAMP WITH TIME ZONE NOT NULL,
    time_to_complete INTERVAL,
    notes TEXT,
    auth_type TEXT CHECK (auth_type IN ('supabase', 'position')) DEFAULT 'supabase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE, -- Nullable for position-based users
    position_id TEXT, -- For position-based settings
    email_notifications BOOLEAN DEFAULT TRUE,
    daily_summary BOOLEAN DEFAULT TRUE,
    overdue_alerts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Core indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_password_hash ON positions(password_hash);
CREATE INDEX IF NOT EXISTS idx_positions_name ON positions(name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_position_id ON user_profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Master tasks indexes
CREATE INDEX IF NOT EXISTS idx_master_tasks_position_id ON master_tasks(position_id);
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequency ON master_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_status ON master_tasks(publish_status);
CREATE INDEX IF NOT EXISTS idx_master_tasks_category ON master_tasks(category);
CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility);
CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories);

-- Task instances indexes
CREATE INDEX IF NOT EXISTS idx_task_instances_master_task_id ON task_instances(master_task_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_instance_date ON task_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date ON task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_status ON task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_instances_completed_by ON task_instances(completed_by);
CREATE INDEX IF NOT EXISTS idx_task_instances_completed_by_type ON task_instances(completed_by_type);
CREATE INDEX IF NOT EXISTS idx_task_instances_position_status ON task_instances(master_task_id, status);
CREATE INDEX IF NOT EXISTS idx_task_instances_date_status ON task_instances(instance_date, status);

-- Audit and logging indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_task_instance_id ON audit_log(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_position_id ON audit_log(position_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_auth_type ON audit_log(auth_type);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_task_instance_id ON task_completion_log(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_user_id ON task_completion_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_position_id ON task_completion_log(position_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_completion_time ON task_completion_log(completion_time);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_position_id ON notification_settings(position_id);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_tasks_updated_at ON master_tasks;
CREATE TRIGGER update_master_tasks_updated_at 
    BEFORE UPDATE ON master_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_instances_updated_at ON task_instances;
CREATE TRIGGER update_task_instances_updated_at 
    BEFORE UPDATE ON task_instances 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at 
    BEFORE UPDATE ON notification_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
CREATE TRIGGER update_positions_updated_at 
    BEFORE UPDATE ON positions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SAMPLE DATA (Optional - for testing)
-- ========================================

-- Insert sample positions if they don't exist (using generated UUIDs)
-- These are sample positions - can be customized per pharmacy's needs
INSERT INTO positions (id, name, display_name, password_hash, is_super_admin) 
VALUES 
    (gen_random_uuid(), 'Pharmacist (Primary)', 'Pharmacist (Primary)', '$2b$10$example_hash_1', false),
    (gen_random_uuid(), 'Pharmacist (Supporting)', 'Pharmacist (Supporting)', '$2b$10$example_hash_2', false),
    (gen_random_uuid(), 'Pharmacy Assistants', 'Pharmacy Assistants', '$2b$10$example_hash_3', false),
    (gen_random_uuid(), 'Dispensary Technicians', 'Dispensary Technicians', '$2b$10$example_hash_4', false),
    (gen_random_uuid(), 'DAA Packers', 'DAA Packers', '$2b$10$example_hash_5', false),
    (gen_random_uuid(), 'Operational/Managerial', 'Operational/Managerial', '$2b$10$example_hash_6', false)
ON CONFLICT (name) DO NOTHING;

-- Note: These are sample positions. Pharmacies can add, modify, or remove positions
-- through the admin interface. The system dynamically adapts to any position names.

-- Insert sample system settings
INSERT INTO system_settings (key, value, description) 
VALUES 
    ('app_name', '"Pharmacy Intranet Portal"', 'Application name'),
    ('task_generation_enabled', 'true', 'Enable automatic task generation'),
    ('default_timezone', '"Australia/Sydney"', 'Default timezone for the application')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- COMMENTS AND DOCUMENTATION
-- ========================================

COMMENT ON TABLE positions IS 'Position-based authentication roles for pharmacy staff';
COMMENT ON TABLE user_profiles IS 'User profiles for Supabase authenticated users';
COMMENT ON TABLE master_tasks IS 'Template tasks that generate recurring instances';
COMMENT ON TABLE task_instances IS 'Individual task occurrences with completion tracking';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all system actions';
COMMENT ON TABLE task_completion_log IS 'Detailed task completion history';

COMMENT ON COLUMN task_instances.completed_by IS 'Flexible field to store user ID or position ID';
COMMENT ON COLUMN task_instances.completed_by_type IS 'Indicates whether completed_by is a user or position';
COMMENT ON COLUMN task_instances.status IS 'Task status: not_due, due_today, overdue, missed, done, pending, completed';
COMMENT ON COLUMN audit_log.auth_type IS 'Authentication method used: supabase or position';