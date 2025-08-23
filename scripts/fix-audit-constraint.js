#!/usr/bin/env node

/**
 * Fix Audit Constraint Script
 * 
 * This script fixes the audit_log constraint to allow holiday-related actions.
 * It can be run from the command line to apply the database fix automatically.
 * 
 * Usage:
 *   node scripts/fix-audit-constraint.js
 *   
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 *   - NEXT_PUBLIC_SUPABASE_URL environment variable must be set
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables')
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixAuditConstraint() {
  console.log('🔧 Starting audit constraint fix...')
  
  try {
    // Step 1: Drop existing constraint
    console.log('📝 Step 1: Dropping existing constraint...')
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;'
    })
    
    if (dropError && !dropError.message.includes('does not exist')) {
      console.warn('⚠️  Warning dropping constraint:', dropError.message)
    } else {
      console.log('✅ Existing constraint dropped successfully')
    }
    
    // Step 2: Add new constraint
    console.log('📝 Step 2: Adding new constraint with holiday actions...')
    const addConstraintSql = `
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
    
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: addConstraintSql
    })
    
    if (addError) {
      console.error('❌ Error adding constraint:', addError.message)
      throw addError
    }
    
    console.log('✅ New constraint added successfully')
    
    // Step 3: Test the constraint
    console.log('📝 Step 3: Testing constraint with holiday_deleted action...')
    const testInsert = await supabase
      .from('audit_log')
      .insert({
        action: 'holiday_deleted',
        metadata: { test: true, timestamp: new Date().toISOString() }
      })
      .select()
    
    if (testInsert.error) {
      console.error('❌ Test failed:', testInsert.error.message)
      throw testInsert.error
    }
    
    console.log('✅ Constraint test passed')
    
    // Step 4: Clean up test record
    if (testInsert.data && testInsert.data.length > 0) {
      await supabase
        .from('audit_log')
        .delete()
        .eq('id', testInsert.data[0].id)
      console.log('✅ Test record cleaned up')
    }
    
    console.log('')
    console.log('🎉 Audit constraint fix completed successfully!')
    console.log('   Public holidays can now be deleted without constraint violations.')
    console.log('')
    
  } catch (error) {
    console.error('')
    console.error('❌ Fix failed:', error.message)
    console.error('')
    console.error('📋 Manual fix required:')
    console.error('   1. Go to your Supabase Dashboard')
    console.error('   2. Navigate to the SQL Editor')
    console.error('   3. Run the SQL from: supabase/migrations/004_fix_audit_log_constraint.sql')
    console.error('')
    process.exit(1)
  }
}

// Run the fix
fixAuditConstraint()