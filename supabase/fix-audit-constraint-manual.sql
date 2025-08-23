-- Fix Audit Log Constraint for Public Holidays
-- This script fixes the audit_log action constraint to allow holiday-related actions
-- Run this in your Supabase SQL Editor to fix the public holiday deletion issue

-- Step 1: Drop existing constraint if it exists
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Step 2: Add comprehensive action constraint that includes all necessary actions
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check 
CHECK (action IN (
    -- Original task-related actions
    'created', 'completed', 'uncompleted', 'status_changed', 
    'locked', 'unlocked', 'acknowledged', 'resolved',
    -- Additional task actions
    'updated', 'deleted',
    -- Holiday-related actions (these were missing and causing the error)
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

-- Step 3: Ensure the public holidays audit trigger function exists
CREATE OR REPLACE FUNCTION log_public_holidays_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_created',
            NULL,
            to_jsonb(NEW),
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'INSERT',
                'timestamp', NOW(),
                'date', NEW.date,
                'region', NEW.region
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'UPDATE',
                'timestamp', NOW(),
                'old_date', OLD.date,
                'new_date', NEW.date,
                'old_region', OLD.region,
                'new_region', NEW.region
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            task_instance_id,
            user_id,
            action,
            old_values,
            new_values,
            metadata
        ) VALUES (
            NULL,
            auth.uid(),
            'holiday_deleted',
            to_jsonb(OLD),
            NULL,
            jsonb_build_object(
                'table', 'public_holidays',
                'operation', 'DELETE',
                'timestamp', NOW(),
                'date', OLD.date,
                'region', OLD.region
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_log_public_holidays_changes ON public_holidays;
CREATE TRIGGER trigger_log_public_holidays_changes
    AFTER INSERT OR UPDATE OR DELETE ON public_holidays
    FOR EACH ROW EXECUTE FUNCTION log_public_holidays_changes();

-- Step 5: Test the constraint (this will succeed if the fix worked)
INSERT INTO audit_log (action, metadata) 
VALUES ('holiday_deleted', jsonb_build_object('test', true, 'timestamp', NOW()));

-- Step 6: Clean up the test record
DELETE FROM audit_log WHERE metadata->>'test' = 'true';

-- Success message
SELECT 'Audit log constraint fixed successfully! Public holidays can now be deleted.' as status;