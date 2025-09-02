#!/usr/bin/env node

/**
 * Debug Completed Tasks Script
 * This script analyzes the completed tasks data to understand the discrepancy
 * Run with: node scripts/debug-completed-tasks.js
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

async function debugCompletedTasks() {
  console.log('🔍 Debugging Completed Tasks Discrepancy...\n')

  // Calculate the same date range as the dashboard API
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 7) // Last 7 days

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  console.log(`📅 Date Range Analysis:`)
  console.log(`  Today: ${todayStr}`)
  console.log(`  Yesterday: ${yesterdayStr}`)
  console.log(`  7-day range: ${startDateStr} to ${endDateStr}`)
  console.log()

  // Fetch all task instances in the 7-day range (same as dashboard API)
  const { data: allTasks, error } = await supabase
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

  console.log(`📊 Total tasks in 7-day range: ${allTasks.length}`)
  console.log()

  // Filter completed tasks (same logic as dashboard API)
  const completedTasks = allTasks.filter(task => task.status === 'done')
  
  console.log(`✅ Completed tasks (status = 'done'): ${completedTasks.length}`)
  console.log()

  // Break down by date
  const tasksByDate = {}
  completedTasks.forEach(task => {
    const dueDate = task.due_date
    if (!tasksByDate[dueDate]) {
      tasksByDate[dueDate] = []
    }
    tasksByDate[dueDate].push(task)
  })

  console.log('📋 Completed Tasks Breakdown by Due Date:')
  Object.keys(tasksByDate)
    .sort((a, b) => b.localeCompare(a)) // Most recent first
    .forEach(date => {
      const tasks = tasksByDate[date]
      const isToday = date === todayStr
      const isYesterday = date === yesterdayStr
      
      let dateLabel = date
      if (isToday) dateLabel += ' (TODAY)'
      if (isYesterday) dateLabel += ' (YESTERDAY)'
      
      console.log(`\n  ${dateLabel}: ${tasks.length} tasks`)
      tasks.forEach(task => {
        const completedAt = task.completed_at 
          ? new Date(task.completed_at).toLocaleString()
          : 'No timestamp'
        console.log(`    - ${task.master_tasks.title} (completed: ${completedAt})`)
      })
    })

  // Check if there are tasks completed on other days
  const todayCompleted = completedTasks.filter(task => task.due_date === todayStr)
  const yesterdayCompleted = completedTasks.filter(task => task.due_date === yesterdayStr)
  const otherDaysCompleted = completedTasks.filter(task => 
    task.due_date !== todayStr && task.due_date !== yesterdayStr
  )

  console.log('\n📈 Summary:')
  console.log(`  Today (${todayStr}): ${todayCompleted.length} completed`)
  console.log(`  Yesterday (${yesterdayStr}): ${yesterdayCompleted.length} completed`)
  console.log(`  Other days in range: ${otherDaysCompleted.length} completed`)
  console.log(`  Total: ${completedTasks.length} completed`)

  if (otherDaysCompleted.length > 0) {
    console.log('\n  Other days breakdown:')
    const otherDaysByDate = {}
    otherDaysCompleted.forEach(task => {
      const date = task.due_date
      if (!otherDaysByDate[date]) otherDaysByDate[date] = 0
      otherDaysByDate[date]++
    })
    Object.entries(otherDaysByDate).forEach(([date, count]) => {
      console.log(`    ${date}: ${count} tasks`)
    })
  }

  // Check for potential issues
  console.log('\n🔍 Potential Issues:')
  
  // Check for tasks without completed_at timestamps
  const completedWithoutTimestamp = completedTasks.filter(task => !task.completed_at)
  if (completedWithoutTimestamp.length > 0) {
    console.log(`  ⚠️  ${completedWithoutTimestamp.length} completed tasks missing completed_at timestamp`)
  }

  // Check for tasks completed on different dates than due dates
  const completedOnDifferentDate = completedTasks.filter(task => {
    if (!task.completed_at) return false
    const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
    return completedDate !== task.due_date
  })
  
  if (completedOnDifferentDate.length > 0) {
    console.log(`  ℹ️  ${completedOnDifferentDate.length} tasks completed on different date than due date`)
    completedOnDifferentDate.forEach(task => {
      const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
      console.log(`    - ${task.master_tasks.title}: due ${task.due_date}, completed ${completedDate}`)
    })
  }

  // Expected vs Actual
  const expectedFromChecklist = 3 + 4 // 3 today + 4 yesterday
  const actualFromAPI = completedTasks.length

  console.log('\n🎯 Discrepancy Analysis:')
  console.log(`  Expected (from checklist): ${expectedFromChecklist} (3 today + 4 yesterday)`)
  console.log(`  Actual (from API): ${actualFromAPI}`)
  console.log(`  Difference: ${actualFromAPI - expectedFromChecklist}`)

  if (actualFromAPI !== expectedFromChecklist) {
    console.log('\n💡 Possible Explanations:')
    if (actualFromAPI < expectedFromChecklist) {
      console.log('  - Some completed tasks might not have status = "done"')
      console.log('  - Some tasks might be outside the 7-day due_date range')
      console.log('  - Database sync issues')
    } else {
      console.log('  - There are completed tasks from other days in the 7-day range')
      console.log('  - Some tasks might be counted twice')
      console.log('  - The checklist view might be filtered differently')
    }
  }

  console.log('\n✅ Debug analysis completed!')
}

debugCompletedTasks().catch(console.error)