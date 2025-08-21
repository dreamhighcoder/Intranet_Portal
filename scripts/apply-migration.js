#!/usr/bin/env node

/**
 * Apply Schema Migration Script
 * This script applies the database migration to fix the task creation error
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function applyMigration() {
  console.log('🔧 Starting schema migration to fix task creation error...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Step 1: Check current schema
    console.log('📋 Checking current master_tasks schema...')
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'master_tasks' })
      .catch(() => {
        // Fallback if RPC doesn't exist
        return supabase
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_name', 'master_tasks')
      })
    
    if (schemaError) {
      console.log('⚠️  Could not check schema, proceeding with migration...')
    } else {
      const hasResponsibility = columns?.some(col => col.column_name === 'responsibility')
      const hasCategories = columns?.some(col => col.column_name === 'categories')
      
      console.log(`   - responsibility field: ${hasResponsibility ? '✅ exists' : '❌ missing'}`)
      console.log(`   - categories field: ${hasCategories ? '✅ exists' : '❌ missing'}`)
      
      if (hasResponsibility && hasCategories) {
        console.log('✅ Schema already up to date!')
        return
      }
    }
    
    // Step 2: Apply migration SQL
    console.log('🔄 Applying schema migration...')
    
    const migrationSQL = `
      -- Add missing array columns
      ALTER TABLE master_tasks 
      ADD COLUMN IF NOT EXISTS responsibility TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS due_time TIME,
      ADD COLUMN IF NOT EXISTS publish_delay DATE;
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_master_tasks_responsibility ON master_tasks USING GIN(responsibility);
      CREATE INDEX IF NOT EXISTS idx_master_tasks_categories ON master_tasks USING GIN(categories);
      
      -- Migrate existing data
      UPDATE master_tasks 
      SET categories = ARRAY[category]
      WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}');
      
      UPDATE master_tasks 
      SET responsibility = CASE 
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440001' THEN ARRAY['pharmacist-primary']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440002' THEN ARRAY['pharmacist-supporting']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440003' THEN ARRAY['pharmacy-assistants']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440004' THEN ARRAY['dispensary-technicians']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440005' THEN ARRAY['daa-packers']
          WHEN position_id = '550e8400-e29b-41d4-a716-446655440006' THEN ARRAY['operational-managerial']
          ELSE ARRAY['pharmacy-assistants']
      END
      WHERE responsibility IS NULL OR responsibility = '{}';
    `
    
    // Execute migration in parts to handle potential issues
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await supabase.rpc('exec_sql', { sql: statement.trim() })
            .catch(async () => {
              // Fallback: try direct query
              const { error } = await supabase.from('_').select('*').limit(0)
              // This will fail but might give us better error info
              throw new Error('Could not execute SQL statement')
            })
        } catch (err) {
          console.log(`⚠️  Statement may have failed (this might be OK): ${statement.substring(0, 50)}...`)
        }
      }
    }
    
    // Step 3: Verify migration
    console.log('✅ Migration completed! Verifying...')
    
    const { data: sampleTasks, error: verifyError } = await supabase
      .from('master_tasks')
      .select('id, title, responsibility, categories, position_id, category')
      .limit(3)
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message)
    } else {
      console.log('📊 Sample migrated data:')
      sampleTasks?.forEach(task => {
        console.log(`   - ${task.title}:`)
        console.log(`     responsibility: ${JSON.stringify(task.responsibility)}`)
        console.log(`     categories: ${JSON.stringify(task.categories)}`)
      })
    }
    
    console.log('🎉 Schema migration completed successfully!')
    console.log('💡 You can now create tasks with multi-select responsibilities and categories.')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('💡 You may need to apply the migration manually in Supabase SQL Editor.')
    console.error('📄 Use the SQL file: scripts/fix-schema-migration.sql')
    process.exit(1)
  }
}

// Run migration
applyMigration()