#!/usr/bin/env node

/**
 * Fix Inconsistent Completions Script
 * This script fixes task_instances that have status='done' but no active position completions
 * Run with: node scripts/fix-inconsistent-completions.js
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

async function fixInconsistentCompletions() {
  console.log('🔧 Fixing Inconsistent Task Completions...\n')

  // Find all tasks with status='done' but no active position completions
  const { data: completedTasks, error: tasksError } = await supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      completed_at,
      completed_by,
      master_task_id,
      master_tasks!inner(title)
    `)
    .eq('status', 'done')

  if (tasksError) {
    console.error('❌ Error fetching completed tasks:', tasksError)
    return
  }

  console.log(`📋 Found ${completedTasks.length} tasks with status='done'`)

  let tasksToFix = []

  // Check each task for active position completions
  for (const task of completedTasks) {
    const { data: activeCompletions, error: completionsError } = await supabase
      .from('task_position_completions')
      .select('id')
      .eq('task_instance_id', task.id)
      .eq('is_completed', true)

    if (completionsError) {
      console.error(`❌ Error checking completions for task ${task.id}:`, completionsError)
      continue
    }

    const activeCount = activeCompletions?.length || 0
    
    if (activeCount === 0) {
      tasksToFix.push(task)
      console.log(`  ⚠️  Task "${task.master_tasks.title}" (${task.due_date}) has status='done' but no active completions`)
    } else {
      console.log(`  ✅ Task "${task.master_tasks.title}" (${task.due_date}) has ${activeCount} active completions`)
    }
  }

  console.log(`\n🔧 Found ${tasksToFix.length} tasks that need fixing`)

  if (tasksToFix.length === 0) {
    console.log('✅ No inconsistent tasks found. All good!')
    return
  }

  // Ask for confirmation (in a real scenario, you might want to add this)
  console.log('\n📝 Tasks to be fixed:')
  tasksToFix.forEach((task, index) => {
    console.log(`  ${index + 1}. ${task.master_tasks.title} (${task.due_date}) - ID: ${task.id}`)
  })

  console.log('\n🔧 Proceeding with fixes...')

  // Fix each task
  let fixedCount = 0
  let errorCount = 0

  for (const task of tasksToFix) {
    try {
      // Determine appropriate status based on due date
      const today = new Date().toISOString().split('T')[0]
      const taskDueDate = task.due_date
      
      let newStatus = 'due_today'
      if (taskDueDate < today) {
        newStatus = 'overdue'
      } else if (taskDueDate > today) {
        newStatus = 'not_due'
      }

      // Update the task instance
      const { error: updateError } = await supabase
        .from('task_instances')
        .update({
          status: newStatus,
          completed_by: null,
          completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      if (updateError) {
        console.error(`❌ Error fixing task ${task.id}:`, updateError)
        errorCount++
      } else {
        console.log(`  ✅ Fixed: ${task.master_tasks.title} (${task.due_date}) - status changed from 'done' to '${newStatus}'`)
        fixedCount++
      }
    } catch (error) {
      console.error(`❌ Unexpected error fixing task ${task.id}:`, error)
      errorCount++
    }
  }

  console.log(`\n📊 Fix Summary:`)
  console.log(`  ✅ Successfully fixed: ${fixedCount} tasks`)
  console.log(`  ❌ Errors: ${errorCount} tasks`)
  console.log(`  📋 Total processed: ${tasksToFix.length} tasks`)

  if (fixedCount > 0) {
    console.log('\n🎉 Task completion statistics should now be accurate!')
    console.log('   The dashboard will show the correct number of completed tasks.')
  }

  console.log('\n✅ Fix completed!')
}

fixInconsistentCompletions().catch(console.error)