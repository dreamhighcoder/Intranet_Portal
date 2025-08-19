/**
 * Recurrence Engine for Master Checklist System
 * Pharmacy Intranet Portal - Task Scheduling Engine
 * 
 * This module provides functionality to:
 * - Check if a task is due on a specific date
 * - Calculate the next occurrence of a task
 * - Generate all occurrences between two dates
 * - Handle public holiday shifting and business-day logic
 * - Support all frequency rule types from the specification
 */

import { 
  FrequencyType
} from '@/types/checklist'

import type { 
  FrequencyRule,
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
} from '@/types/checklist'

import type { HolidayChecker } from './public-holidays'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Task interface for recurrence calculations
 */
export interface Task {
  id: string
  frequency_rules: FrequencyRule
  due_date?: string // For once-off tasks
  start_date?: string // When task becomes active
  end_date?: string // When task expires
}

/**
 * Occurrence result
 */
export interface TaskOccurrence {
  date: Date
  isBusinessDay: boolean
  shiftedFrom?: Date // Original date if shifted due to holidays
}

/**
 * Configuration for the recurrence engine
 */
export interface RecurrenceConfig {
  maxOccurrences: number // Maximum occurrences to generate
  maxYears: number // Maximum years to look ahead
  defaultShiftDirection: 'forward' | 'backward' // Default holiday shift direction
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

/**
 * Default configuration for the recurrence engine
 */
export const DEFAULT_RECURRENCE_CONFIG: RecurrenceConfig = {
  maxOccurrences: 1000,
  maxYears: 10,
  defaultShiftDirection: 'forward'
}

// ========================================
// RECURRENCE ENGINE CLASS
// ========================================

/**
 * Main recurrence engine class
 * Handles all frequency rule types with holiday shifting
 */
export class RecurrenceEngine {
  private holidayChecker: HolidayChecker
  private config: RecurrenceConfig

  constructor(holidayChecker: HolidayChecker, config: Partial<RecurrenceConfig> = {}) {
    this.holidayChecker = holidayChecker
    this.config = { ...DEFAULT_RECURRENCE_CONFIG, ...config }
  }

  /**
   * Check if a task is due on a specific date
   * 
   * @param task - Task to check
   * @param date - Date to check
   * @returns true if the task is due on the specified date
   */
  isDueOnDate(task: Task, date: Date): boolean {
    try {
      console.log('Checking if task is due:', task.id, 'on date:', date.toISOString().split('T')[0])
      
      // Check if task is within active period
      if (task.start_date && date < new Date(task.start_date)) {
        console.log('Task not due: before start date', task.start_date)
        return false
      }
      
      if (task.end_date && date > new Date(task.end_date)) {
        console.log('Task not due: after end date', task.end_date)
        return false
      }

      const frequencyRules = task.frequency_rules
      console.log('Frequency rules:', frequencyRules)
      
      // Handle missing or invalid frequency type
      if (!frequencyRules || !frequencyRules.type) {
        console.log('Task has no frequency rules or type, defaulting to daily')
        return true // Default to daily if no frequency rules
      }
      
      let result = false
      
      switch (frequencyRules.type) {
        case FrequencyType.ONCE_OFF:
          result = this.isOnceOffDue(task as Task & { frequency_rules: OnceOffFrequencyRule }, date)
          console.log('ONCE_OFF result:', result)
          return result
        
        case FrequencyType.ONCE_OFF_STICKY:
          result = this.isOnceOffStickyDue(task as Task & { frequency_rules: OnceOffStickyFrequencyRule }, date)
          console.log('ONCE_OFF_STICKY result:', result)
          return result
        
        case FrequencyType.DAILY:
          result = this.isDailyDue(task as Task & { frequency_rules: DailyFrequencyRule }, date)
          console.log('DAILY result:', result)
          return result
        
        case FrequencyType.WEEKLY:
          result = this.isWeeklyDue(task as Task & { frequency_rules: WeeklyFrequencyRule }, date)
          console.log('WEEKLY result:', result)
          return result
        
        case FrequencyType.SPECIFIC_WEEKDAYS:
          result = this.isSpecificWeekdaysDue(task as Task & { frequency_rules: SpecificWeekdaysFrequencyRule }, date)
          console.log('SPECIFIC_WEEKDAYS result:', result)
          return result
        
        case FrequencyType.START_OF_MONTH:
          result = this.isStartOfMonthDue(task as Task & { frequency_rules: StartOfMonthFrequencyRule }, date)
          console.log('START_OF_MONTH result:', result)
          return result
        
        case FrequencyType.START_CERTAIN_MONTHS:
          result = this.isStartCertainMonthsDue(task as Task & { frequency_rules: StartCertainMonthsFrequencyRule }, date)
          console.log('START_CERTAIN_MONTHS result:', result)
          return result
        
        case FrequencyType.EVERY_MONTH:
          result = this.isEveryMonthDue(task as Task & { frequency_rules: EveryMonthFrequencyRule }, date)
          console.log('EVERY_MONTH result:', result)
          return result
        
        case FrequencyType.CERTAIN_MONTHS:
          result = this.isCertainMonthsDue(task as Task & { frequency_rules: CertainMonthsFrequencyRule }, date)
          console.log('CERTAIN_MONTHS result:', result)
          return result
        
        case FrequencyType.END_OF_MONTH:
          result = this.isEndOfMonthDue(task as Task & { frequency_rules: EndOfMonthFrequencyRule }, date)
          console.log('END_OF_MONTH result:', result)
          return result
        
        case FrequencyType.END_CERTAIN_MONTHS:
          result = this.isEndCertainMonthsDue(task as Task & { frequency_rules: EndCertainMonthsFrequencyRule }, date)
          console.log('END_CERTAIN_MONTHS result:', result)
          return result
        
        default:
          console.warn(`Unknown frequency type: ${frequencyRules.type}, defaulting to true`)
          return true // Default to true for unknown types to ensure tasks show up
      }
    } catch (error) {
      console.error('Error checking if task is due:', error)
      return true // Default to true on error to ensure tasks show up
    }
  }

