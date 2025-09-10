#!/usr/bin/env tsx

/**
 * Test script to verify that task statuses are consistent between:
 * 1. Checklist API
 * 2. Reports API
 * 3. Recent Missed Tasks component
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { getAustralianToday, formatAustralianDate, getAustralianNow } from '../lib/timezone-utils'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please check .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testStatusConsistency() {
  console.log('🧪 Testing Task Status Consistency')
  console.log('=====================================')
  
  const today = getAustralianToday()
  const yesterday = formatAustralianDate(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const threeDaysAgo = formatAustralianDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
  
  console.log(`📅 Testing dates: ${threeDaysAgo} to ${today}`)
  
  try {
    // Test 1: Get checklist data for admin (all positions)
    console.log('\n1️⃣ Testing Checklist API (admin mode)...')
    const checklistResponse = await fetch(`http://localhost:3001/api/checklist?role=admin&date=${today}&admin_mode=true`)
    const checklistData = await checklistResponse.json()
    
    console.log('Checklist API response status:', checklistResponse.status)
    console.log('Checklist API response:', JSON.stringify(checklistData, null, 2))
    
    if (!checklistData.data || !Array.isArray(checklistData.data)) {
      console.log('⚠️ Checklist API returned no data or invalid format')
      console.log('Continuing with other tests...')
    }
    
    let checklistStatuses = {}
    if (checklistData.data && Array.isArray(checklistData.data)) {
      checklistStatuses = checklistData.data.reduce((acc: any, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      }, {})
      console.log('✅ Checklist API status counts:', checklistStatuses)
    } else {
      console.log('⚠️ No checklist data to analyze')
    }
    
    // Test 2: Get reports data (task summary)
    console.log('\n2️⃣ Testing Reports API (task summary)...')
    const reportsResponse = await fetch(`http://localhost:3001/api/reports?type=task-summary&start_date=${threeDaysAgo}&end_date=${today}`)
    const reportsData = await reportsResponse.json()
    
    if (!reportsData.statusCounts) {
      console.log('❌ Reports API returned no status counts')
      return
    }
    
    console.log('✅ Reports API status counts:', reportsData.statusCounts)
    
    // Test 3: Get outstanding tasks (missed/overdue)
    console.log('\n3️⃣ Testing Reports API (outstanding tasks)...')
    const outstandingResponse = await fetch(`http://localhost:3001/api/reports?type=outstanding-tasks&start_date=${threeDaysAgo}&end_date=${today}`)
    const outstandingData = await outstandingResponse.json()
    
    console.log('✅ Outstanding tasks count:', outstandingData.totalOutstandingTasks || 0)
    
    // Test 4: Get missed tasks by position
    console.log('\n4️⃣ Testing Reports API (missed by position)...')
    const missedByPositionResponse = await fetch(`http://localhost:3001/api/reports?type=missed-by-position&start_date=${threeDaysAgo}&end_date=${today}`)
    const missedByPositionData = await missedByPositionResponse.json()
    
    console.log('✅ Missed by position:', missedByPositionData.positionStats || {})
    
    // Test 5: Compare consistency
    console.log('\n5️⃣ Consistency Analysis...')
    
    // Compare missed/overdue counts
    const checklistMissedOverdue = (checklistStatuses.missed || 0) + (checklistStatuses.overdue || 0)
    const reportsMissedOverdue = (reportsData.statusCounts.missed || 0) + (reportsData.statusCounts.overdue || 0)
    const outstandingCount = outstandingData.totalOutstandingTasks || 0
    
    console.log(`📊 Missed/Overdue comparison:`)
    console.log(`   Checklist API: ${checklistMissedOverdue}`)
    console.log(`   Reports API (summary): ${reportsMissedOverdue}`)
    console.log(`   Reports API (outstanding): ${outstandingCount}`)
    
    if (checklistMissedOverdue === reportsMissedOverdue && reportsMissedOverdue === outstandingCount) {
      console.log('✅ Missed/Overdue counts are CONSISTENT!')
    } else {
      console.log('❌ Missed/Overdue counts are INCONSISTENT!')
    }
    
    // Compare completed counts
    const checklistCompleted = checklistStatuses.completed || 0
    const reportsCompleted = reportsData.statusCounts.done || 0
    
    console.log(`📊 Completed comparison:`)
    console.log(`   Checklist API: ${checklistCompleted}`)
    console.log(`   Reports API: ${reportsCompleted}`)
    
    if (checklistCompleted === reportsCompleted) {
      console.log('✅ Completed counts are CONSISTENT!')
    } else {
      console.log('❌ Completed counts are INCONSISTENT!')
    }
    
    // Test 6: Check positions data
    console.log('\n6️⃣ Testing Position Data...')
    const positionsResponse = await fetch(`http://localhost:3001/api/positions`)
    const positionsData = await positionsResponse.json()
    
    const nonAdminPositions = positionsData.filter((p: any) => p.name !== 'Administrator')
    console.log('✅ Non-admin positions found:', nonAdminPositions.map((p: any) => p.name))
    
    const positionStatsKeys = Object.keys(missedByPositionData.positionStats || {})
    console.log('✅ Position stats keys:', positionStatsKeys)
    
    const missingPositions = nonAdminPositions.filter((p: any) => !positionStatsKeys.includes(p.name))
    if (missingPositions.length === 0) {
      console.log('✅ All positions are represented in missed tasks stats!')
    } else {
      console.log('⚠️ Missing positions in stats:', missingPositions.map((p: any) => p.name))
    }
    
    console.log('\n🎉 Status consistency test completed!')
    
  } catch (error) {
    console.error('❌ Error during testing:', error)
  }
}

// Run the test
testStatusConsistency().catch(console.error)