#!/usr/bin/env node

/**
 * Debug Position Completions Script
 * This script checks the task_position_completions table to see if tasks are actually unmarked
 * Run with: node scripts/debug-position-completions.js
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

async function debugPositionCompletions() {
  console.log('🔍 Debugging Position Completions...\n')

  // First, get the 4 completed tasks from yesterday
  const { data: completedTasks, error: tasksError } = await supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      completed_at,
      master_task_id,
      master_tasks!inner(title)
    `)
    .eq('status', 'done')
    .eq('due_date', '2025-09-01')

  if (tasksError) {
    console.error('❌ Error fetching completed tasks:', tasksError)
    return
  }

  console.log(`📋 Found ${completedTasks.length} completed tasks from yesterday:`)
  completedTasks.forEach((task, index) => {
    console.log(`  ${index + 1}. ${task.master_tasks.title} (ID: ${task.id})`)
  })
  console.log()

  // Now check position completions for each task
  for (const task of completedTasks) {
    console.log(`🔍 Checking position completions for: ${task.master_tasks.title}`)
    
    const { data: completions, error: completionsError } = await supabase
      .from('task_position_completions')
      .select(`
        id,
        position_name,
        is_completed,
        completed_at,
        uncompleted_at,
        updated_at
      `)
      .eq('task_instance_id', task.id)
      .order('updated_at', { ascending: false })

    if (completionsError) {
      console.error(`  ❌ Error fetching completions:`, completionsError)
      continue
    }

    if (!completions || completions.length === 0) {
      console.log(`  ⚠️  No position completions found (this might be the issue!)`)
    } else {
      console.log(`  📊 Position completions (${completions.length} records):`)
      completions.forEach(completion => {
        const status = completion.is_completed ? '✅ COMPLETED' : '❌ NOT COMPLETED'
        const completedAt = completion.completed_at ? new Date(completion.completed_at).toLocaleString() : 'N/A'
        const uncompletedAt = completion.uncompleted_at ? new Date(completion.uncompleted_at).toLocaleString() : 'N/A'
        
        console.log(`    - ${completion.position_name}: ${status}`)
        console.log(`      Completed: ${completedAt}`)
        console.log(`      Uncompleted: ${uncompletedAt}`)
        console.log(`      Last updated: ${new Date(completion.updated_at).toLocaleString()}`)
      })
    }
    console.log()
  }

  // Summary analysis
  console.log('📈 Summary Analysis:')
  
  let totalActiveCompletions = 0
  let tasksWithActiveCompletions = 0
  
  for (const task of completedTasks) {
    const { data: activeCompletions } = await supabase
      .from('task_position_completions')
      .select('id')
      .eq('task_instance_id', task.id)
      .eq('is_completed', true)

    const activeCount = activeCompletions?.length || 0
    totalActiveCompletions += activeCount
    
    if (activeCount > 0) {
      tasksWithActiveCompletions++
    }
  }

  console.log(`  Total tasks with status = 'done': ${completedTasks.length}`)
  console.log(`  Tasks with active position completions: ${tasksWithActiveCompletions}`)
  console.log(`  Total active position completions: ${totalActiveCompletions}`)
  
  if (tasksWithActiveCompletions === 0) {
    console.log('\n💡 ISSUE IDENTIFIED:')
    console.log('  All tasks have status = "done" but NO active position completions!')
    console.log('  This means the tasks were marked as completed but the position completion')
    console.log('  records were either never created or were properly unmarked.')
    console.log('  The task_instances.status should be updated to reflect this.')
  } else if (tasksWithActiveCompletions < completedTasks.length) {
    console.log('\n💡 PARTIAL ISSUE IDENTIFIED:')
    console.log('  Some tasks have status = "done" but no active position completions.')
    console.log('  These tasks should have their status updated.')
  } else {
    console.log('\n✅ NO ISSUE FOUND:')
    console.log('  All completed tasks have corresponding active position completions.')
    console.log('  The statistics are correct based on the current data.')
  }

  console.log('\n✅ Debug analysis completed!')
}

debugPositionCompletions().catch(console.error)