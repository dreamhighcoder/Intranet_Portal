#!/usr/bin/env tsx

/**
 * Simple Test Script for New Recurrence Engine Logic
 * 
 * This script tests the core recurrence logic without requiring database access.
 */

import { NewRecurrenceEngine, NewFrequencyType, TaskStatus, type MasterTask } from '../lib/new-recurrence-engine'

// Mock Holiday Checker for testing
class MockHolidayChecker {
  private holidays = new Set([
    '2024-01-01', // New Year's Day
    '2024-01-26', // Australia Day
    '2024-03-29', // Good Friday
    '2024-04-01', // Easter Monday
    '2024-04-25', // ANZAC Day
    '2024-12-25', // Christmas Day
    '2024-12-26'  // Boxing Day
  ])

  isHolidaySync(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    return this.holidays.has(dateStr)
  }

  isBusinessDaySync(date: Date): boolean {
    const day = date.getDay()
    return day !== 0 && day !== 6 && !this.isHolidaySync(date) // Not Sunday, Saturday, or holiday
  }

  nextBusinessDaySync(date: Date): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    while (!this.isBusinessDaySync(next)) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  previousBusinessDaySync(date: Date): Date {
    const prev = new Date(date)
    prev.setDate(prev.getDate() - 1)
    while (!this.isBusinessDaySync(prev)) {
      prev.setDate(prev.getDate() - 1)
    }
    return prev
  }
}

// Create test master tasks
const testTasks: MasterTask[] = [
  {
    id: 'test-once-off',
    title: 'Test Once Off Task',
    active: true,
    frequencies: [NewFrequencyType.ONCE_OFF],
    timing: '09:30',
    due_date: '2024-01-15'
  },
  {
    id: 'test-every-day',
    title: 'Test Every Day Task',
    active: true,
    frequencies: [NewFrequencyType.EVERY_DAY],
    timing: '16:30'
  },
  {
    id: 'test-once-weekly',
    title: 'Test Once Weekly Task',
    active: true,
    frequencies: [NewFrequencyType.ONCE_WEEKLY],
    timing: '17:00'
  },
  {
    id: 'test-monday',
    title: 'Test Monday Task',
    active: true,
    frequencies: [NewFrequencyType.MONDAY],
    timing: '09:30'
  }
]

