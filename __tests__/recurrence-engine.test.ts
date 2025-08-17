/**
 * Unit Tests for Recurrence Engine
 * Pharmacy Intranet Portal - Task Scheduling Engine Tests
 * 
 * Tests cover:
 * - All frequency rule types
 * - Public holiday shifting logic
 * - Business day calculations
 * - Leap year handling
 * - Edge cases and complex scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { 
  RecurrenceEngine, 
  createRecurrenceEngine,
  createRecurrenceEngineWithConfig 
} from '../lib/recurrence-engine'
import { 
  createMockHolidayHelper,
  PublicHolidaysHelper,
  createHolidayHelper 
} from '../lib/public-holidays'
import type { 
  FrequencyRule,
  FrequencyType,
  DailyFrequencyRule,
  WeeklyFrequencyRule,
  SpecificWeekdaysFrequencyRule,
  StartOfMonthFrequencyRule,
  StartCertainMonthsFrequencyRule,
  EveryMonthFrequencyRule,
  CertainMonthsFrequencyRule,
  EndOfMonthFrequencyRule,
  EndCertainMonthsFrequencyRule,
  OnceOffFrequencyRule,
  OnceOffStickyFrequencyRule
} from '../types/checklist'

// ========================================
// TEST DATA AND HELPERS
// ========================================

/**
 * Sample public holidays for testing
 */
const SAMPLE_HOLIDAYS = [
  { date: '2024-01-01', name: 'New Year\'s Day' },
  { date: '2024-01-26', name: 'Australia Day' },
  { date: '2024-04-25', name: 'ANZAC Day' },
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-26', name: 'Boxing Day' },
  { date: '2025-01-01', name: 'New Year\'s Day 2025' },
  { date: '2025-01-27', name: 'Australia Day 2025' }
]

/**
 * Create a test task with specific frequency rules
 */
function createTestTask(frequencyRules: FrequencyRule, startDate?: string, endDate?: string) {
  return {
    id: 'test-task-1',
    frequency_rules: frequencyRules,
    start_date: startDate,
    end_date: endDate
  }
}

/**
 * Helper to create date objects
 */
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

