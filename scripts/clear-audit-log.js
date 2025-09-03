#!/usr/bin/env node

/**
 * Clear Audit Log Script
 * This script will empty the audit_log table completely
 * 
 * Usage:
 * node scripts/clear-audit-log.js
 * 
 * Make sure your .env.local file has the correct Supabase credentials
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function clearAuditLog() {
  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('🔍 Checking current audit log records...')
    
    // Check current count
    const { count: currentCount, error: countError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw countError
    }

    console.log(`📊 Current audit_log records: ${currentCount}`)

    if (currentCount === 0) {
      console.log('✅ Audit log is already empty!')
      return
    }

    // Confirm deletion
    console.log(`⚠️  About to delete ${currentCount} records from audit_log table`)
    console.log('🗑️  Deleting all audit log records...')

    // Delete all records
    const { error: deleteError } = await supabase
      .from('audit_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // This will match all records

    if (deleteError) {
      throw deleteError
    }

    // Verify deletion
    const { count: finalCount, error: finalCountError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    if (finalCountError) {
      throw finalCountError
    }

    console.log(`✅ Success! Deleted ${currentCount} records`)
    console.log(`📊 Remaining audit_log records: ${finalCount}`)
    
    if (finalCount === 0) {
      console.log('🎉 Audit log table has been cleared successfully!')
    } else {
      console.log(`⚠️  Warning: ${finalCount} records still remain`)
    }

  } catch (error) {
    console.error('❌ Error clearing audit log:', error.message)
    process.exit(1)
  }
}

// Run the script
clearAuditLog()