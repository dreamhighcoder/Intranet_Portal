import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    console.log('Fix audit constraint - Starting request processing')
    
    // Authenticate the user and ensure they're an admin
    const user = await requireAuth(request)
    console.log('Fix audit constraint - Authentication successful for:', user.email)
    
    // Since we can't execute DDL statements through the Supabase client,
    // we'll provide instructions for manual execution
    const sqlScript = `
-- Step 1: Drop the existing constraint
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Step 2: Add the new constraint with holiday actions included
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

-- Step 3: Test the constraint by inserting a test record
INSERT INTO audit_log (action, metadata) 
VALUES ('holiday_deleted', '{"test": true, "timestamp": "' || NOW() || '"}');

-- Step 4: Clean up the test record
DELETE FROM audit_log WHERE metadata->>'test' = 'true';

-- Success message
SELECT 'Audit log constraint fixed successfully! Public holidays can now be deleted.' as status;
    `.trim()
    
    console.log('Fix audit constraint - Providing manual SQL script')
    
    return NextResponse.json({
      success: false,
      requiresManualExecution: true,
      message: 'Database constraint fix requires manual execution',
      details: 'The constraint must be updated directly in the Supabase dashboard',
      sqlScript: sqlScript,
      instructions: [
        '1. Go to your Supabase dashboard',
        '2. Navigate to the SQL Editor',
        '3. Copy and paste the provided SQL script',
        '4. Execute the script',
        '5. Verify the success message appears',
        '6. Try deleting a public holiday again'
      ]
    })
    
  } catch (error) {
    console.error('Fix audit constraint - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}