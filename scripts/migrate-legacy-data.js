#!/usr/bin/env node

/**
 * Migration script to populate new array fields (responsibility, categories) 
 * from legacy single fields (position_id, category)
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Mapping from position IDs to responsibility values
const positionToResponsibilityMap = {
  '550e8400-e29b-41d4-a716-446655440001': ['pharmacist-primary'],
  '550e8400-e29b-41d4-a716-446655440002': ['pharmacist-supporting'],
  '550e8400-e29b-41d4-a716-446655440003': ['pharmacy-assistants'],
  '550e8400-e29b-41d4-a716-446655440004': ['dispensary-technicians'],
  '550e8400-e29b-41d4-a716-446655440005': ['daa-packers'],
  '550e8400-e29b-41d4-a716-446655440006': ['operational-managerial']
}

// Mapping from legacy category names to new category values
const categoryMapping = {
  'Compliance': 'compliance',
  'Security': 'compliance',
  'Inventory': 'stock-control',
  'Customer Service': 'pharmacy-services',
  'Maintenance': 'cleaning',
  'Training': 'business-management',
  'Administration': 'business-management',
  'General': 'general-pharmacy-operations',
  'Stock Control': 'stock-control',
  'Cleaning': 'cleaning',
  'Pharmacy Services': 'pharmacy-services',
  'FOS Operations': 'fos-operations',
  'Dispensary Operations': 'dispensary-operations',
  'General Pharmacy Operations': 'general-pharmacy-operations',
  'Business Management': 'business-management'
}

async function migrateLegacyData() {
  console.log('Starting legacy data migration...')
  
  try {
    // First, check if the new columns exist
    const { data: columns, error: columnError } = await supabase
      .rpc('get_table_columns', { table_name: 'master_tasks' })
    
    if (columnError) {
      console.log('Could not check columns, proceeding with migration...')
    }
    
    // Fetch all master tasks
    const { data: tasks, error: fetchError } = await supabase
      .from('master_tasks')
      .select('*')
    
    if (fetchError) {
      console.error('Error fetching tasks:', fetchError)
      return
    }
    
    console.log(`Found ${tasks.length} tasks to potentially migrate`)
    
    let migratedCount = 0
    let skippedCount = 0
    
    for (const task of tasks) {
      let needsUpdate = false
      const updates = {}
      
      // Migrate responsibility from position_id
      if (task.position_id && (!task.responsibility || task.responsibility.length === 0)) {
        const responsibility = positionToResponsibilityMap[task.position_id]
        if (responsibility) {
          updates.responsibility = responsibility
          needsUpdate = true
          console.log(`Task "${task.title}": Adding responsibility ${responsibility[0]} from position_id`)
        }
      }
      
      // Migrate categories from category
      if (task.category && (!task.categories || task.categories.length === 0)) {
        const mappedCategory = categoryMapping[task.category] || task.category.toLowerCase().replace(/\s+/g, '-')
        updates.categories = [mappedCategory]
        needsUpdate = true
        console.log(`Task "${task.title}": Adding category ${mappedCategory} from legacy category "${task.category}"`)
      }
      
      // Update the task if needed
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('master_tasks')
          .update(updates)
          .eq('id', task.id)
        
        if (updateError) {
          console.error(`Error updating task "${task.title}":`, updateError)
        } else {
          migratedCount++
          console.log(`✓ Migrated task: "${task.title}"`)
        }
      } else {
        skippedCount++
      }
    }
    
    console.log('\nMigration completed!')
    console.log(`- Migrated: ${migratedCount} tasks`)
    console.log(`- Skipped: ${skippedCount} tasks (already have new format data)`)
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Run the migration
migrateLegacyData()