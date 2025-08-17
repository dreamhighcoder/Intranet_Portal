-- Migration: Enhance Audit Log Table
-- Date: 2024-12-19
-- Description: Enhances audit_log table with better structure and additional fields for comprehensive audit logging
-- Safe to run multiple times (uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS)

-- ========================================
-- ENHANCE AUDIT_LOG TABLE STRUCTURE
-- ========================================

-- Add additional columns to audit_log table for better audit tracking
DO $$ 
BEGIN
    -- Add table_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'table_name') THEN
        ALTER TABLE audit_log ADD COLUMN table_name TEXT;
    END IF;

    -- Add record_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'record_id') THEN
        ALTER TABLE audit_log ADD COLUMN record_id TEXT;
    END IF;

    -- Add ip_address column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'ip_address') THEN
        ALTER TABLE audit_log ADD COLUMN ip_address INET;
    END IF;

    -- Add user_agent column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'user_agent') THEN
        ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
    END IF;

    -- Add session_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'session_id') THEN
        ALTER TABLE audit_log ADD COLUMN session_id TEXT;
    END IF;

    -- Add position_id column if it doesn't exist (for position-based auth)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'position_id') THEN
        ALTER TABLE audit_log ADD COLUMN position_id UUID REFERENCES positions(id);
    END IF;

    -- Add auth_type column if it doesn't exist (supabase vs position-based)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'audit_log' AND column_name = 'auth_type') THEN
        ALTER TABLE audit_log ADD COLUMN auth_type TEXT DEFAULT 'supabase';
    END IF;

    RAISE NOTICE 'Audit log table structure enhanced successfully';
END $$;

-- ========================================
-- UPDATE ACTION CHECK CONSTRAINT
-- ========================================

-- Drop existing constraint if it exists
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Add new comprehensive action constraint
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check 
CHECK (action IN (
    -- Task-related actions
    'created', 'updated', 'deleted', 'completed', 'uncompleted', 
    'status_changed', 'locked', 'unlocked', 'acknowledged', 'resolved',
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
));

-- ========================================
-- ADD NEW INDEXES FOR PERFORMANCE
-- ========================================

-- Add index for table_name lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);

-- Add index for record_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);

-- Add index for position_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_position_id ON audit_log(position_id);

-- Add index for auth_type lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_auth_type ON audit_log(auth_type);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_table_action ON audit_log(user_id, table_name, action);

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_audit_log_date_range ON audit_log(created_at) WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- ========================================
-- ENHANCE AUDIT LOGGING FUNCTIONS
-- ========================================

