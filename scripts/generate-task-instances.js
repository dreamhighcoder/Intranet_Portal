#!/usr/bin/env node

/**
 * Generate Task Instances Script
 * 
 * This script generates task instances from master tasks using the new recurrence engine
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function generateTaskInstances() {
  console.log('🔄 Generating task instances...')

  try {
    // Get all active master tasks
    const { data: masterTasks, error: tasksError } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('publish_status', 'active')

    if (tasksError) {
      throw new Error(`Failed to fetch master tasks: ${tasksError.message}`)
    }

    console.log(`Found ${masterTasks.length} active master tasks`)

    // Generate instances for the next 30 days
    const today = new Date()
    const instances = []

    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      for (const task of masterTasks) {
        // Simple logic for generating instances based on frequencies
        let shouldGenerate = false

        if (task.frequencies.includes('every_day')) {
          // Generate for every day except Sunday
          shouldGenerate = date.getDay() !== 0
        } else if (task.frequencies.includes('once_weekly')) {
          // Generate on Monday
          shouldGenerate = date.getDay() === 1
        } else if (task.frequencies.includes('start_of_every_month')) {
          // Generate on first day of month
          shouldGenerate = date.getDate() === 1
        } else if (task.frequencies.includes('end_of_every_month')) {
          // Generate on last day of month
          const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
          shouldGenerate = date.getDate() === nextMonth.getDate()
        } else if (task.frequencies.includes('monday')) {
          shouldGenerate = date.getDay() === 1
        } else if (task.frequencies.includes('tuesday')) {
          shouldGenerate = date.getDay() === 2
        } else if (task.frequencies.includes('wednesday')) {
          shouldGenerate = date.getDay() === 3
        } else if (task.frequencies.includes('thursday')) {
          shouldGenerate = date.getDay() === 4
        } else if (task.frequencies.includes('friday')) {
          shouldGenerate = date.getDay() === 5
        } else if (task.frequencies.includes('saturday')) {
          shouldGenerate = date.getDay() === 6
        }

        if (shouldGenerate) {
          instances.push({
            master_task_id: task.id,
            instance_date: dateStr,
            due_date: dateStr,
            due_time: task.due_time,
            status: 'pending',
            is_published: true
          })
        }
      }
    }

    console.log(`Generated ${instances.length} task instances`)

    // Insert instances in batches
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize)
      
      const { error } = await supabase
        .from('task_instances')
        .insert(batch)

      if (error) {
        console.warn(`Warning inserting batch ${i / batchSize + 1}:`, error.message)
      } else {
        inserted += batch.length
      }
    }

    console.log(`✅ Successfully inserted ${inserted} task instances`)

    // Verify results
    const { data: taskInstances } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner(title, responsibility)
      `)
      .gte('instance_date', today.toISOString().split('T')[0])

    console.log(`Total task instances from today: ${taskInstances?.length || 0}`)

    // Group by responsibility
    const byResp = {}
    taskInstances?.forEach(instance => {
      instance.master_tasks.responsibility.forEach(resp => {
        byResp[resp] = (byResp[resp] || 0) + 1
      })
    })

    console.log('\nTask instances by responsibility:')
    Object.keys(byResp).sort().forEach(resp => {
      console.log(`  ${resp}: ${byResp[resp]} instances`)
    })

    console.log('\n🎉 Task generation completed successfully!')

  } catch (error) {
    console.error('❌ Error generating task instances:', error.message)
    process.exit(1)
  }
}

generateTaskInstances()