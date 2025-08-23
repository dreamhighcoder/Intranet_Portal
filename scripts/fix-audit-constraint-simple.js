#!/usr/bin/env node

/**
 * Script to fix the audit_log constraint issue that prevents public holiday deletion
 * This script directly executes the SQL commands needed to fix the constraint
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

async function fixAuditConstraint() {
  console.log('🔧 Fixing audit_log constraint for public holidays...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    console.log('📄 Step 1: Dropping existing constraint...')
    
    // First, drop the existing constraint
    const { error: dropError } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;'
    })
    
    if (dropError && !dropError.message.includes('does not exist')) {
      console.error('❌ Failed to drop constraint:', dropError)
      // Continue anyway, the constraint might not exist
    } else {
      console.log('✅ Existing constraint dropped (or didn\'t exist)')
    }
    
    console.log('📄 Step 2: Adding new constraint with holiday actions...')
    
    // Add the new constraint with holiday actions
    const constraintSQL = `
      ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check 
      CHECK (action IN (
          'created', 'completed', 'uncompleted', 'status_changed', 
          'locked', 'unlocked', 'acknowledged', 'resolved',
          'updated', 'deleted',
          'holiday_created', 'holiday_updated', 'holiday_deleted', 'holiday_sync',
          'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
          'position_created', 'position_updated', 'position_deleted',
          'system_config_changed', 'backup_created', 'maintenance_mode_toggled',
          'viewed', 'exported', 'imported', 'bulk_operation'
      ));
    `
    
    const { error: addError } = await supabase.rpc('exec', { sql: constraintSQL })
    
    if (addError) {
      console.error('❌ Failed to add new constraint:', addError)
      process.exit(1)
    }
    
    console.log('✅ New constraint added successfully!')
    
    // Test that the constraint now works by trying to insert a test record
    console.log('🧪 Testing constraint with holiday_deleted action...')
    
    const testResult = await supabase
      .from('audit_log')
      .insert({
        action: 'holiday_deleted',
        metadata: { test: true, timestamp: new Date().toISOString() }
      })
      .select()
    
    if (testResult.error) {
      console.error('❌ Constraint test failed:', testResult.error)
      process.exit(1)
    }
    
    // Clean up the test entry
    if (testResult.data && testResult.data.length > 0) {
      await supabase
        .from('audit_log')
        .delete()
        .eq('id', testResult.data[0].id)
      console.log('🧹 Test record cleaned up')
    }
    
    console.log('✅ Constraint test passed!')
    console.log('🎉 Public holidays can now be deleted successfully!')
    console.log('')
    console.log('The following actions are now allowed in audit_log:')
    console.log('  - holiday_created, holiday_updated, holiday_deleted')
    console.log('  - All original task actions (created, completed, etc.)')
    console.log('  - Additional system actions for future use')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the fix
fixAuditConstraint().catch(console.error)