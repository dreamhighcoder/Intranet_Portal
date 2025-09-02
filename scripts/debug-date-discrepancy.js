#!/usr/bin/env node

/**
 * Debug Date Discrepancy Script
 * This script compares due_date vs instance_date filtering
 * Run with: node scripts/debug-date-discrepancy.js
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

async function debugDateDiscrepancy() {
  console.log('🔍 Debugging Date Discrepancy (due_date vs instance_date)...\n')

  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  console.log(`📅 Dates:`)
  console.log(`  Today: ${todayStr}`)
  console.log(`  Yesterday: ${yesterdayStr}`)
  console.log()

  // Fetch ALL task instances with both due_date and instance_date
  const { data: allTasks, error } = await supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      instance_date,
      due_time,
      completed_at,
      created_at,
      master_task_id,
      master_tasks!inner(
        title,
        responsibility,
        categories
      )
    `)
    .order('due_date', { ascending: false })

  if (error) {
    console.error('❌ Error fetching tasks:', error)
    return
  }

  console.log(`📊 Total task instances in database: ${allTasks.length}`)
  console.log()

  // Filter completed tasks
  const completedTasks = allTasks.filter(task => task.status === 'done')
  console.log(`✅ Total completed tasks: ${completedTasks.length}`)
  console.log()

  // Analyze by due_date (Dashboard API logic)
  console.log('🎯 DASHBOARD API LOGIC (filters by due_date):')
  const completedByDueDate = {}
  completedTasks.forEach(task => {
    const dueDate = task.due_date
    if (!completedByDueDate[dueDate]) {
      completedByDueDate[dueDate] = []
    }
    completedByDueDate[dueDate].push(task)
  })

  Object.keys(completedByDueDate)
    .sort((a, b) => b.localeCompare(a))
    .forEach(date => {
      const tasks = completedByDueDate[date]
      const isToday = date === todayStr
      const isYesterday = date === yesterdayStr
      
      let dateLabel = date
      if (isToday) dateLabel += ' (TODAY)'
      if (isYesterday) dateLabel += ' (YESTERDAY)'
      
      console.log(`  Due ${dateLabel}: ${tasks.length} completed tasks`)
      tasks.forEach(task => {
        const completedAt = task.completed_at 
          ? new Date(task.completed_at).toLocaleString()
          : 'No timestamp'
        console.log(`    - ${task.master_tasks.title} (instance_date: ${task.instance_date}, completed: ${completedAt})`)
      })
    })

  console.log()

  // Analyze by instance_date (Checklist API logic)
  console.log('📋 CHECKLIST API LOGIC (filters by instance_date):')
  const completedByInstanceDate = {}
  completedTasks.forEach(task => {
    const instanceDate = task.instance_date
    if (!completedByInstanceDate[instanceDate]) {
      completedByInstanceDate[instanceDate] = []
    }
    completedByInstanceDate[instanceDate].push(task)
  })

  Object.keys(completedByInstanceDate)
    .sort((a, b) => b.localeCompare(a))
    .forEach(date => {
      const tasks = completedByInstanceDate[date]
      const isToday = date === todayStr
      const isYesterday = date === yesterdayStr
      
      let dateLabel = date
      if (isToday) dateLabel += ' (TODAY)'
      if (isYesterday) dateLabel += ' (YESTERDAY)'
      
      console.log(`  Instance ${dateLabel}: ${tasks.length} completed tasks`)
      tasks.forEach(task => {
        const completedAt = task.completed_at 
          ? new Date(task.completed_at).toLocaleString()
          : 'No timestamp'
        console.log(`    - ${task.master_tasks.title} (due_date: ${task.due_date}, completed: ${completedAt})`)
      })
    })

  console.log()

  // Compare the two approaches
  const dashboardCount = (completedByDueDate[todayStr] || []).length + (completedByDueDate[yesterdayStr] || []).length
  const checklistTodayCount = (completedByInstanceDate[todayStr] || []).length
  const checklistYesterdayCount = (completedByInstanceDate[yesterdayStr] || []).length
  const checklistTotalCount = checklistTodayCount + checklistYesterdayCount

  console.log('📈 COMPARISON:')
  console.log(`  Dashboard API (due_date filter): ${dashboardCount} tasks (today + yesterday)`)
  console.log(`    - Due today: ${(completedByDueDate[todayStr] || []).length}`)
  console.log(`    - Due yesterday: ${(completedByDueDate[yesterdayStr] || []).length}`)
  console.log()
  console.log(`  Checklist API (instance_date filter): ${checklistTotalCount} tasks (today + yesterday)`)
  console.log(`    - Instance today: ${checklistTodayCount}`)
  console.log(`    - Instance yesterday: ${checklistYesterdayCount}`)
  console.log()

  // Check for mismatches
  console.log('🔍 MISMATCH ANALYSIS:')
  const mismatchedTasks = completedTasks.filter(task => task.due_date !== task.instance_date)
  if (mismatchedTasks.length > 0) {
    console.log(`  ⚠️  ${mismatchedTasks.length} tasks have different due_date and instance_date:`)
    mismatchedTasks.forEach(task => {
      console.log(`    - ${task.master_tasks.title}: instance_date=${task.instance_date}, due_date=${task.due_date}`)
    })
  } else {
    console.log(`  ✅ All tasks have matching due_date and instance_date`)
  }

  console.log()

  // Final explanation
  console.log('💡 EXPLANATION:')
  if (dashboardCount === 4 && checklistTotalCount === 7) {
    console.log('  The discrepancy is likely because:')
    console.log('  1. Dashboard counts tasks by due_date (when they were supposed to be done)')
    console.log('  2. Checklist counts tasks by instance_date (when they were assigned/available)')
    console.log('  3. Some tasks may have been carried over or rescheduled')
  } else {
    console.log(`  Dashboard shows: ${dashboardCount} completed tasks`)
    console.log(`  Checklist shows: ${checklistTotalCount} completed tasks`)
    console.log('  The difference needs further investigation.')
  }

  console.log('\n✅ Date discrepancy analysis completed!')
}

debugDateDiscrepancy().catch(console.error)