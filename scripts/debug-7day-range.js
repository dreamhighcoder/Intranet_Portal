#!/usr/bin/env node

/**
 * Debug 7-Day Range Script
 * This script shows exactly what the dashboard API should be counting
 * Run with: node scripts/debug-7day-range.js
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

async function debug7DayRange() {
  console.log('🔍 Debugging 7-Day Range (Dashboard API Logic)...\n')

  // Exact same logic as dashboard API
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 7) // Last 7 days

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  console.log(`📅 Dashboard API 7-Day Range:`)
  console.log(`  Start: ${startDateStr}`)
  console.log(`  End: ${endDateStr}`)
  console.log(`  Query: WHERE due_date >= '${startDateStr}' AND due_date <= '${endDateStr}'`)
  console.log()

  // Fetch tasks exactly like dashboard API
  const { data: tasks, error } = await supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      due_time,
      instance_date,
      completed_at,
      created_at,
      master_task_id,
      master_tasks!inner(
        title,
        responsibility,
        categories
      )
    `)
    .gte('due_date', startDateStr)
    .lte('due_date', endDateStr)
    .order('due_date', { ascending: false })

  if (error) {
    console.error('❌ Error fetching tasks:', error)
    return
  }

  console.log(`📊 Tasks in 7-day range: ${tasks.length}`)
  console.log()

  // Show all tasks by status
  const tasksByStatus = {}
  tasks.forEach(task => {
    if (!tasksByStatus[task.status]) {
      tasksByStatus[task.status] = []
    }
    tasksByStatus[task.status].push(task)
  })

  console.log('📋 Tasks by Status:')
  Object.entries(tasksByStatus).forEach(([status, statusTasks]) => {
    console.log(`  ${status}: ${statusTasks.length} tasks`)
    statusTasks.forEach(task => {
      const completedAt = task.completed_at 
        ? new Date(task.completed_at).toLocaleString()
        : 'Not completed'
      console.log(`    - ${task.master_tasks.title} (due: ${task.due_date}, completed: ${completedAt})`)
    })
  })

  console.log()

  // Calculate KPIs exactly like dashboard API
  const allTasks = tasks
  const completedTasks = allTasks.filter(task => task.status === 'done')
  const missedTasks = allTasks.filter(task => task.status === 'missed')
  const overdueTasks = allTasks.filter(task => task.status === 'overdue')

  console.log('🎯 Dashboard KPI Calculations:')
  console.log(`  Total tasks in range: ${allTasks.length}`)
  console.log(`  Completed tasks (status = 'done'): ${completedTasks.length}`)
  console.log(`  Missed tasks (status = 'missed'): ${missedTasks.length}`)
  console.log(`  Overdue tasks (status = 'overdue'): ${overdueTasks.length}`)
  console.log()

  // On-time completion rate
  const onTimeCompletions = completedTasks.filter(task => {
    if (!task.completed_at) return false
    const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
    return completedDate <= task.due_date
  })

  const onTimeCompletionRate = completedTasks.length > 0 
    ? Math.round((onTimeCompletions.length / completedTasks.length) * 100 * 100) / 100
    : 0

  console.log('📈 KPI Values:')
  console.log(`  On-Time Completion Rate: ${onTimeCompletionRate}%`)
  console.log(`  Average Time to Complete: [calculated from ${completedTasks.filter(t => t.completed_at && t.instance_date).length} tasks with timestamps]`)
  console.log(`  Missed Tasks (7 days): ${missedTasks.length}`)
  console.log(`  Total Completed Tasks (7 days): ${completedTasks.length}`)
  console.log()

  // Show what should appear in dashboard
  console.log('🎯 EXPECTED DASHBOARD VALUES:')
  console.log(`  "Total Completed Tasks (7 days)" should show: ${completedTasks.length}`)
  console.log()

  // Break down completed tasks by date for clarity
  if (completedTasks.length > 0) {
    console.log('📅 Completed Tasks by Due Date:')
    const completedByDate = {}
    completedTasks.forEach(task => {
      const date = task.due_date
      if (!completedByDate[date]) {
        completedByDate[date] = []
      }
      completedByDate[date].push(task)
    })

    Object.keys(completedByDate)
      .sort((a, b) => b.localeCompare(a))
      .forEach(date => {
        const dateTasks = completedByDate[date]
        console.log(`    ${date}: ${dateTasks.length} completed tasks`)
      })
  }

  console.log('\n✅ 7-day range analysis completed!')
}

debug7DayRange().catch(console.error)