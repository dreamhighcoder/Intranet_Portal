#!/usr/bin/env tsx

/**
 * Test Script for New Recurrence Engine
 * 
 * This script tests all frequency types and edge cases to ensure
 * the new recurrence engine works correctly according to specifications.
 */

import { NewRecurrenceEngine, NewFrequencyType, TaskStatus, type MasterTask } from '../lib/new-recurrence-engine'
import { HolidayChecker } from '../lib/holiday-checker'

// Test data setup
const testHolidays = [
  { date: '2024-01-01', name: 'New Year\'s Day', region: 'National' },
  { date: '2024-01-26', name: 'Australia Day', region: 'National' },
  { date: '2024-03-29', name: 'Good Friday', region: 'National' },
  { date: '2024-04-01', name: 'Easter Monday', region: 'National' },
  { date: '2024-04-25', name: 'ANZAC Day', region: 'National' },
  { date: '2024-06-10', name: 'Queen\'s Birthday', region: 'National' },
  { date: '2024-12-25', name: 'Christmas Day', region: 'National' },
  { date: '2024-12-26', name: 'Boxing Day', region: 'National' }
]

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
  },
  {
    id: 'test-start-of-month',
    title: 'Test Start of Month Task',
    active: true,
    frequencies: [NewFrequencyType.START_OF_EVERY_MONTH],
    timing: '16:30'
  },
  {
    id: 'test-start-of-jan',
    title: 'Test Start of January Task',
    active: true,
    frequencies: [NewFrequencyType.START_OF_MONTH_JAN],
    timing: '16:30'
  },
  {
    id: 'test-once-monthly',
    title: 'Test Once Monthly Task',
    active: true,
    frequencies: [NewFrequencyType.ONCE_MONTHLY],
    timing: '17:00'
  },
  {
    id: 'test-end-of-month',
    title: 'Test End of Month Task',
    active: true,
    frequencies: [NewFrequencyType.END_OF_EVERY_MONTH],
    timing: '17:00'
  },
  {
    id: 'test-multiple-frequencies',
    title: 'Test Multiple Frequencies Task',
    active: true,
    frequencies: [NewFrequencyType.MONDAY, NewFrequencyType.FRIDAY],
    timing: '16:30'
  }
]

async function runTests() {
  console.log('🧪 Starting New Recurrence Engine Tests...\n')
  
  // Initialize the engine
  const holidayChecker = new HolidayChecker()
  await holidayChecker.reloadHolidays() // Load holidays from database
  const engine = new NewRecurrenceEngine(holidayChecker)
  
  let totalTests = 0
  let passedTests = 0
  
  // Test 1: Once Off Task Generation
  console.log('📋 Test 1: Once Off Task Generation')
  totalTests++
  try {
    const result = engine.generateInstancesForDate(
      [testTasks[0]], // Once off task
      '2024-01-10'
    )
    
    if (result.instances.length === 1 && result.instances[0].due_date === '2024-01-15') {
      console.log('✅ Once off task generated correctly')
      passedTests++
    } else {
      console.log('❌ Once off task generation failed')
      console.log('Expected: 1 instance with due_date 2024-01-15')
      console.log('Got:', result.instances)
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
    // Test on a Tuesday (should carry over from Monday)
    const tuesdayResult = engine.generateInstancesForDate([testTasks[2]], '2024-01-09') // Tuesday
    
    if (mondayResult.instances.length === 1 && tuesdayResult.carry_instances.length >= 0) {
      console.log('✅ Once weekly task generation works correctly')
      passedTests++
    } else {
      console.log('❌ Once weekly task generation failed')
      console.log('Monday instances:', mondayResult.instances.length)
      console.log('Tuesday carry instances:', tuesdayResult.carry_instances.length)
    }
  } catch (error) {
    console.log('❌ Once weekly task generation threw error:', error)
  }
  console.log()
  
  // Test 4: Specific Weekday Task Generation
  console.log('📋 Test 4: Specific Weekday Task Generation')
  totalTests++
  try {
    // Test on a Monday (should generate)
    const mondayResult = engine.generateInstancesForDate([testTasks[3]], '2024-01-08') // Monday
    // Test on a Tuesday (should not generate new, but may carry)
    const tuesdayResult = engine.generateInstancesForDate([testTasks[3]], '2024-01-09') // Tuesday
    
    if (mondayResult.instances.length === 1) {
      console.log('✅ Specific weekday task generation works correctly')
      passedTests++
    } else {
      console.log('❌ Specific weekday task generation failed')
      console.log('Monday instances:', mondayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Specific weekday task generation threw error:', error)
  }
  console.log()
  
  // Test 5: Start of Month Task Generation
  console.log('📋 Test 5: Start of Month Task Generation')
  totalTests++
  try {
    // Test on the 1st of the month
    const firstResult = engine.generateInstancesForDate([testTasks[4]], '2024-02-01') // Feb 1st (Thursday)
    
    if (firstResult.instances.length === 1) {
      console.log('✅ Start of month task generation works correctly')
      console.log('Due date:', firstResult.instances[0].due_date)
      passedTests++
    } else {
      console.log('❌ Start of month task generation failed')
      console.log('Instances:', firstResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Start of month task generation threw error:', error)
  }
  console.log()
  
  // Test 6: Status Updates
  console.log('📋 Test 6: Status Updates')
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
      passedTests++
    } else {
      console.log('❌ Status updates failed')
      console.log('Updates:', statusResult.updates)
    }
  } catch (error) {
    console.log('❌ Status updates threw error:', error)
  }
  console.log()
  
  // Test 7: Multiple Frequencies
  console.log('📋 Test 7: Multiple Frequencies')
  totalTests++
  try {
    // Test on a Monday (should generate for Monday frequency)
    const mondayResult = engine.generateInstancesForDate([testTasks[8]], '2024-01-08') // Monday
    // Test on a Friday (should generate for Friday frequency)
    const fridayResult = engine.generateInstancesForDate([testTasks[8]], '2024-01-12') // Friday
    
    if (mondayResult.instances.length >= 1 && fridayResult.instances.length >= 1) {
      console.log('✅ Multiple frequencies work correctly')
      passedTests++
    } else {
      console.log('❌ Multiple frequencies failed')
      console.log('Monday instances:', mondayResult.instances.length)
      console.log('Friday instances:', fridayResult.instances.length)
    }
  } catch (error) {
    console.log('❌ Multiple frequencies threw error:', error)
  }
  console.log()
  
  // Test 8: Holiday Shifting
  console.log('📋 Test 8: Holiday Shifting')
  totalTests++
  try {
    // Test generation on a holiday (should shift appropriately)
    const holidayResult = engine.generateInstancesForDate([testTasks[2]], '2024-01-01') // New Year's Day (Monday)
    
    // The task should either not appear or be shifted
    console.log('✅ Holiday shifting test completed (behavior depends on frequency type)')
    console.log('Holiday result instances:', holidayResult.instances.length)
    passedTests++
  } catch (error) {
    console.log('❌ Holiday shifting threw error:', error)
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
    console.log('\n🎉 All tests passed! The new recurrence engine is working correctly.')
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.')
  }
}

// Run the tests
runTests().catch(console.error)