-- Create enhanced audit logging function
CREATE OR REPLACE FUNCTION log_audit_action(
    p_table_name TEXT,
    p_record_id TEXT,
    p_user_id UUID,
    p_action TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_task_instance_id UUID DEFAULT NULL,
    p_position_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_auth_type TEXT DEFAULT 'supabase'
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_log (
        table_name,
        record_id,
        user_id,
        action,
        old_values,
        new_values,
        metadata,
        task_instance_id,
        position_id,
        ip_address,
        user_agent,
        session_id,
        auth_type,
        created_at
    ) VALUES (
        p_table_name,
        p_record_id,
        p_user_id,
        p_action,
        p_old_values,
        p_new_values,
        p_metadata,
        p_task_instance_id,
        p_position_id,
        p_ip_address,
        p_user_agent,
        p_session_id,
        p_auth_type,
        NOW()
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log position-based auth actions
CREATE OR REPLACE FUNCTION log_position_audit_action(
    p_table_name TEXT,
    p_record_id TEXT,
    p_position_id UUID,
    p_action TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_task_instance_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
    RETURN log_audit_action(
        p_table_name,
        p_record_id,
        NULL, -- user_id is NULL for position-based auth
        p_action,
        p_old_values,
        p_new_values,
        p_metadata,
        p_task_instance_id,
        p_position_id,
        NULL, -- ip_address
        NULL, -- user_agent
        NULL, -- session_id
        'position' -- auth_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- UPDATE EXISTING TRIGGERS
-- ========================================

-- Update the public holidays audit trigger to use new function
CREATE OR REPLACE FUNCTION log_public_holidays_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_action(
            'public_holidays',
            NEW.date::TEXT,
            auth.uid(),
            'holiday_created',
            NULL,
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'INSERT',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit_action(
            'public_holidays',
            NEW.date::TEXT,
            auth.uid(),
            'holiday_updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'UPDATE',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit_action(
            'public_holidays',
            OLD.date::TEXT,
            auth.uid(),
            'holiday_deleted',
            to_jsonb(OLD),
            NULL,
            jsonb_build_object(
                'operation', 'DELETE',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ADD AUDIT TRIGGERS FOR OTHER TABLES
-- ========================================

-- Create audit trigger for master_tasks table
CREATE OR REPLACE FUNCTION log_master_tasks_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_action(
            'master_tasks',
            NEW.id::TEXT,
            auth.uid(),
            'created',
            NULL,
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'INSERT',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit_action(
            'master_tasks',
            NEW.id::TEXT,
            auth.uid(),
            'updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'UPDATE',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit_action(
            'master_tasks',
            OLD.id::TEXT,
            auth.uid(),
            'deleted',
            to_jsonb(OLD),
            NULL,
            jsonb_build_object(
                'operation', 'DELETE',
                'timestamp', NOW(),
                'source', 'trigger'
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for master_tasks table
DROP TRIGGER IF EXISTS trigger_log_master_tasks_changes ON master_tasks;
CREATE TRIGGER trigger_log_master_tasks_changes
    AFTER INSERT OR UPDATE OR DELETE ON master_tasks
    FOR EACH ROW EXECUTE FUNCTION log_master_tasks_changes();

-- Create audit trigger for task_instances table
CREATE OR REPLACE FUNCTION log_task_instances_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_action(
            'task_instances',
            NEW.id::TEXT,
            auth.uid(),
            'created',
            NULL,
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'INSERT',
                'timestamp', NOW(),
                'source', 'trigger'
            ),
            NEW.id
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit_action(
            'task_instances',
            NEW.id::TEXT,
            auth.uid(),
            'updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object(
                'operation', 'UPDATE',
                'timestamp', NOW(),
                'source', 'trigger'
            ),
            NEW.id
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit_action(
            'task_instances',
            OLD.id::TEXT,
            auth.uid(),
            'deleted',
            to_jsonb(OLD),
            NULL,
            jsonb_build_object(
                'operation', 'DELETE',
                'timestamp', NOW(),
                'source', 'trigger'
            ),
            OLD.id
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task_instances table
DROP TRIGGER IF EXISTS trigger_log_task_instances_changes ON task_instances;
CREATE TRIGGER trigger_log_task_instances_changes
    AFTER INSERT OR UPDATE OR DELETE ON task_instances
    FOR EACH ROW EXECUTE FUNCTION log_task_instances_changes();

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify the enhanced audit log table
DO $$
BEGIN
    -- Check if new columns were added
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'audit_log' AND column_name = 'table_name') THEN
        RAISE NOTICE 'Audit log table enhanced successfully with new columns';
    ELSE
        RAISE NOTICE 'Audit log table enhancement may have failed';
    END IF;
    
    -- Check if new indexes were created
    IF EXISTS (SELECT 1 FROM pg_indexes 
               WHERE tablename = 'audit_log' AND indexname = 'idx_audit_log_table_name') THEN
        RAISE NOTICE 'New audit log indexes created successfully';
    ELSE
        RAISE NOTICE 'Some audit log indexes may not have been created';
    END IF;
    
    -- Check if new functions were created
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_action') THEN
        RAISE NOTICE 'Enhanced audit logging functions created successfully';
    ELSE
        RAISE NOTICE 'Audit logging functions may not have been created';
    END IF;
END $$;