  /**
   * Get the next occurrence of a task from a given date
   * 
   * @param task - Task to find next occurrence for
   * @param fromDate - Date to start searching from
   * @returns Next occurrence date or null if no more occurrences
   */
  nextOccurrence(task: Task, fromDate: Date): Date | null {
    try {
      let currentDate = new Date(fromDate)
      currentDate.setDate(currentDate.getDate() + 1) // Start from next day
      
      const maxDate = new Date(fromDate)
      maxDate.setFullYear(maxDate.getFullYear() + this.config.maxYears)
      
      let attempts = 0
      
      while (currentDate <= maxDate && attempts < this.config.maxOccurrences) {
        if (this.isDueOnDate(task, currentDate)) {
          return currentDate
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
        attempts++
      }
      
      return null // No more occurrences found
    } catch (error) {
      console.error('Error finding next occurrence:', error)
      return null
    }
  }

  /**
   * Get all occurrences of a task between two dates
   * 
   * @param task - Task to get occurrences for
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Array of task occurrences
   */
  occurrencesBetween(task: Task, startDate: Date, endDate: Date): TaskOccurrence[] {
    try {
      const occurrences: TaskOccurrence[] = []
      let currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        if (this.isDueOnDate(task, currentDate)) {
          const isBusinessDay = this.holidayChecker.isBusinessDay(currentDate)
          
          if (isBusinessDay) {
            occurrences.push({
              date: new Date(currentDate),
              isBusinessDay: true
            })
          } else {
            // Shift to business day if configured
            const shiftedDate = this.holidayChecker.shiftToBusinessDay(
              currentDate, 
              this.config.defaultShiftDirection
            )
            
            occurrences.push({
              date: shiftedDate,
              isBusinessDay: true,
              shiftedFrom: new Date(currentDate)
            })
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      return occurrences
    } catch (error) {
      console.error('Error getting occurrences between dates:', error)
      return []
    }
  }

  /**
   * Generate all occurrences for a task within a date range
   * This is useful for bulk task generation
   * 
   * @param task - Task to generate occurrences for
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of occurrence dates
   */
  generateOccurrences(task: Task, startDate: Date, endDate: Date): Date[] {
    const occurrences = this.occurrencesBetween(task, startDate, endDate)
    return occurrences.map(occ => occ.date)
  }

  // ========================================
  // FREQUENCY TYPE IMPLEMENTATIONS
  // ========================================

  /**
   * Check if once-off task is due
   */
  private isOnceOffDue(task: Task & { frequency_rules: OnceOffFrequencyRule }, date: Date): boolean {
    if (!task.frequency_rules.due_date) {
      return false
    }
    
    const dueDate = new Date(task.frequency_rules.due_date)
    return this.isSameDate(date, dueDate)
  }

  /**
   * Check if once-off sticky task is due
   * Sticky tasks persist until completed
   */
  private isOnceOffStickyDue(task: Task & { frequency_rules: OnceOffStickyFrequencyRule }, date: Date): boolean {
    if (task.frequency_rules.due_date) {
      const dueDate = new Date(task.frequency_rules.due_date)
      return date >= dueDate
    }
    
    // If no due date, task is always due
    return true
  }

  /**
   * Check if daily task is due
   */
  private isDailyDue(task: Task & { frequency_rules: DailyFrequencyRule }, date: Date): boolean {
    // Handle missing or incomplete frequency rules
    const every_n_days = task.frequency_rules?.every_n_days || 1
    const business_days_only = task.frequency_rules?.business_days_only || false
    
    console.log('Daily frequency check:', {
      every_n_days,
      business_days_only,
      date: date.toISOString().split('T')[0]
    })
    
    if (business_days_only && !this.holidayChecker.isBusinessDay(date)) {
      console.log('Not a business day, task not due')
      return false
    }
    
    // For every N days, calculate if this date should have a task
    const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
    const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    console.log('Days since start:', daysSinceStart, 'Start date:', startDate.toISOString().split('T')[0])
    
    // For daily tasks (most common case), always return true
    if (every_n_days === 1) {
      console.log('Every day task, is due')
      return true
    }
    
    const isDue = daysSinceStart >= 0 && daysSinceStart % every_n_days === 0
    console.log('Is task due:', isDue)
    
    return isDue
  }

  /**
   * Check if weekly task is due
   */
  private isWeeklyDue(task: Task & { frequency_rules: WeeklyFrequencyRule }, date: Date): boolean {
    const { every_n_weeks, start_day, business_days_only } = task.frequency_rules
    
    if (business_days_only && !this.holidayChecker.isBusinessDay(date)) {
      return false
    }
    
    const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
    const weeksSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    
    // Check if it's the right week
    if (weeksSinceStart < 0 || weeksSinceStart % every_n_weeks !== 0) {
      return false
    }
    
    // Check if it's the right day of week
    if (start_day) {
      const dayOfWeek = date.getDay() || 7 // Convert Sunday (0) to 7
      return dayOfWeek === start_day
    }
    
    return true
  }

  /**
   * Check if specific weekdays task is due
   */
  private isSpecificWeekdaysDue(task: Task & { frequency_rules: SpecificWeekdaysFrequencyRule }, date: Date): boolean {
    const { weekdays, every_n_weeks, business_days_only } = task.frequency_rules
    
    if (business_days_only && !this.holidayChecker.isBusinessDay(date)) {
      return false
    }
    
    const dayOfWeek = date.getDay() || 7 // Convert Sunday (0) to 7
    
    // Check if it's one of the specified weekdays
    if (!weekdays.includes(dayOfWeek)) {
      return false
    }
    
    // Check every N weeks if specified
    if (every_n_weeks && every_n_weeks > 1) {
      const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
      const weeksSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
      
      if (weeksSinceStart < 0 || weeksSinceStart % every_n_weeks !== 0) {
        return false
      }
    }
    
    return true
  }

  /**
   * Check if start of month task is due
   */
  private isStartOfMonthDue(task: Task & { frequency_rules: StartOfMonthFrequencyRule }, date: Date): boolean {
    const { every_n_months, months, day_offset, business_days_only } = task.frequency_rules
    
    // Check if it's the right month
    if (months && months.length > 0) {
      if (!months.includes(date.getMonth() + 1)) {
        return false
      }
    }
    
    // Check if it's the right month interval
    if (every_n_months && every_n_months > 1) {
      const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
      const monthsSinceStart = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                              (date.getMonth() - startDate.getMonth())
      
      if (monthsSinceStart < 0 || monthsSinceStart % every_n_months !== 0) {
        return false
      }
    }
    
    // Check if it's the right day offset from start of month
    const targetDay = 1 + (day_offset || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  /**
   * Check if start certain months task is due
   */
  private isStartCertainMonthsDue(task: Task & { frequency_rules: StartCertainMonthsFrequencyRule }, date: Date): boolean {
    const { months, day_offset, business_days_only } = task.frequency_rules
    
    // Check if it's one of the specified months
    if (!months.includes(date.getMonth() + 1)) {
      return false
    }
    
    // Check if it's the right day offset from start of month
    const targetDay = 1 + (day_offset || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  /**
   * Check if every month task is due
   */
  private isEveryMonthDue(task: Task & { frequency_rules: EveryMonthFrequencyRule }, date: Date): boolean {
    const { every_n_months, day_offset, business_days_only } = task.frequency_rules
    
    // Check if it's the right month interval
    if (every_n_months && every_n_months > 1) {
      const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
      const monthsSinceStart = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                              (date.getMonth() - startDate.getMonth())
      
      if (monthsSinceStart < 0 || monthsSinceStart % every_n_months !== 0) {
        return false
      }
    }
    
    // Check if it's the right day offset from start of month
    const targetDay = 1 + (day_offset || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  /**
   * Check if certain months task is due
   */
  private isCertainMonthsDue(task: Task & { frequency_rules: CertainMonthsFrequencyRule }, date: Date): boolean {
    const { months, day_offset, business_days_only } = task.frequency_rules
    
    // Check if it's one of the specified months
    if (!months.includes(date.getMonth() + 1)) {
      return false
    }
    
    // Check if it's the right day offset from start of month
    const targetDay = 1 + (day_offset || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  /**
   * Check if end of month task is due
   */
  private isEndOfMonthDue(task: Task & { frequency_rules: EndOfMonthFrequencyRule }, date: Date): boolean {
    const { every_n_months, days_from_end, business_days_only } = task.frequency_rules
    
    // Check if it's the right month interval
    if (every_n_months && every_n_months > 1) {
      const startDate = task.start_date ? new Date(task.start_date) : new Date(0)
      const monthsSinceStart = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                              (date.getMonth() - startDate.getMonth())
      
      if (monthsSinceStart < 0 || monthsSinceStart % every_n_months !== 0) {
        return false
      }
    }
    
    // Check if it's the right day from end of month
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const targetDay = lastDayOfMonth - (days_from_end || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  /**
   * Check if end certain months task is due
   */
  private isEndCertainMonthsDue(task: Task & { frequency_rules: EndCertainMonthsFrequencyRule }, date: Date): boolean {
    const { months, days_from_end, business_days_only } = task.frequency_rules
    
    // Check if it's one of the specified months
    if (!months.includes(date.getMonth() + 1)) {
      return false
    }
    
    // Check if it's the right day from end of month
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const targetDay = lastDayOfMonth - (days_from_end || 0)
    const actualDay = date.getDate()
    
    if (actualDay !== targetDay) {
      return false
    }
    
    // Apply business day logic if configured
    if (business_days_only) {
      return this.holidayChecker.isBusinessDay(date)
    }
    
    return true
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Check if two dates are the same day
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  /**
   * Get the current configuration
   */
  getConfig(): RecurrenceConfig {
    return { ...this.config }
  }

  /**
   * Update the configuration
   */
  updateConfig(newConfig: Partial<RecurrenceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get the holiday checker instance
   */
  getHolidayChecker(): HolidayChecker {
    return this.holidayChecker
  }

  /**
   * Set a new holiday checker
   */
  setHolidayChecker(holidayChecker: HolidayChecker): void {
    this.holidayChecker = holidayChecker
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Create a recurrence engine with default configuration
 */
export function createRecurrenceEngine(holidayChecker: HolidayChecker): RecurrenceEngine {
  return new RecurrenceEngine(holidayChecker)
}

/**
 * Create a recurrence engine with custom configuration
 */
export function createRecurrenceEngineWithConfig(
  holidayChecker: HolidayChecker,
  config: Partial<RecurrenceConfig>
): RecurrenceEngine {
  return new RecurrenceEngine(holidayChecker, config)
}

// ========================================
// EXPORTS
// ========================================

export type {
  Task,
  TaskOccurrence,
  RecurrenceConfig
}