/**
 * Helper to format date for comparison
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ========================================
// TEST SUITES
// ========================================

describe('RecurrenceEngine', () => {
  let mockHolidayChecker: ReturnType<typeof createMockHolidayHelper>
  let realHolidayChecker: PublicHolidaysHelper
  let engine: RecurrenceEngine

  beforeEach(() => {
    // Create mock holiday checker that treats all days as business days
    mockHolidayChecker = createMockHolidayHelper(
      () => false, // No holidays
      () => true   // All days are business days
    )
    
    // Create real holiday checker with sample holidays
    realHolidayChecker = createHolidayHelper(SAMPLE_HOLIDAYS)
    
    // Create engine with mock checker by default
    engine = createRecurrenceEngine(mockHolidayChecker)
  })

  describe('Factory Functions', () => {
    it('should create engine with default configuration', () => {
      const engine = createRecurrenceEngine(mockHolidayChecker)
      const config = engine.getConfig()
      
      expect(config.maxOccurrences).toBe(1000)
      expect(config.maxYears).toBe(10)
      expect(config.defaultShiftDirection).toBe('forward')
    })

    it('should create engine with custom configuration', () => {
      const engine = createRecurrenceEngineWithConfig(mockHolidayChecker, {
        maxOccurrences: 500,
        maxYears: 5,
        defaultShiftDirection: 'backward'
      })
      
      const config = engine.getConfig()
      expect(config.maxOccurrences).toBe(500)
      expect(config.maxYears).toBe(5)
      expect(config.defaultShiftDirection).toBe('backward')
    })
  })

  describe('Once-Off Tasks', () => {
    it('should handle once-off tasks with specific due date', () => {
      const task = createTestTask({
        type: FrequencyType.ONCE_OFF,
        due_date: '2024-06-15'
      } as OnceOffFrequencyRule)

      const dueDate = createDate(2024, 6, 15)
      const notDueDate = createDate(2024, 6, 16)

      expect(engine.isDueOnDate(task, dueDate)).toBe(true)
      expect(engine.isDueOnDate(task, notDueDate)).toBe(false)
    })

    it('should handle once-off tasks without due date', () => {
      const task = createTestTask({
        type: FrequencyType.ONCE_OFF
      } as OnceOffFrequencyRule)

      const anyDate = createDate(2024, 6, 15)
      expect(engine.isDueOnDate(task, anyDate)).toBe(false)
    })

    it('should handle once-off sticky tasks with due date', () => {
      const task = createTestTask({
        type: FrequencyType.ONCE_OFF_STICKY,
        due_date: '2024-06-15'
      } as OnceOffStickyFrequencyRule)

      const beforeDue = createDate(2024, 6, 14)
      const onDue = createDate(2024, 6, 15)
      const afterDue = createDate(2024, 6, 16)

      expect(engine.isDueOnDate(task, beforeDue)).toBe(false)
      expect(engine.isDueOnDate(task, onDue)).toBe(true)
      expect(engine.isDueOnDate(task, afterDue)).toBe(true)
    })

    it('should handle once-off sticky tasks without due date', () => {
      const task = createTestTask({
        type: FrequencyType.ONCE_OFF_STICKY
      } as OnceOffStickyFrequencyRule)

      const anyDate = createDate(2024, 6, 15)
      expect(engine.isDueOnDate(task, anyDate)).toBe(true)
    })
  })

  describe('Daily Tasks', () => {
    it('should handle daily tasks every day', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1)
      const nextDay = createDate(2024, 6, 2)
      const thirdDay = createDate(2024, 6, 3)

      expect(engine.isDueOnDate(task, startDate)).toBe(true)
      expect(engine.isDueOnDate(task, nextDay)).toBe(true)
      expect(engine.isDueOnDate(task, thirdDay)).toBe(true)
    })

    it('should handle daily tasks every N days', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 3,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1)
      const day3 = createDate(2024, 6, 4)
      const day6 = createDate(2024, 6, 7)
      const day9 = createDate(2024, 6, 10)

      expect(engine.isDueOnDate(task, startDate)).toBe(true)
      expect(engine.isDueOnDate(task, day3)).toBe(true)
      expect(engine.isDueOnDate(task, day6)).toBe(true)
      expect(engine.isDueOnDate(task, day9)).toBe(true)

      // Days in between should not be due
      const day2 = createDate(2024, 6, 2)
      const day4 = createDate(2024, 6, 5)
      expect(engine.isDueOnDate(task, day2)).toBe(false)
      expect(engine.isDueOnDate(task, day4)).toBe(false)
    })

    it('should handle daily tasks with business days only', () => {
      // Create mock that treats weekends as non-business days
      const businessDayChecker = createMockHolidayHelper(
        () => false,
        (date: Date) => {
          const day = date.getDay()
          return day >= 1 && day <= 5 // Monday to Friday only
        }
      )
      
      const engine = createRecurrenceEngine(businessDayChecker)
      
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: true
      } as DailyFrequencyRule, '2024-06-01')

      const monday = createDate(2024, 6, 3) // Monday
      const saturday = createDate(2024, 6, 8) // Saturday
      const sunday = createDate(2024, 6, 9) // Sunday

      expect(engine.isDueOnDate(task, monday)).toBe(true)
      expect(engine.isDueOnDate(task, saturday)).toBe(false)
      expect(engine.isDueOnDate(task, sunday)).toBe(false)
    })

    it('should handle daily tasks before start date', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const beforeStart = createDate(2024, 5, 31)
      expect(engine.isDueOnDate(task, beforeStart)).toBe(false)
    })
  })

  describe('Weekly Tasks', () => {
    it('should handle weekly tasks every week', () => {
      const task = createTestTask({
        type: FrequencyType.WEEKLY,
        every_n_weeks: 1,
        start_day: 1, // Monday
        business_days_only: false
      } as WeeklyFrequencyRule, '2024-06-01')

      const monday1 = createDate(2024, 6, 3) // First Monday
      const monday2 = createDate(2024, 6, 10) // Second Monday
      const tuesday = createDate(2024, 6, 4) // Tuesday

      expect(engine.isDueOnDate(task, monday1)).toBe(true)
      expect(engine.isDueOnDate(task, monday2)).toBe(true)
      expect(engine.isDueOnDate(task, tuesday)).toBe(false)
    })

    it('should handle weekly tasks every N weeks', () => {
      const task = createTestTask({
        type: FrequencyType.WEEKLY,
        every_n_weeks: 2,
        start_day: 1, // Monday
        business_days_only: false
      } as WeeklyFrequencyRule, '2024-06-01')

      const monday1 = createDate(2024, 6, 3) // First Monday
      const monday2 = createDate(2024, 6, 10) // Second Monday (should not be due)
      const monday3 = createDate(2024, 6, 17) // Third Monday (should be due)

      expect(engine.isDueOnDate(task, monday1)).toBe(true)
      expect(engine.isDueOnDate(task, monday2)).toBe(false)
      expect(engine.isDueOnDate(task, monday3)).toBe(true)
    })

    it('should handle weekly tasks without specific start day', () => {
      const task = createTestTask({
        type: FrequencyType.WEEKLY,
        every_n_weeks: 1,
        business_days_only: false
      } as WeeklyFrequencyRule, '2024-06-01')

      const anyDay = createDate(2024, 6, 5)
      expect(engine.isDueOnDate(task, anyDay)).toBe(true)
    })
  })

  describe('Specific Weekdays Tasks', () => {
    it('should handle specific weekdays tasks', () => {
      const task = createTestTask({
        type: FrequencyType.SPECIFIC_WEEKDAYS,
        weekdays: [2, 4, 6], // Tuesday, Thursday, Saturday
        every_n_weeks: 1,
        business_days_only: false
      } as SpecificWeekdaysFrequencyRule, '2024-06-01')

      const tuesday = createDate(2024, 6, 4) // Tuesday
      const thursday = createDate(2024, 6, 6) // Thursday
      const saturday = createDate(2024, 6, 8) // Saturday
      const monday = createDate(2024, 6, 3) // Monday

      expect(engine.isDueOnDate(task, tuesday)).toBe(true)
      expect(engine.isDueOnDate(task, thursday)).toBe(true)
      expect(engine.isDueOnDate(task, saturday)).toBe(true)
      expect(engine.isDueOnDate(task, monday)).toBe(false)
    })

    it('should handle specific weekdays with N-week intervals', () => {
      const task = createTestTask({
        type: FrequencyType.SPECIFIC_WEEKDAYS,
        weekdays: [1], // Monday only
        every_n_weeks: 2,
        business_days_only: false
      } as SpecificWeekdaysFrequencyRule, '2024-06-01')

      const monday1 = createDate(2024, 6, 3) // First Monday
      const monday2 = createDate(2024, 6, 10) // Second Monday (should not be due)
      const monday3 = createDate(2024, 6, 17) // Third Monday (should be due)

      expect(engine.isDueOnDate(task, monday1)).toBe(true)
      expect(engine.isDueOnDate(task, monday2)).toBe(false)
      expect(engine.isDueOnDate(task, monday3)).toBe(true)
    })
  })

  describe('Start of Month Tasks', () => {
    it('should handle start of month tasks', () => {
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 1,
        day_offset: 0, // 1st of month
        business_days_only: false
      } as StartOfMonthFrequencyRule, '2024-06-01')

      const firstOfJune = createDate(2024, 6, 1)
      const firstOfJuly = createDate(2024, 7, 1)
      const secondOfJune = createDate(2024, 6, 2)

      expect(engine.isDueOnDate(task, firstOfJune)).toBe(true)
      expect(engine.isDueOnDate(task, firstOfJuly)).toBe(true)
      expect(engine.isDueOnDate(task, secondOfJune)).toBe(false)
    })

    it('should handle start of month with day offset', () => {
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 1,
        day_offset: 2, // 3rd of month
        business_days_only: false
      } as StartOfMonthFrequencyRule, '2024-06-01')

      const thirdOfJune = createDate(2024, 6, 3)
      const thirdOfJuly = createDate(2024, 7, 3)
      const firstOfJune = createDate(2024, 6, 1)

      expect(engine.isDueOnDate(task, thirdOfJune)).toBe(true)
      expect(engine.isDueOnDate(task, thirdOfJuly)).toBe(true)
      expect(engine.isDueOnDate(task, firstOfJune)).toBe(false)
    })

    it('should handle start of month with N-month intervals', () => {
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 3,
        day_offset: 0,
        business_days_only: false
      } as StartOfMonthFrequencyRule, '2024-06-01')

      const june = createDate(2024, 6, 1)
      const july = createDate(2024, 7, 1) // Should not be due
      const september = createDate(2024, 9, 1) // Should be due

      expect(engine.isDueOnDate(task, june)).toBe(true)
      expect(engine.isDueOnDate(task, july)).toBe(false)
      expect(engine.isDueOnDate(task, september)).toBe(true)
    })

    it('should handle start of month with business days only', () => {
      const businessDayChecker = createMockHolidayHelper(
        () => false,
        (date: Date) => {
          const day = date.getDay()
          return day >= 1 && day <= 5 // Monday to Friday only
        }
      )
      
      const engine = createRecurrenceEngine(businessDayChecker)
      
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 1,
        day_offset: 0,
        business_days_only: true
      } as StartOfMonthFrequencyRule, '2024-06-01')

      const firstOfJune = createDate(2024, 6, 1) // Saturday
      const firstOfJuly = createDate(2024, 7, 1) // Monday

      expect(engine.isDueOnDate(task, firstOfJune)).toBe(false) // Saturday
      expect(engine.isDueOnDate(task, firstOfJuly)).toBe(true) // Monday
    })
  })

  describe('Start Certain Months Tasks', () => {
    it('should handle start of certain months', () => {
      const task = createTestTask({
        type: FrequencyType.START_CERTAIN_MONTHS,
        months: [3, 6, 9, 12], // March, June, September, December
        day_offset: 0,
        business_days_only: false
      } as StartCertainMonthsFrequencyRule, '2024-01-01')

      const march = createDate(2024, 3, 1)
      const june = createDate(2024, 6, 1)
      const july = createDate(2024, 7, 1) // Should not be due

      expect(engine.isDueOnDate(task, march)).toBe(true)
      expect(engine.isDueOnDate(task, june)).toBe(true)
      expect(engine.isDueOnDate(task, july)).toBe(false)
    })
  })

  describe('Every Month Tasks', () => {
    it('should handle every month tasks', () => {
      const task = createTestTask({
        type: FrequencyType.EVERY_MONTH,
        every_n_months: 1,
        day_offset: 0,
        business_days_only: false
      } as EveryMonthFrequencyRule, '2024-06-01')

      const june = createDate(2024, 6, 1)
      const july = createDate(2024, 7, 1)
      const august = createDate(2024, 8, 1)

      expect(engine.isDueOnDate(task, june)).toBe(true)
      expect(engine.isDueOnDate(task, july)).toBe(true)
      expect(engine.isDueOnDate(task, august)).toBe(true)
    })

    it('should handle every N months', () => {
      const task = createTestTask({
        type: FrequencyType.EVERY_MONTH,
        every_n_months: 2,
        day_offset: 0,
        business_days_only: false
      } as EveryMonthFrequencyRule, '2024-06-01')

      const june = createDate(2024, 6, 1)
      const july = createDate(2024, 7, 1) // Should not be due
      const august = createDate(2024, 8, 1) // Should be due

      expect(engine.isDueOnDate(task, june)).toBe(true)
      expect(engine.isDueOnDate(task, july)).toBe(false)
      expect(engine.isDueOnDate(task, august)).toBe(true)
    })
  })

  describe('Certain Months Tasks', () => {
    it('should handle certain months tasks', () => {
      const task = createTestTask({
        type: FrequencyType.CERTAIN_MONTHS,
        months: [1, 4, 7, 10], // January, April, July, October
        day_offset: 0,
        business_days_only: false
      } as CertainMonthsFrequencyRule, '2024-01-01')

      const january = createDate(2024, 1, 1)
      const april = createDate(2024, 4, 1)
      const may = createDate(2024, 5, 1) // Should not be due

      expect(engine.isDueOnDate(task, january)).toBe(true)
      expect(engine.isDueOnDate(task, april)).toBe(true)
      expect(engine.isDueOnDate(task, may)).toBe(false)
    })
  })

  describe('End of Month Tasks', () => {
    it('should handle end of month tasks', () => {
      const task = createTestTask({
        type: FrequencyType.END_OF_MONTH,
        every_n_months: 1,
        days_from_end: 0, // Last day of month
        business_days_only: false
      } as EndOfMonthFrequencyRule, '2024-06-01')

      const lastDayJune = createDate(2024, 6, 30)
      const lastDayJuly = createDate(2024, 7, 31)
      const secondLastDayJune = createDate(2024, 6, 29)

      expect(engine.isDueOnDate(task, lastDayJune)).toBe(true)
      expect(engine.isDueOnDate(task, lastDayJuly)).toBe(true)
      expect(engine.isDueOnDate(task, secondLastDayJune)).toBe(false)
    })

    it('should handle end of month with days from end offset', () => {
      const task = createTestTask({
        type: FrequencyType.END_OF_MONTH,
        every_n_months: 1,
        days_from_end: 2, // 3rd to last day of month
        business_days_only: false
      } as EndOfMonthFrequencyRule, '2024-06-01')

      const thirdLastDayJune = createDate(2024, 6, 28) // June has 30 days
      const thirdLastDayJuly = createDate(2024, 7, 29) // July has 31 days

      expect(engine.isDueOnDate(task, thirdLastDayJune)).toBe(true)
      expect(engine.isDueOnDate(task, thirdLastDayJuly)).toBe(true)
    })
  })

  describe('End Certain Months Tasks', () => {
    it('should handle end of certain months', () => {
      const task = createTestTask({
        type: FrequencyType.END_CERTAIN_MONTHS,
        months: [2, 5, 8, 11], // February, May, August, November
        days_from_end: 0,
        business_days_only: false
      } as EndCertainMonthsFrequencyRule, '2024-01-01')

      const lastDayFeb = createDate(2024, 2, 29) // Leap year
      const lastDayMay = createDate(2024, 5, 31)
      const lastDayMar = createDate(2024, 3, 31) // Should not be due

      expect(engine.isDueOnDate(task, lastDayFeb)).toBe(true)
      expect(engine.isDueOnDate(task, lastDayMay)).toBe(true)
      expect(engine.isDueOnDate(task, lastDayMar)).toBe(false)
    })
  })

  describe('Leap Year Handling', () => {
    it('should handle leap year February correctly', () => {
      const task = createTestTask({
        type: FrequencyType.END_OF_MONTH,
        every_n_months: 1,
        days_from_end: 0,
        business_days_only: false
      } as EndOfMonthFrequencyRule, '2024-01-01')

      const lastDayFeb2024 = createDate(2024, 2, 29) // Leap year
      const lastDayFeb2025 = createDate(2025, 2, 28) // Non-leap year

      expect(engine.isDueOnDate(task, lastDayFeb2024)).toBe(true)
      expect(engine.isDueOnDate(task, lastDayFeb2025)).toBe(true)
    })

    it('should handle leap year February with offset', () => {
      const task = createTestTask({
        type: FrequencyType.END_OF_MONTH,
        every_n_months: 1,
        days_from_end: 1, // 2nd to last day
        business_days_only: false
      } as EndOfMonthFrequencyRule, '2024-01-01')

      const secondLastDayFeb2024 = createDate(2024, 2, 28) // Leap year
      const secondLastDayFeb2025 = createDate(2025, 2, 27) // Non-leap year

      expect(engine.isDueOnDate(task, secondLastDayFeb2024)).toBe(true)
      expect(engine.isDueOnDate(task, secondLastDayFeb2025)).toBe(true)
    })
  })

  describe('Public Holiday Shifting', () => {
    it('should shift dates when they fall on holidays', () => {
      // Use real holiday checker with sample holidays
      const engine = createRecurrenceEngine(realHolidayChecker)
      
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 1,
        day_offset: 0,
        business_days_only: true
      } as StartOfMonthFrequencyRule, '2024-01-01')

      const newYearsDay = createDate(2024, 1, 1) // Holiday
      const nextBusinessDay = createDate(2024, 1, 2) // Should be shifted to

      // The task should not be due on the holiday itself
      expect(engine.isDueOnDate(task, newYearsDay)).toBe(false)
      
      // But it should be due on the next business day
      expect(engine.isDueOnDate(task, nextBusinessDay)).toBe(true)
    })

    it('should handle multiple consecutive holidays', () => {
      const engine = createRecurrenceEngine(realHolidayChecker)
      
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: true
      } as DailyFrequencyRule, '2024-12-25')

      const christmasDay = createDate(2024, 12, 25) // Holiday
      const boxingDay = createDate(2024, 12, 26) // Holiday
      const nextBusinessDay = createDate(2024, 12, 27) // Should be due

      expect(engine.isDueOnDate(task, christmasDay)).toBe(false)
      expect(engine.isDueOnDate(task, boxingDay)).toBe(false)
      expect(engine.isDueOnDate(task, nextBusinessDay)).toBe(true)
    })
  })

  describe('Next Occurrence', () => {
    it('should find next occurrence for daily task', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const fromDate = createDate(2024, 6, 1)
      const nextOccurrence = engine.nextOccurrence(task, fromDate)

      expect(nextOccurrence).toEqual(createDate(2024, 6, 2))
    })

    it('should find next occurrence for weekly task', () => {
      const task = createTestTask({
        type: FrequencyType.WEEKLY,
        every_n_weeks: 1,
        start_day: 1, // Monday
        business_days_only: false
      } as WeeklyFrequencyRule, '2024-06-01')

      const fromDate = createDate(2024, 6, 3) // Monday
      const nextOccurrence = engine.nextOccurrence(task, fromDate)

      expect(nextOccurrence).toEqual(createDate(2024, 6, 10)) // Next Monday
    })

    it('should return null when no more occurrences', () => {
      const task = createTestTask({
        type: FrequencyType.ONCE_OFF,
        due_date: '2024-06-01'
      } as OnceOffFrequencyRule)

      const fromDate = createDate(2024, 6, 2) // After due date
      const nextOccurrence = engine.nextOccurrence(task, fromDate)

      expect(nextOccurrence).toBeNull()
    })
  })

  describe('Occurrences Between', () => {
    it('should generate occurrences between dates', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1)
      const endDate = createDate(2024, 6, 3)
      const occurrences = engine.occurrencesBetween(task, startDate, endDate)

      expect(occurrences).toHaveLength(3)
      expect(formatDate(occurrences[0].date)).toBe('2024-06-01')
      expect(formatDate(occurrences[1].date)).toBe('2024-06-02')
      expect(formatDate(occurrences[2].date)).toBe('2024-06-03')
    })

    it('should handle business day shifting in occurrences', () => {
      // Create mock that treats weekends as non-business days
      const businessDayChecker = createMockHolidayHelper(
        () => false,
        (date: Date) => {
          const day = date.getDay()
          return day >= 1 && day <= 5 // Monday to Friday only
        }
      )
      
      const engine = createRecurrenceEngine(businessDayChecker)
      
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: true
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1) // Saturday
      const endDate = createDate(2024, 6, 3) // Monday
      const occurrences = engine.occurrencesBetween(task, startDate, endDate)

      // Should have 1 occurrence (Monday) since Saturday and Sunday are not business days
      expect(occurrences).toHaveLength(1)
      expect(formatDate(occurrences[0].date)).toBe('2024-06-03')
      expect(occurrences[0].isBusinessDay).toBe(true)
    })
  })

  describe('Generate Occurrences', () => {
    it('should generate simple occurrence dates', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1)
      const endDate = createDate(2024, 6, 3)
      const dates = engine.generateOccurrences(task, startDate, endDate)

      expect(dates).toHaveLength(3)
      expect(formatDate(dates[0])).toBe('2024-06-01')
      expect(formatDate(dates[1])).toBe('2024-06-02')
      expect(formatDate(dates[2])).toBe('2024-06-03')
    })
  })

  describe('Configuration Management', () => {
    it('should allow updating configuration', () => {
      const originalConfig = engine.getConfig()
      expect(originalConfig.maxOccurrences).toBe(1000)

      engine.updateConfig({ maxOccurrences: 500 })
      const updatedConfig = engine.getConfig()
      expect(updatedConfig.maxOccurrences).toBe(500)
    })

    it('should allow changing holiday checker', () => {
      const newHolidayChecker = createMockHolidayHelper(
        () => true, // All days are holidays
        () => false // No business days
      )

      engine.setHolidayChecker(newHolidayChecker)
      expect(engine.getHolidayChecker()).toBe(newHolidayChecker)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle tasks with invalid frequency types gracefully', () => {
      const task = createTestTask({
        type: 'invalid_type' as any,
        every_n_days: 1
      } as any, '2024-06-01')

      const testDate = createDate(2024, 6, 1)
      expect(engine.isDueOnDate(task, testDate)).toBe(false)
    })

    it('should handle tasks with missing required fields', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY
        // Missing every_n_days
      } as any, '2024-06-01')

      const testDate = createDate(2024, 6, 1)
      // Should not throw error, should return false
      expect(() => engine.isDueOnDate(task, testDate)).not.toThrow()
      expect(engine.isDueOnDate(task, testDate)).toBe(false)
    })

    it('should handle very large date ranges gracefully', () => {
      const task = createTestTask({
        type: FrequencyType.DAILY,
        every_n_days: 1,
        business_days_only: false
      } as DailyFrequencyRule, '2024-06-01')

      const startDate = createDate(2024, 6, 1)
      const endDate = createDate(2034, 6, 1) // 10 years later
      
      // Should not throw error or hang
      expect(() => engine.occurrencesBetween(task, startDate, endDate)).not.toThrow()
    })
  })

  describe('Integration Tests', () => {
    it('should work with real holiday data', () => {
      const engine = createRecurrenceEngine(realHolidayChecker)
      
      const task = createTestTask({
        type: FrequencyType.START_OF_MONTH,
        every_n_months: 1,
        day_offset: 0,
        business_days_only: true
      } as StartOfMonthFrequencyRule, '2024-01-01')

      // Test around known holidays
      const newYearsDay = createDate(2024, 1, 1)
      const nextBusinessDay = createDate(2024, 1, 2)
      const australiaDay = createDate(2024, 1, 26)

      expect(engine.isDueOnDate(task, newYearsDay)).toBe(false) // Holiday
      expect(engine.isDueOnDate(task, nextBusinessDay)).toBe(true) // Business day
      expect(engine.isDueOnDate(task, australiaDay)).toBe(false) // Holiday
    })

    it('should handle complex frequency combinations', () => {
      const task = createTestTask({
        type: FrequencyType.SPECIFIC_WEEKDAYS,
        weekdays: [1, 3, 5], // Monday, Wednesday, Friday
        every_n_weeks: 2,
        business_days_only: true
      } as SpecificWeekdaysFrequencyRule, '2024-06-01')

      const monday1 = createDate(2024, 6, 3) // First Monday
      const wednesday1 = createDate(2024, 6, 5) // First Wednesday
      const friday1 = createDate(2024, 6, 7) // First Friday
      const monday2 = createDate(2024, 6, 10) // Second Monday (should not be due)

      expect(engine.isDueOnDate(task, monday1)).toBe(true)
      expect(engine.isDueOnDate(task, wednesday1)).toBe(true)
      expect(engine.isDueOnDate(task, friday1)).toBe(true)
      expect(engine.isDueOnDate(task, monday2)).toBe(false)
    })
  })
})
