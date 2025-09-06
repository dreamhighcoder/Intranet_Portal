#!/usr/bin/env tsx

/**
 * Show Current Tasks Script
 * This script shows all master tasks currently in the database
 * Run with: tsx scripts/show-current-tasks.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function showCurrentTasks() {
  console.log('📋 Current Master Tasks in Database:\n')

  try {
    // Fetch all master tasks
    const { data: masterTasks, error } = await supabase
      .from('master_tasks')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error fetching master tasks:', error)
      return
    }

    if (!masterTasks || masterTasks.length === 0) {
      console.log('❌ No master tasks found in database')
      return
    }

    console.log(`Found ${masterTasks.length} master tasks:\n`)

    masterTasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.title}`)
      console.log(`   Description: ${task.description || 'No description'}`)
      console.log(`   Frequencies: ${task.frequencies ? task.frequencies.join(', ') : 'None'}`)
      console.log(`   Responsibility: ${task.responsibility ? task.responsibility.join(', ') : 'None'}`)
      console.log(`   Categories: ${task.categories ? task.categories.join(', ') : 'None'}`)
      console.log(`   Timing: ${task.timing || 'Not set'}`)
      console.log(`   Due Time: ${task.due_time || 'Not set'}`)
      console.log(`   Status: ${task.publish_status || 'Not set'}`)
      console.log(`   Start Date: ${task.start_date || 'Not set'}`)
      console.log(`   End Date: ${task.end_date || 'Not set'}`)
      console.log(`   Created: ${task.created_at}`)
      console.log('')
    })

    // Also show task instances for today
    const today = new Date().toISOString().split('T')[0]
    console.log(`📅 Task Instances for Today (${today}):\n`)

    const { data: instances, error: instanceError } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner(title, frequencies)
      `)
      .eq('instance_date', today)
      .order('due_time', { ascending: true })

    if (instanceError) {
      console.error('❌ Error fetching task instances:', instanceError)
      return
    }

    if (!instances || instances.length === 0) {
      console.log('❌ No task instances found for today')
    } else {
      instances.forEach((instance, index) => {
        console.log(`${index + 1}. ${instance.master_tasks.title}`)
        console.log(`   Status: ${instance.status}`)
        console.log(`   Due Date: ${instance.due_date}`)
        console.log(`   Due Time: ${instance.due_time}`)
        console.log(`   Frequencies: ${instance.master_tasks.frequencies ? instance.master_tasks.frequencies.join(', ') : 'None'}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
showCurrentTasks().catch(console.error)