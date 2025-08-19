/**
 * Test Script for New Recurrence Engine
 * Comprehensive testing of all frequency types and edge cases
 */

import { 
  NewRecurrenceEngine, 
  NewFrequencyType, 
  TaskStatus, 
  type MasterTask,
  createNewRecurrenceEngine 
} from '../lib/new-recurrence-engine'

// Test data
const testHolidays = [
  { date: '2024-01-01', name: 'New Year\'s Day' },
  { date: '2024-01-26', name: 'Australia Day' },
  { date: '2024-03-29', name: 'Good Friday' },
  { date: '2024-04-01', name: 'Easter Monday' },
  { date: '2024-04-25', name: 'ANZAC Day' },
  { date: '2024-06-10', name: 'Queen\'s Birthday' },
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-26', name: 'Boxing Day' }
]

const testTasks: MasterTask[] = [
  {
    id: 'once-off-1',
    active: true,
    frequency: NewFrequencyType.ONCE_OFF,
    timing: '09:00',
    due_date: '2024-03-15'
  },
  {
    id: 'every-day-1',
    active: true,
    frequency: NewFrequencyType.EVERY_DAY,
    timing: '09:00'
  },
  {
    id: 'once-weekly-1',
    active: true,
    frequency: NewFrequencyType.ONCE_WEEKLY,
    timing: '09:00'
  },
  {
    id: 'monday-1',
    active: true,
    frequency: NewFrequencyType.EVERY_MON,
    timing: '09:00'
  },
  {
    id: 'tuesday-1',
    active: true,
    frequency: NewFrequencyType.EVERY_TUE,
    timing: '14:00'
  },
  {
    id: 'start-month-1',
    active: true,
    frequency: NewFrequencyType.START_OF_MONTH,
    timing: '10:00'
  },
  {
    id: 'once-monthly-1',
    active: true,
    frequency: NewFrequencyType.ONCE_MONTHLY,
    timing: '15:00'
  },
  {
    id: 'end-month-1',
    active: true,
    frequency: NewFrequencyType.END_OF_MONTH,
    timing: '16:00'
  }
]

class RecurrenceEngineTestSuite {
  private engine: NewRecurrenceEngine

  constructor() {
    this.engine = createNewRecurrenceEngine(testHolidays)
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting New Recurrence Engine Test Suite')
    console.log('=' .repeat(60))

    try {
      await this.testOnceOffFrequency()
      await this.testEveryDayFrequency()
      await this.testOnceWeeklyFrequency()
      await this.testSpecificWeekdayFrequencies()
      await this.testStartOfMonthFrequency()
      await this.testOnceMonthlyFrequency()
      await this.testEndOfMonthFrequency()
      await this.testStatusTransitions()
      await this.testEdgeCases()
      await this.testPublicHolidayHandling()

      console.log('\n✅ All tests completed successfully!')
      console.log('=' .repeat(60))

    } catch (error) {
      console.error('\n❌ Test suite failed:', error)
      throw error
    }
  }

