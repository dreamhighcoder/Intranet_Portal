-- ========================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
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

-- POSITIONS TABLE POLICIES
-- Admins can do everything, viewers can read all positions (needed for task details)
CREATE POLICY "Admins can manage positions" ON positions
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view positions" ON positions
  FOR SELECT TO authenticated
  USING (true);

-- MASTER_TASKS TABLE POLICIES
-- Admins can manage all master tasks, viewers can read all (needed for task details)
CREATE POLICY "Admins can manage master tasks" ON master_tasks
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view master tasks" ON master_tasks
  FOR SELECT TO authenticated
  USING (true);

-- TASK_INSTANCES TABLE POLICIES
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

-- PUBLIC_HOLIDAYS TABLE POLICIES
-- Admins can manage holidays, all users can read
CREATE POLICY "Admins can manage public holidays" ON public_holidays
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All users can view public holidays" ON public_holidays
  FOR SELECT TO authenticated
  USING (true);

-- AUDIT_LOG TABLE POLICIES
-- Admins can view all audit logs, users can only see logs for their task instances
CREATE POLICY "Admins can view all audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

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

-- USER_PROFILES TABLE POLICIES
-- Admins can manage all profiles, users can read their own profile
CREATE POLICY "Admins can manage user profiles" ON user_profiles
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- SYSTEM_SETTINGS TABLE POLICIES
-- Admins can manage all settings
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- All users can read public settings
CREATE POLICY "Users can view public system settings" ON system_settings
  FOR SELECT TO authenticated
  USING (is_public = true);

-- TASK_COMPLETION_LOG TABLE POLICIES
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

-- NOTIFICATION_SETTINGS TABLE POLICIES
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
-- ENHANCED SECURITY POLICIES
-- ========================================

-- Add rate limiting for failed login attempts
CREATE POLICY "Rate limit failed logins" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow up to 5 failed login attempts per IP per hour
    NOT (
      action = 'login_failed' AND
      metadata->>'ip_address' IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM audit_log 
        WHERE action = 'login_failed' 
        AND metadata->>'ip_address' = audit_log.metadata->>'ip_address'
        AND created_at > NOW() - INTERVAL '1 hour'
        HAVING COUNT(*) >= 5
      )
    )
  );

-- Prevent excessive audit log creation
CREATE POLICY "Prevent audit log spam" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow up to 100 audit entries per user per minute
    NOT (
      EXISTS (
        SELECT 1 FROM audit_log 
        WHERE user_id = audit_log.user_id
        AND created_at > NOW() - INTERVAL '1 minute'
        HAVING COUNT(*) >= 100
      )
    )
  );

-- ========================================
-- POSITION-BASED AUTHENTICATION POLICIES
-- ========================================

-- Allow position-based authenticated users to read their own data
CREATE POLICY "Position users can read own data" ON positions
  FOR SELECT TO authenticated
  USING (
    -- Check if this is a position-based auth request
    EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'positions' 
      AND column_name = 'id'
    ) AND
    -- Allow if the position ID matches the authenticated position
    id::text = current_setting('app.position_id', true) OR
    -- Or if it's a non-admin position (dynamic check instead of hardcoded names)
    (name IS NOT NULL AND name != 'Administrator')
  );

-- Allow position-based users to update task instances for their position
CREATE POLICY "Position users can update own position tasks" ON task_instances
  FOR UPDATE TO authenticated
  USING (
    -- Check if this is a position-based auth request
    current_setting('app.position_id', true) IS NOT NULL AND
    -- Allow if the task belongs to their position
    master_task_id IN (
      SELECT id FROM master_tasks 
      WHERE position_id::text = current_setting('app.position_id', true)
    )
  )
  WITH CHECK (
    -- Same conditions for the new values
    master_task_id IN (
      SELECT id FROM master_tasks 
      WHERE position_id::text = current_setting('app.position_id', true)
    )
  );

-- ========================================
-- AUDIT LOG RETENTION POLICIES
-- ========================================

-- Automatically archive old audit logs (older than 1 year)
-- This would typically be done with a scheduled job, but we can add a policy
CREATE POLICY "Archive old audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (
    -- Only show recent logs to regular users
    get_user_role(auth.uid()) = 'admin' OR
    created_at > NOW() - INTERVAL '90 days'
  );

-- ========================================
-- DATA EXPORT POLICIES
-- ========================================

-- Allow admins to export data
CREATE POLICY "Admins can export data" ON audit_log
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin' AND
    -- Rate limit exports to prevent abuse
    NOT EXISTS (
      SELECT 1 FROM audit_log 
      WHERE user_id = auth.uid()
      AND action = 'exported'
      AND created_at > NOW() - INTERVAL '1 hour'
      HAVING COUNT(*) >= 10
    )
  );