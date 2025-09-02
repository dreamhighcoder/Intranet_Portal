#!/usr/bin/env tsx

/**
 * Generate Real Tasks Script
 * This script removes mock data and generates real task instances
 * Run with: tsx scripts/generate-real-tasks.ts
 */

import { createClient } from '@supabase/supabase-js'
import { runNewDailyGeneration } from '../lib/new-task-generator'
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

async function generateRealTasks() {
  console.log('🧹 Cleaning mock data and generating real tasks...\n')

  try {
    // Step 1: Remove mock task instances
    console.log('1️⃣ Removing mock task instances...')
    
    const { data: mockTasks, error: fetchError } = await supabase
      .from('task_instances')
      .select('id, master_task_id, master_tasks!inner(title)')
      .in('master_tasks.title', [
        'Daily Register Check',
        'Daily Temperature Log', 
        'Weekly Safety Review',
        'Monthly Inventory Count'
      ])

    if (fetchError) {
      console.error('❌ Error fetching mock tasks:', fetchError)
      return
    }

    if (mockTasks && mockTasks.length > 0) {
      const { error: deleteError } = await supabase
        .from('task_instances')
        .delete()
        .in('id', mockTasks.map(t => t.id))

      if (deleteError) {
        console.error('❌ Error deleting mock tasks:', deleteError)
        return
      }

      console.log(`✅ Removed ${mockTasks.length} mock task instances`)
    } else {
      console.log('✅ No mock task instances found')
    }

    // Step 2: Generate real tasks for the last 7 days and next 7 days
    console.log('\n2️⃣ Generating real task instances...')
    
    const today = new Date()
    const results = []

    // Generate for last 7 days (to have some historical data)
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      console.log(`   Generating tasks for ${dateStr}...`)
      
      const result = await runNewDailyGeneration(dateStr, {
        testMode: false,
        dryRun: false,
        forceRegenerate: true
      })
      
      results.push({ date: dateStr, ...result })
    }

    // Generate for next 7 days (future tasks)
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      console.log(`   Generating tasks for ${dateStr}...`)
      
      const result = await runNewDailyGeneration(dateStr, {
        testMode: false,
        dryRun: false,
        forceRegenerate: true
      })
      
      results.push({ date: dateStr, ...result })
    }

    // Step 3: Summary
    console.log('\n📊 Generation Summary:')
    let totalGenerated = 0
    let totalErrors = 0

    results.forEach(result => {
      console.log(`   ${result.date}: ${result.totalInstances} tasks (${result.newInstances} new, ${result.carryInstances} carried)`)
      totalGenerated += result.totalInstances
      totalErrors += result.errors
    })

    console.log(`\n✅ Total: ${totalGenerated} task instances generated`)
    if (totalErrors > 0) {
      console.log(`⚠️  Errors: ${totalErrors}`)
    }

    // Step 4: Verify data
    console.log('\n3️⃣ Verifying generated data...')
    
    const { data: verifyTasks, error: verifyError } = await supabase
      .from('task_instances')
      .select('status, due_date')
      .gte('due_date', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('due_date', new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError)
      return
    }

    const statusCounts = verifyTasks?.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    console.log('📈 Task status breakdown:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`)
    })

    console.log('\n🎉 Real task generation completed!')
    console.log('\n💡 Next steps:')
    console.log('   1. Check your admin dashboard - KPIs should now show real data')
    console.log('   2. Use the checklist to complete some tasks')
    console.log('   3. KPIs will update based on actual task completion')

  } catch (error) {
    console.error('❌ Error generating real tasks:', error)
    process.exit(1)
  }
}

// Run the script
generateRealTasks().catch(console.error)