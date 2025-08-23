import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    console.log('Apply audit fix - Starting request processing')
    
    // Authenticate the user and ensure they're an admin
    const user = await requireAuth(request)
    console.log('Apply audit fix - Authentication successful for:', user.email)
    
    // Since we can't execute DDL statements directly through the Supabase client,
    // we'll provide the exact SQL script that needs to be run manually
    const sqlScript = `-- Fix Audit Log Constraint for Public Holidays
-- This script fixes the audit_log action constraint to allow holiday-related actions

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
SELECT 'Audit log constraint fixed successfully! Public holidays can now be deleted.' as status;`
    
    console.log('Apply audit fix - Providing SQL script for manual execution')
    
    return NextResponse.json({
      success: false,
      requiresManualExecution: true,
      message: 'Database constraint fix requires manual execution in Supabase Dashboard',
      details: 'The audit_log constraint must be updated to include holiday-related actions',
      sqlScript: sqlScript,
      instructions: [
        '1. Go to your Supabase Dashboard (https://supabase.com/dashboard)',
        '2. Select your project',
        '3. Navigate to the SQL Editor in the left sidebar',
        '4. Create a new query',
        '5. Copy and paste the provided SQL script',
        '6. Click "Run" to execute the script',
        '7. Look for the success message at the bottom',
        '8. Return to the Public Holidays page and try deleting a holiday again'
      ],
      troubleshooting: [
        'If you see "constraint already exists" - this is normal, the script handles it',
        'If you see other errors, please contact your system administrator',
        'The fix adds support for holiday_created, holiday_updated, and holiday_deleted actions'
      ]
    })
    
  } catch (error) {
    console.error('Apply audit fix - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}