-- Pharmacy Intranet Portal - Complete Database Schema with RLS
-- This file creates all tables, indexes, policies, and views
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ========================================
-- TABLES
-- ========================================

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    position_id UUID REFERENCES positions(id),
    role TEXT CHECK (role IN ('admin', 'viewer')) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create master_tasks table
CREATE TABLE IF NOT EXISTS master_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    position_id UUID REFERENCES positions(id),
    frequency TEXT CHECK (frequency IN (
        'once_off_sticky', 'every_day', 'weekly', 'specific_weekdays',
        'start_every_month', 'start_certain_months', 'every_month',
        'certain_months', 'end_every_month', 'end_certain_months'
    )) NOT NULL,
    weekdays INTEGER[] DEFAULT '{}',
    months INTEGER[] DEFAULT '{}',
    timing TEXT,
    default_due_time TIME,
    category TEXT,
    publish_status TEXT CHECK (publish_status IN ('active', 'draft', 'inactive')) DEFAULT 'active',
    publish_delay_date DATE,
    sticky_once_off BOOLEAN DEFAULT FALSE,
    allow_edit_when_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_instances table
CREATE TABLE IF NOT EXISTS task_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_task_id UUID REFERENCES master_tasks(id),
    instance_date DATE NOT NULL,
    due_date DATE NOT NULL,
    due_time TIME,
    status TEXT CHECK (status IN ('not_due', 'due_today', 'overdue', 'missed', 'done')) DEFAULT 'not_due',
    is_published BOOLEAN DEFAULT TRUE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    locked BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
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

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID REFERENCES task_instances(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT CHECK (action IN (
        -- Original task-related actions
        'created', 'completed', 'uncompleted', 'status_changed', 
        'locked', 'unlocked', 'acknowledged', 'resolved',
        -- Additional task actions
        'updated', 'deleted',
        -- Holiday-related actions
        'holiday_created', 'holiday_updated', 'holiday_deleted', 'holiday_sync',
        -- User-related actions
        'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
        -- Position-related actions
        'position_created', 'position_updated', 'position_deleted',
        -- System actions
        'system_config_changed', 'backup_created', 'maintenance_mode_toggled',
        -- Generic actions
        'viewed', 'exported', 'imported', 'bulk_operation'
    )) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT CHECK (data_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_completion_log table for detailed completion tracking
CREATE TABLE IF NOT EXISTS task_completion_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_instance_id UUID REFERENCES task_instances(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT CHECK (action IN ('completed', 'uncompleted')) NOT NULL,
    completion_time TIMESTAMP WITH TIME ZONE NOT NULL,
    time_to_complete INTERVAL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    daily_summary BOOLEAN DEFAULT TRUE,
    overdue_alerts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES
-- ========================================

-- Core indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_password_hash ON positions(password_hash);
CREATE INDEX IF NOT EXISTS idx_user_profiles_position_id ON user_profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_master_tasks_position_id ON master_tasks(position_id);
CREATE INDEX IF NOT EXISTS idx_master_tasks_frequency ON master_tasks(frequency);
CREATE INDEX IF NOT EXISTS idx_master_tasks_publish_status ON master_tasks(publish_status);
CREATE INDEX IF NOT EXISTS idx_master_tasks_category ON master_tasks(category);
CREATE INDEX IF NOT EXISTS idx_task_instances_master_task_id ON task_instances(master_task_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_instance_date ON task_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date ON task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_status ON task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_instances_completed_by ON task_instances(completed_by);
CREATE INDEX IF NOT EXISTS idx_task_instances_position_status ON task_instances(master_task_id, status);
CREATE INDEX IF NOT EXISTS idx_task_instances_date_status ON task_instances(instance_date, status);
CREATE INDEX IF NOT EXISTS idx_audit_log_task_instance_id ON audit_log(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_task_instance_id ON task_completion_log(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_user_id ON task_completion_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_completion_time ON task_completion_log(completion_time);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

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

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN COALESCE((SELECT role FROM user_profiles WHERE id = user_id), 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user position_id
CREATE OR REPLACE FUNCTION get_user_position_id(user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT position_id FROM user_profiles WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- POSITIONS TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage positions" ON positions;
DROP POLICY IF EXISTS "All users can view positions" ON positions;

CREATE POLICY "Admins can manage positions" ON positions
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view positions" ON positions
  FOR SELECT TO authenticated
  USING (true);

-- ========================================
-- MASTER_TASKS TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage master tasks" ON master_tasks;
DROP POLICY IF EXISTS "All users can view master tasks" ON master_tasks;

CREATE POLICY "Admins can manage master tasks" ON master_tasks
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view master tasks" ON master_tasks
  FOR SELECT TO authenticated
  USING (true);

-- ========================================
-- TASK_INSTANCES TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage all task instances" ON task_instances;
DROP POLICY IF EXISTS "Users can view own position task instances" ON task_instances;
DROP POLICY IF EXISTS "Users can update own position task instances" ON task_instances;

-- Admins can manage all task instances
CREATE POLICY "Admins can manage all task instances" ON task_instances
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Viewers can only see task instances for their position
CREATE POLICY "Users can view own position task instances" ON task_instances
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'viewer' AND
    master_task_id IN (
      SELECT id FROM master_tasks 
      WHERE position_id = get_user_position_id(auth.uid())
    )
  );

-- Users can update task instances for their position (mark done/undo)
CREATE POLICY "Users can update own position task instances" ON task_instances
  FOR UPDATE TO authenticated
  USING (
    master_task_id IN (
      SELECT id FROM master_tasks 
      WHERE position_id = get_user_position_id(auth.uid())
    ) AND
    (NOT locked OR 
     master_task_id IN (
       SELECT id FROM master_tasks 
       WHERE allow_edit_when_locked = true
     )
    )
  )
  WITH CHECK (
    master_task_id IN (
      SELECT id FROM master_tasks 
      WHERE position_id = get_user_position_id(auth.uid())
    ) AND
    (NOT locked OR 
     master_task_id IN (
       SELECT id FROM master_tasks 
       WHERE allow_edit_when_locked = true
     )
    )
  );

-- ========================================
-- PUBLIC_HOLIDAYS TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage public holidays" ON public_holidays;
DROP POLICY IF EXISTS "All users can view public holidays" ON public_holidays;

CREATE POLICY "Admins can manage public holidays" ON public_holidays
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view public holidays" ON public_holidays
  FOR SELECT TO authenticated
  USING (true);

-- ========================================
-- AUDIT_LOG TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
DROP POLICY IF EXISTS "Users can view own task audit logs" ON audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_log;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Users can view audit logs for their task instances
CREATE POLICY "Users can view own task audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'viewer' AND
    task_instance_id IN (
      SELECT ti.id FROM task_instances ti
      JOIN master_tasks mt ON ti.master_task_id = mt.id
      WHERE mt.position_id = get_user_position_id(auth.uid())
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ========================================
-- USER_PROFILES TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Admins can manage all profiles
CREATE POLICY "Admins can manage user profiles" ON user_profiles
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (display_name only, not role/position)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ========================================
-- SYSTEM_SETTINGS TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "Users can view public system settings" ON system_settings;

-- Admins can manage all settings
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- All users can read public settings
CREATE POLICY "Users can view public system settings" ON system_settings
  FOR SELECT TO authenticated
  USING (is_public = true);

-- ========================================
-- TASK_COMPLETION_LOG TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can view all completion logs" ON task_completion_log;
DROP POLICY IF EXISTS "Users can view own completion logs" ON task_completion_log;
DROP POLICY IF EXISTS "System can insert completion logs" ON task_completion_log;

-- Admins can view all completion logs
CREATE POLICY "Admins can view all completion logs" ON task_completion_log
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Users can view their own completion logs
CREATE POLICY "Users can view own completion logs" ON task_completion_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- System can insert completion logs
CREATE POLICY "System can insert completion logs" ON task_completion_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ========================================
-- NOTIFICATION_SETTINGS TABLE POLICIES
-- ========================================

DROP POLICY IF EXISTS "Admins can manage notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can manage own notification settings" ON notification_settings;

-- Admins can manage all notification settings
CREATE POLICY "Admins can manage notification settings" ON notification_settings
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Users can manage their own notification settings
CREATE POLICY "Users can manage own notification settings" ON notification_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ========================================
-- REPORTING VIEWS
-- ========================================

-- Create view for task summary by position
CREATE OR REPLACE VIEW task_summary_by_position AS
SELECT 
    p.name AS position_name,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'done') AS completed_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'overdue') AS overdue_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'missed') AS missed_tasks,
    COUNT(*) FILTER (WHERE ti.status IN ('due_today', 'overdue')) AS pending_tasks,
    ROUND(
        (COUNT(*) FILTER (WHERE ti.status = 'done')::numeric / 
         NULLIF(COUNT(*), 0)) * 100, 2
    ) AS completion_rate
FROM positions p
LEFT JOIN master_tasks mt ON p.id = mt.position_id AND mt.publish_status = 'active'
LEFT JOIN task_instances ti ON mt.id = ti.master_task_id 
    AND ti.instance_date >= CURRENT_DATE - INTERVAL '30 days'
    AND ti.is_published = true
GROUP BY p.id, p.name
ORDER BY p.name;

-- Create view for daily task metrics
CREATE OR REPLACE VIEW daily_task_metrics AS
SELECT 
    ti.instance_date,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'done') AS completed_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'overdue') AS overdue_tasks,
    COUNT(*) FILTER (WHERE ti.status = 'missed') AS missed_tasks,
    ROUND(
        (COUNT(*) FILTER (WHERE ti.status = 'done')::numeric / 
         NULLIF(COUNT(*), 0)) * 100, 2
    ) AS daily_completion_rate
FROM task_instances ti
JOIN master_tasks mt ON ti.master_task_id = mt.id
WHERE mt.publish_status = 'active' 
    AND ti.is_published = true
    AND ti.instance_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY ti.instance_date
ORDER BY ti.instance_date DESC;

-- Create view for outstanding tasks
CREATE OR REPLACE VIEW outstanding_tasks AS
SELECT 
    ti.id,
    ti.instance_date,
    ti.due_date,
    ti.status,
    ti.acknowledged,
    ti.resolved,
    mt.title,
    mt.category,
    p.name AS position_name,
    CASE 
        WHEN ti.status = 'overdue' THEN CURRENT_DATE - ti.due_date
        WHEN ti.status = 'missed' THEN CURRENT_DATE - ti.due_date
        ELSE 0
    END AS days_overdue
FROM task_instances ti
JOIN master_tasks mt ON ti.master_task_id = mt.id
JOIN positions p ON mt.position_id = p.id
WHERE ti.status IN ('overdue', 'missed')
    AND ti.is_published = true
    AND mt.publish_status = 'active'
ORDER BY days_overdue DESC, ti.due_date ASC;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Pharmacy Portal Schema Setup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables Created: 9';
    RAISE NOTICE 'Indexes Created: 24';
    RAISE NOTICE 'Views Created: 3';
    RAISE NOTICE 'RLS Policies: ~20';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next: Run seed-data.sql to populate';
    RAISE NOTICE '========================================';
END $$;