function runTests() {
  console.log('🧪 Starting New Recurrence Engine Logic Tests...\n')
  
  // Initialize the engine with mock holiday checker
  const holidayChecker = new MockHolidayChecker() as any
  const engine = new NewRecurrenceEngine(holidayChecker)
  
  let totalTests = 0
  let passedTests = 0
  
  // Test 1: Once Off Task Generation
  console.log('📋 Test 1: Once Off Task Generation')
  totalTests++
  try {
    const result = engine.generateInstancesForDate([testTasks[0]], '2024-01-10')
    
    if (result.instances.length === 1 && result.instances[0].due_date === '2024-01-15') {
      console.log('✅ Once off task generated correctly')
      console.log(`   Instance ID: ${result.instances[0].id}`)
      console.log(`   Due Date: ${result.instances[0].due_date}`)
      passedTests++
    } else {
      console.log('❌ Once off task generation failed')
      console.log('Expected: 1 instance with due_date 2024-01-15')
      console.log('Got:', result.instances.map(i => ({ id: i.id, due_date: i.due_date })))
    }
  } catch (error) {
    console.log('❌ Once off task generation threw error:', error)
  }
  console.log()
  
  // Test 2: Every Day Task Generation (excluding Sundays and PHs)
  console.log('📋 Test 2: Every Day Task Generation')
  totalTests++
  try {
    // Test on a Monday (should generate)
    const mondayResult = engine.generateInstancesForDate([testTasks[1]], '2024-01-08') // Monday
    // Test on a Sunday (should not generate)
    const sundayResult = engine.generateInstancesForDate([testTasks[1]], '2024-01-07') // Sunday
    // Test on a holiday (should not generate)
    const holidayResult = engine.generateInstancesForDate([testTasks[1]], '2024-01-01') // New Year's Day
    
    if (mondayResult.instances.length === 1 && 
        sundayResult.instances.length === 0 && 
        holidayResult.instances.length === 0) {
      console.log('✅ Every day task generation works correctly')
      console.log(`   Monday instances: ${mondayResult.instances.length}`)
      console.log(`   Sunday instances: ${sundayResult.instances.length}`)
      console.log(`   Holiday instances: ${holidayResult.instances.length}`)
      passedTests++
    } else {
      console.log('❌ Every day task generation failed')
      console.log('Monday instances:', mondayResult.instances.length)
      console.log('Sunday instances:', sundayResult.instances.length)
      console.log('Holiday instances:', holidayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Every day task generation threw error:', error)
  }
  console.log()
  
  // Test 3: Once Weekly Task Generation
  console.log('📋 Test 3: Once Weekly Task Generation')
  totalTests++
  try {
    // Test on a Monday (should generate)
    const mondayResult = engine.generateInstancesForDate([testTasks[2]], '2024-01-08') // Monday
    
    if (mondayResult.instances.length === 1) {
      console.log('✅ Once weekly task generation works correctly')
      console.log(`   Monday instances: ${mondayResult.instances.length}`)
      console.log(`   Due date: ${mondayResult.instances[0].due_date}`)
      passedTests++
    } else {
      console.log('❌ Once weekly task generation failed')
      console.log('Monday instances:', mondayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Once weekly task generation threw error:', error)
  }
  console.log()
  
  // Test 4: Specific Weekday Task Generation
  console.log('📋 Test 4: Specific Weekday (Monday) Task Generation')
  totalTests++
  try {
    // Test on a Monday (should generate)
    const mondayResult = engine.generateInstancesForDate([testTasks[3]], '2024-01-08') // Monday
    // Test on a Tuesday (should not generate new)
    const tuesdayResult = engine.generateInstancesForDate([testTasks[3]], '2024-01-09') // Tuesday
    
    if (mondayResult.instances.length === 1 && tuesdayResult.instances.length === 0) {
      console.log('✅ Specific weekday task generation works correctly')
      console.log(`   Monday instances: ${mondayResult.instances.length}`)
      console.log(`   Tuesday instances: ${tuesdayResult.instances.length}`)
      passedTests++
    } else {
      console.log('❌ Specific weekday task generation failed')
      console.log('Monday instances:', mondayResult.instances.length)
      console.log('Tuesday instances:', tuesdayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Specific weekday task generation threw error:', error)
  }
  console.log()
  
  // Test 5: Status Updates
  console.log('📋 Test 5: Status Updates')
  totalTests++
  try {
    // Create a test instance that should be overdue
    const testInstance = {
      id: 'test-instance-1',
      master_task_id: 'test-every-day',
      date: '2024-01-08',
      due_date: '2024-01-08',
      due_time: '09:00',
      status: TaskStatus.PENDING,
      locked: false,
      created_at: '2024-01-08T08:00:00Z',
      updated_at: '2024-01-08T08:00:00Z'
    }
    
    // Test status update at 10:00 (should be overdue)
    const currentTime = new Date('2024-01-08T10:00:00+11:00') // 10 AM Sydney time
    const statusResult = engine.updateInstanceStatuses([testInstance], currentTime, testTasks)
    
    if (statusResult.updates.length === 1 && statusResult.updates[0].new_status === TaskStatus.OVERDUE) {
      console.log('✅ Status updates work correctly')
      console.log(`   Status changed from ${statusResult.updates[0].old_status} to ${statusResult.updates[0].new_status}`)
      passedTests++
    } else {
      console.log('❌ Status updates failed')
      console.log('Updates:', statusResult.updates.map(u => ({ 
        old: u.old_status, 
        new: u.new_status, 
        reason: u.reason 
      })))
    }
  } catch (error) {
    console.log('❌ Status updates threw error:', error)
  }
  console.log()
  
  // Test 6: Holiday Behavior
  console.log('📋 Test 6: Holiday Behavior')
  totalTests++
  try {
    // Test every day task on New Year's Day (should not generate)
    const holidayResult = engine.generateInstancesForDate([testTasks[1]], '2024-01-01') // New Year's Day
    
    if (holidayResult.instances.length === 0) {
      console.log('✅ Holiday behavior works correctly (no tasks on holidays)')
      passedTests++
    } else {
      console.log('❌ Holiday behavior failed')
      console.log('Holiday instances:', holidayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Holiday behavior threw error:', error)
  }
  console.log()
  
  // Summary
  console.log('📊 Test Summary')
  console.log('================')
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passedTests}`)
  console.log(`Failed: ${totalTests - passedTests}`)
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`)
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The new recurrence engine logic is working correctly.')
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.')
  }
  
  return { totalTests, passedTests }
}

// Run the tests
try {
  const results = runTests()
  process.exit(results.passedTests === results.totalTests ? 0 : 1)
} catch (error) {
  console.error('Test execution failed:', error)
  process.exit(1)
}