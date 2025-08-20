/**
 * Simple Frequency Handler for Master Checklist System
 * Pharmacy Intranet Portal - Simple Frequency Processing
 * 
 * This module handles the simple frequency strings from the frequencies array
 * and determines if a task should appear on a given date.
 */

import type { HolidayChecker } from './public-holidays'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Simple task interface for frequency calculations
 */
export interface SimpleTask {
  id: string
  frequencies: string[]
  due_date?: string // For once-off tasks
  start_date?: string // When task becomes active
  end_date?: string // When task expires
}

/**
 * Simple frequency handler options
 */
export interface SimpleFrequencyOptions {
  holidayChecker?: HolidayChecker
  timezone?: string
}

// ========================================
// SIMPLE FREQUENCY HANDLER
// ========================================

/**
 * Creates a simple frequency handler for basic frequency strings
 */
export function createSimpleFrequencyHandler(options: SimpleFrequencyOptions = {}) {
  const { holidayChecker, timezone = 'Australia/Sydney' } = options

  /**
   * Check if a task is due on a specific date based on its frequencies array
   */
  function isTaskDue(task: SimpleTask, date: string): boolean {
    if (!task.frequencies || task.frequencies.length === 0) {
      return false
    }

    const targetDate = new Date(date + 'T00:00:00')
    const dayOfWeek = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = targetDate.getDate()
    const month = targetDate.getMonth() + 1 // 1-12
    const year = targetDate.getFullYear()

    // Check if task is within active date range
    if (task.start_date && date < task.start_date) {
      return false
    }
    if (task.end_date && date > task.end_date) {
      return false
    }

    // Check each frequency in the array
    for (const frequency of task.frequencies) {
      if (isFrequencyDue(frequency, targetDate, task)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a specific frequency is due on the target date
   */
  function isFrequencyDue(frequency: string, targetDate: Date, task: SimpleTask): boolean {
    const dayOfWeek = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = targetDate.getDate()
    const month = targetDate.getMonth() + 1 // 1-12
    const year = targetDate.getFullYear()
    const dateString = targetDate.toISOString().split('T')[0]

    // Check if it's a public holiday
    const isHoliday = holidayChecker?.isHoliday(dateString) || false

    switch (frequency) {
      case 'once_off':
        // Once off tasks are due on their specific due date
        return task.due_date === dateString

      case 'every_day':
        // Every day except Sundays and public holidays
        return dayOfWeek !== 0 && !isHoliday

      case 'once_weekly':
        // Once weekly on Monday (or next available weekday if Monday is holiday)
        return dayOfWeek === 1 && !isHoliday

      case 'monday':
        return dayOfWeek === 1 && !isHoliday
      case 'tuesday':
        return dayOfWeek === 2 && !isHoliday
      case 'wednesday':
        return dayOfWeek === 3 && !isHoliday
      case 'thursday':
        return dayOfWeek === 4 && !isHoliday
      case 'friday':
        return dayOfWeek === 5 && !isHoliday
      case 'saturday':
        return dayOfWeek === 6 && !isHoliday

      case 'once_monthly':
        // Once monthly on the first Monday of the month
        return isFirstMondayOfMonth(targetDate) && !isHoliday

      case 'start_of_every_month':
        // Start of every month (1st, or first Monday if 1st is weekend)
        return isStartOfMonth(targetDate) && !isHoliday

      case 'end_of_every_month':
        // End of every month (last Monday with at least 5 workdays before month end)
        return isEndOfMonth(targetDate) && !isHoliday

      // Specific month frequencies
      case 'start_of_month_jan':
        return month === 1 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_feb':
        return month === 2 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_mar':
        return month === 3 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_apr':
        return month === 4 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_may':
        return month === 5 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_jun':
        return month === 6 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_jul':
        return month === 7 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_aug':
        return month === 8 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_sep':
        return month === 9 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_oct':
        return month === 10 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_nov':
        return month === 11 && isStartOfMonth(targetDate) && !isHoliday
      case 'start_of_month_dec':
        return month === 12 && isStartOfMonth(targetDate) && !isHoliday

      case 'end_of_month_jan':
        return month === 1 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_feb':
        return month === 2 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_mar':
        return month === 3 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_apr':
        return month === 4 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_may':
        return month === 5 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_jun':
        return month === 6 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_jul':
        return month === 7 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_aug':
        return month === 8 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_sep':
        return month === 9 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_oct':
        return month === 10 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_nov':
        return month === 11 && isEndOfMonth(targetDate) && !isHoliday
      case 'end_of_month_dec':
        return month === 12 && isEndOfMonth(targetDate) && !isHoliday

      default:
        return false
    }
  }

  /**
   * Check if the date is the first Monday of the month
   */
  function isFirstMondayOfMonth(date: Date): boolean {
    const dayOfWeek = date.getDay()
    const dayOfMonth = date.getDate()
    
    // Must be a Monday
    if (dayOfWeek !== 1) return false
    
    // Must be in the first week (day 1-7)
    return dayOfMonth <= 7
  }

  /**
   * Check if the date is considered "start of month"
   * - If 1st is weekday: use 1st
   * - If 1st is weekend: use first Monday after
   */
  function isStartOfMonth(date: Date): boolean {
    const dayOfMonth = date.getDate()
    const dayOfWeek = date.getDay()
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // Get the 1st of the month
    const firstOfMonth = new Date(year, month, 1)
    const firstDayOfWeek = firstOfMonth.getDay()
    
    // If 1st is weekday (Mon-Fri), use 1st
    if (firstDayOfWeek >= 1 && firstDayOfWeek <= 5) {
      return dayOfMonth === 1
    }
    
    // If 1st is weekend, use first Monday after
    if (firstDayOfWeek === 0) { // Sunday
      return dayOfWeek === 1 && dayOfMonth >= 2 && dayOfMonth <= 3
    } else { // Saturday
      return dayOfWeek === 1 && dayOfMonth >= 3 && dayOfMonth <= 4
    }
  }

  /**
   * Check if the date is considered "end of month"
   * - Last Monday of the month with at least 5 workdays before month end
   */
  function isEndOfMonth(date: Date): boolean {
    const dayOfWeek = date.getDay()
    const dayOfMonth = date.getDate()
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // Must be a Monday
    if (dayOfWeek !== 1) return false
    
    // Get last day of month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    
    // Calculate workdays remaining after this Monday
    let workdaysRemaining = 0
    for (let day = dayOfMonth + 1; day <= lastDayOfMonth; day++) {
      const testDate = new Date(year, month, day)
      const testDayOfWeek = testDate.getDay()
      // Count weekdays (Mon-Fri)
      if (testDayOfWeek >= 1 && testDayOfWeek <= 5) {
        workdaysRemaining++
      }
    }
    
    // Must have at least 5 workdays remaining
    return workdaysRemaining >= 5
  }

  return {
    isTaskDue,
    isFrequencyDue
  }
}

export type SimpleFrequencyHandler = ReturnType<typeof createSimpleFrequencyHandler>