  private async testOnceOffFrequency(): Promise<void> {
    console.log('\n📋 Testing Once Off Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.ONCE_OFF)!

    // Test appearance on due date
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-15')
    this.assert(result1.instances.length === 1, 'Should appear on due date')
    this.assert(result1.instances[0].due_date === '2024-03-15', 'Due date should match')

    // Test carry over on subsequent days
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-16')
    this.assert(result2.carry_instances.length === 1, 'Should carry over to next day')

    const result3 = this.engine.generateInstancesForDate([task], '2024-03-20')
    this.assert(result3.carry_instances.length === 1, 'Should continue carrying over')

    // Test with publish_at delay
    const delayedTask = { ...task, publish_at: '2024-03-20' }
    const result4 = this.engine.generateInstancesForDate([delayedTask], '2024-03-15')
    this.assert(result4.instances.length === 0, 'Should not appear before publish_at')

    const result5 = this.engine.generateInstancesForDate([delayedTask], '2024-03-20')
    this.assert(result5.instances.length === 1, 'Should appear on publish_at date')

    console.log('✅ Once Off frequency tests passed')
  }

  private async testEveryDayFrequency(): Promise<void> {
    console.log('\n📅 Testing Every Day Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.EVERY_DAY)!

    // Test Monday (should appear)
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-18')
    this.assert(result1.instances.length === 1, 'Should appear on Monday')
    this.assert(result1.instances[0].due_date === '2024-03-18', 'Due date should be same day')

    // Test Sunday (should not appear)
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-17')
    this.assert(result2.instances.length === 0, 'Should not appear on Sunday')

    // Test public holiday (should not appear)
    const result3 = this.engine.generateInstancesForDate([task], '2024-03-29') // Good Friday
    this.assert(result3.instances.length === 0, 'Should not appear on public holiday')

    // Test Tuesday (should appear)
    const result4 = this.engine.generateInstancesForDate([task], '2024-03-19')
    this.assert(result4.instances.length === 1, 'Should appear on Tuesday')

    console.log('✅ Every Day frequency tests passed')
  }

  private async testOnceWeeklyFrequency(): Promise<void> {
    console.log('\n📆 Testing Once Weekly Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.ONCE_WEEKLY)!

    // Week of March 18-23, 2024 (Monday to Saturday)
    
    // Test Monday (should appear as new instance)
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-18')
    this.assert(result1.instances.length === 1, 'Should appear on Monday')
    this.assert(result1.instances[0].due_date === '2024-03-23', 'Due date should be Saturday')

    // Test Tuesday (should carry over)
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-19')
    this.assert(result2.carry_instances.length === 1, 'Should carry over on Tuesday')

    // Test Saturday (should still carry over)
    const result3 = this.engine.generateInstancesForDate([task], '2024-03-23')
    this.assert(result3.carry_instances.length === 1, 'Should carry over on Saturday')

    // Test Sunday (new week, should not appear)
    const result4 = this.engine.generateInstancesForDate([task], '2024-03-24')
    this.assert(result4.instances.length === 0 && result4.carry_instances.length === 0, 'Should not appear on Sunday (new week)')

    console.log('✅ Once Weekly frequency tests passed')
  }

  private async testSpecificWeekdayFrequencies(): Promise<void> {
    console.log('\n📊 Testing Specific Weekday Frequencies')
    console.log('-' .repeat(40))

    const mondayTask = testTasks.find(t => t.frequency === NewFrequencyType.EVERY_MON)!
    const tuesdayTask = testTasks.find(t => t.frequency === NewFrequencyType.EVERY_TUE)!

    // Test Monday task on Monday
    const result1 = this.engine.generateInstancesForDate([mondayTask], '2024-03-18')
    this.assert(result1.instances.length === 1, 'Monday task should appear on Monday')
    this.assert(result1.instances[0].due_date === '2024-03-18', 'Due date should be same day')

    // Test Monday task carries through Saturday
    const result2 = this.engine.generateInstancesForDate([mondayTask], '2024-03-23')
    this.assert(result2.carry_instances.length === 1, 'Monday task should carry to Saturday')

    // Test Tuesday task on Tuesday
    const result3 = this.engine.generateInstancesForDate([tuesdayTask], '2024-03-19')
    this.assert(result3.instances.length === 1, 'Tuesday task should appear on Tuesday')
    this.assert(result3.instances[0].due_date === '2024-03-19', 'Due date should be same day')

    // Test Tuesday task carries through Saturday
    const result4 = this.engine.generateInstancesForDate([tuesdayTask], '2024-03-23')
    this.assert(result4.carry_instances.length === 1, 'Tuesday task should carry to Saturday')

    console.log('✅ Specific Weekday frequency tests passed')
  }

  private async testStartOfMonthFrequency(): Promise<void> {
    console.log('\n📈 Testing Start of Month Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.START_OF_MONTH)!

    // Test March 1, 2024 (Friday - should appear normally)
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-01')
    this.assert(result1.instances.length === 1, 'Should appear on 1st of month')

    // Due date should be +5 workdays from March 1 (Friday) = March 8 (Friday)
    this.assert(result1.instances[0].due_date === '2024-03-08', 'Due date should be +5 workdays')

    // Test carry through to last Saturday of month
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-30') // Last Saturday of March
    this.assert(result2.carry_instances.length === 1, 'Should carry to last Saturday of month')

    // Test June 1, 2024 (Saturday - should shift to first Monday after)
    const result3 = this.engine.generateInstancesForDate([task], '2024-06-03') // Monday after June 1
    this.assert(result3.instances.length === 1, 'Should shift from Saturday to Monday')

    // Should not appear on the Saturday
    const result4 = this.engine.generateInstancesForDate([task], '2024-06-01')
    this.assert(result4.instances.length === 0, 'Should not appear on Saturday 1st')

    console.log('✅ Start of Month frequency tests passed')
  }

  private async testOnceMonthlyFrequency(): Promise<void> {
    console.log('\n📊 Testing Once Monthly Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.ONCE_MONTHLY)!

    // Test appearance on 1st (same as Start of Month)
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-01')
    this.assert(result1.instances.length === 1, 'Should appear on 1st of month')

    // Due date should be last Saturday of month
    this.assert(result1.instances[0].due_date === '2024-03-30', 'Due date should be last Saturday')

    // Test carry through due date
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-30')
    this.assert(result2.carry_instances.length === 1, 'Should carry through due date')

    // Test should not appear after due date
    const result3 = this.engine.generateInstancesForDate([task], '2024-03-31')
    this.assert(result3.carry_instances.length === 0, 'Should not appear after due date')

    console.log('✅ Once Monthly frequency tests passed')
  }

  private async testEndOfMonthFrequency(): Promise<void> {
    console.log('\n📉 Testing End of Month Frequency')
    console.log('-' .repeat(40))

    const task = testTasks.find(t => t.frequency === NewFrequencyType.END_OF_MONTH)!

    // Test appearance on latest Monday with ≥5 workdays remaining
    // March 2024: March 25 has only 4 workdays (Mon-Thu, Fri is Good Friday), so use March 18
    const result1 = this.engine.generateInstancesForDate([task], '2024-03-18')
    this.assert(result1.instances.length === 1, 'Should appear on latest Monday with ≥5 workdays')

    // Due date should be last Saturday of month
    this.assert(result1.instances[0].due_date === '2024-03-30', 'Due date should be last Saturday')

    // Test carry through due date
    const result2 = this.engine.generateInstancesForDate([task], '2024-03-30')
    this.assert(result2.carry_instances.length === 1, 'Should carry through due date')

    // Test should not appear after due date
    const result3 = this.engine.generateInstancesForDate([task], '2024-03-31')
    this.assert(result3.carry_instances.length === 0, 'Should not appear after due date')

    console.log('✅ End of Month frequency tests passed')
  }

  private async testStatusTransitions(): Promise<void> {
    console.log('\n🔄 Testing Status Transitions')
    console.log('-' .repeat(40))

    const instance = {
      id: 'test-instance',
      master_task_id: 'test-task',
      date: '2024-03-18',
      due_date: '2024-03-18',
      due_time: '09:00',
      status: TaskStatus.PENDING,
      locked: false,
      created_at: '2024-03-18T08:00:00Z',
      updated_at: '2024-03-18T08:00:00Z'
    }

    // Test transition to overdue at due time
    const updates1 = this.engine.updateInstanceStatuses([instance], new Date('2024-03-18T09:00:00'), testTasks)
    const update1 = updates1.find(u => u.instance_id === 'test-instance')
    this.assert(update1?.new_status === TaskStatus.OVERDUE, 'Should become overdue at due time')
    this.assert(update1?.locked === false, 'Should remain unlocked when overdue')

    // Test no change if already done
    const doneInstance = { ...instance, status: TaskStatus.DONE }
    const updates2 = this.engine.updateInstanceStatuses([doneInstance], new Date('2024-03-18T23:59:00'), testTasks)
    this.assert(updates2.length === 0, 'Should not return any updates for done instance')

    console.log('✅ Status transition tests passed')
  }

  private async testEdgeCases(): Promise<void> {
    console.log('\n🔍 Testing Edge Cases')
    console.log('-' .repeat(40))

    // Test inactive task
    const inactiveTask: MasterTask = {
      id: 'inactive-1',
      active: false,
      frequency: NewFrequencyType.EVERY_DAY,
      timing: '09:00'
    }

    const result1 = this.engine.generateInstancesForDate([inactiveTask], '2024-03-18')
    this.assert(result1.instances.length === 0, 'Inactive task should not appear')

    // Test task with future publish_at
    const futureTask: MasterTask = {
      id: 'future-1',
      active: true,
      frequency: NewFrequencyType.EVERY_DAY,
      timing: '09:00',
      publish_at: '2024-12-01'
    }

    const result2 = this.engine.generateInstancesForDate([futureTask], '2024-03-18')
    this.assert(result2.instances.length === 0, 'Task with future publish_at should not appear')

    // Test once-off without due_date
    const invalidOnceOff: MasterTask = {
      id: 'invalid-once-off',
      active: true,
      frequency: NewFrequencyType.ONCE_OFF,
      timing: '09:00'
      // Missing due_date
    }

    const result3 = this.engine.generateInstancesForDate([invalidOnceOff], '2024-03-18')
    this.assert(result3.instances.length === 0, 'Once-off without due_date should not appear')

    console.log('✅ Edge case tests passed')
  }

  private async testPublicHolidayHandling(): Promise<void> {
    console.log('\n🏖️ Testing Public Holiday Handling')
    console.log('-' .repeat(40))

    const everyDayTask = testTasks.find(t => t.frequency === NewFrequencyType.EVERY_DAY)!

    // Test that every day task doesn't appear on Good Friday
    const result1 = this.engine.generateInstancesForDate([everyDayTask], '2024-03-29')
    this.assert(result1.instances.length === 0, 'Every day task should not appear on Good Friday')

    // Test that it appears on the day after
    const result2 = this.engine.generateInstancesForDate([everyDayTask], '2024-04-02') // Tuesday after Easter Monday
    this.assert(result2.instances.length === 1, 'Every day task should appear on Tuesday after Easter')

    // Test Monday task shifting when Monday is a holiday
    const mondayTask = testTasks.find(t => t.frequency === NewFrequencyType.EVERY_MON)!
    
    // January 1, 2024 is a Monday and New Year's Day
    // Task should shift to next weekday (January 2, Tuesday)
    const result3 = this.engine.generateInstancesForDate([mondayTask], '2024-01-02')
    this.assert(result3.instances.length === 1, 'Monday task should shift to Tuesday when Monday is PH')

    // Should not appear on the holiday Monday
    const result4 = this.engine.generateInstancesForDate([mondayTask], '2024-01-01')
    this.assert(result4.instances.length === 0, 'Monday task should not appear on holiday Monday')

    console.log('✅ Public holiday handling tests passed')
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`)
    }
    console.log(`  ✓ ${message}`)
  }
}

// Run the test suite
async function runTests() {
  const testSuite = new RecurrenceEngineTestSuite()
  
  try {
    await testSuite.runAllTests()
    process.exit(0)
  } catch (error) {
    console.error('Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests()
}

export { RecurrenceEngineTestSuite }