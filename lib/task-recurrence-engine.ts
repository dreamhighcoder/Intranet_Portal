/**
 * Task Recurrence & Status Engine
 * Pharmacy Intranet Portal - Complete Implementation
 * 
 * This module implements the full task recurrence logic with deterministic
 * instance generation, due date/time management, carry behavior, public holiday
 * and weekend exceptions, and status transitions.
 */

import { addDays, addWeeks, addMonths, startOfMonth, endOfMonth, lastDayOfMonth, 
         isWeekend, isSameDay, format, parseISO, isAfter, isBefore, 
         startOfWeek, endOfWeek, getDay, getDaysInMonth, setDate } from 'date-fns'
import { getAustralianNow, formatAustralianDate, parseAustralianDate, 
         createAustralianDateTime, toAustralianTime } from '@/lib/timezone-utils'

// ========================================
// TYPES AND INTERFACES
// ========================================

export type FrequencyType = 
  | 'once_off'
  | 'every_day'
  | 'once_weekly'
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  | 'once_monthly'
  | 'start_of_every_month'
  | 'start_of_month_jan' | 'start_of_month_feb' | 'start_of_month_mar' | 'start_of_month_apr'
  | 'start_of_month_may' | 'start_of_month_jun' | 'start_of_month_jul' | 'start_of_month_aug'
  | 'start_of_month_sep' | 'start_of_month_oct' | 'start_of_month_nov' | 'start_of_month_dec'
  | 'end_of_every_month'
  | 'end_of_month_jan' | 'end_of_month_feb' | 'end_of_month_mar' | 'end_of_month_apr'
  | 'end_of_month_may' | 'end_of_month_jun' | 'end_of_month_jul' | 'end_of_month_aug'
  | 'end_of_month_sep' | 'end_of_month_oct' | 'end_of_month_nov' | 'end_of_month_dec'

export type TimingType = 'opening' | 'anytime_during_day' | 'before_order_cut_off' | 'closing'

export type TaskStatus = 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done'

export interface MasterTask {
  id: string
  title: string
  responsibility: string[]
  frequencies: FrequencyType[]
  categories: string[]
  timing: TimingType
  due_time?: string // Override for default timing
  publish_delay_date?: string // No instances before this date
  publish_status: 'active' | 'draft' | 'inactive'
  due_date?: string // For once-off tasks (admin-set)
}

export interface TaskInstance {
  id: string
  master_task_id: string
  instance_date: string // Date when task appears
  due_date: string
  due_time: string
  status: TaskStatus
  is_published: boolean
  completed_at?: string
  completed_by?: string
  locked: boolean
  acknowledged: boolean
  resolved: boolean
}

export interface HolidayChecker {
  isHoliday(date: string): boolean
  isWeekend(date: string): boolean
}

export interface RecurrenceEngineOptions {
  holidayChecker: HolidayChecker
  timezone?: string
}

// ========================================
// CONSTANTS
// ========================================

const TIMEZONE = 'Australia/Sydney'

// Default due times based on timing
const DEFAULT_DUE_TIMES: Record<TimingType, string> = {
  'opening': '09:30',
  'anytime_during_day': '16:30',
  'before_order_cut_off': '16:55',
  'closing': '17:00'
}

// Month numbers for specific month frequencies
const MONTH_NUMBERS: Record<string, number> = {
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Convert date to Australian timezone
 */
function toAustralianDate(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return toAustralianTime(dateObj)
}

/**
 * Format date in Australian timezone (use existing utility)
 */
function formatAustralianDateLocal(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatAustralianDate(dateObj)
}

/**
 * Check if date is a weekday (Monday-Friday)
 */
function isWeekday(date: Date): boolean {
  const day = getDay(date)
  return day >= 1 && day <= 5
}

/**
 * Get next weekday from a given date
 */
function getNextWeekday(date: Date): Date {
  let nextDay = addDays(date, 1)
  while (isWeekend(nextDay)) {
    nextDay = addDays(nextDay, 1)
  }
  return nextDay
}

/**
 * Get previous weekday from a given date
 */
function getPreviousWeekday(date: Date): Date {
  let prevDay = addDays(date, -1)
  while (isWeekend(prevDay)) {
    prevDay = addDays(prevDay, -1)
  }
  return prevDay
}

/**
 * Get the first Monday of a month, handling weekend shifts
 */
function getFirstMondayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1)
  const firstDayOfWeek = getDay(firstDay)
  
  // If 1st is already Monday, use it
  if (firstDayOfWeek === 1) {
    return firstDay
  }
  
  // If 1st is Sat/Sun, shift to first Monday after
  if (firstDayOfWeek === 0 || firstDayOfWeek === 6) {
    const daysToAdd = firstDayOfWeek === 0 ? 1 : 2
    return addDays(firstDay, daysToAdd)
  }
  
  // If 1st is Tue-Fri, use it (for start of month logic)
  return firstDay
}

/**
 * Get the last Monday of a month with at least 5 workdays remaining
 */
function getLastMondayWithWorkdays(year: number, month: number, minWorkdays: number = 5): Date {
  const lastDay = lastDayOfMonth(new Date(year, month - 1, 1))
  const lastDayNum = lastDay.getDate()
  
  // Find all Mondays in the month
  const mondays: Date[] = []
  for (let day = 1; day <= lastDayNum; day++) {
    const date = new Date(year, month - 1, day)
    if (getDay(date) === 1) {
      mondays.push(date)
    }
  }
  
  // Find the latest Monday with enough workdays remaining
  for (let i = mondays.length - 1; i >= 0; i--) {
    const monday = mondays[i]
    const workdaysRemaining = countWorkdaysAfter(monday, lastDay)
    if (workdaysRemaining >= minWorkdays) {
      return monday
    }
  }
  
  // Fallback to first Monday if no suitable Monday found
  return mondays[0] || getFirstMondayOfMonth(year, month)
}

/**
 * Count workdays between two dates (exclusive start, inclusive end)
 */
function countWorkdaysAfter(startDate: Date, endDate: Date): number {
  let count = 0
  let current = addDays(startDate, 1)
  
  while (current <= endDate) {
    if (isWeekday(current)) {
      count++
    }
    current = addDays(current, 1)
  }
  
  return count
}

/**
 * Add workdays to a date, skipping weekends and holidays
 */
function addWorkdays(date: Date, workdays: number, holidayChecker: HolidayChecker): Date {
  let current = date
  let remaining = workdays
  
  while (remaining > 0) {
    current = addDays(current, 1)
    const dateStr = formatAustralianDateLocal(current)
    
    if (isWeekday(current) && !holidayChecker.isHoliday(dateStr)) {
      remaining--
    }
  }
  
  return current
}

/**
 * Find nearest earlier non-holiday weekday in the same week
 */
function getNearestEarlierWeekday(date: Date, holidayChecker: HolidayChecker): Date {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  let current = addDays(date, -1)
  
  while (current >= weekStart) {
    const dateStr = formatAustralianDateLocal(current)
    if (isWeekday(current) && !holidayChecker.isHoliday(dateStr)) {
      return current
    }
    current = addDays(current, -1)
  }
  
  // If no earlier weekday in same week, return original date
  return date
}

/**
 * Find next non-holiday weekday forward
 */
function getNextNonHolidayWeekday(date: Date, holidayChecker: HolidayChecker): Date {
  let current = date
  
  while (true) {
    const dateStr = formatAustralianDateLocal(current)
    if (isWeekday(current) && !holidayChecker.isHoliday(dateStr)) {
      return current
    }
    current = addDays(current, 1)
  }
}

// ========================================
// MAIN RECURRENCE ENGINE
// ========================================

export class TaskRecurrenceEngine {
  private holidayChecker: HolidayChecker
  private timezone: string

  constructor(options: RecurrenceEngineOptions) {
    this.holidayChecker = options.holidayChecker
    this.timezone = options.timezone || TIMEZONE
  }

  /**
   * Check if a task should appear on a given date
   */
  shouldTaskAppear(task: MasterTask, date: string): boolean {
    // Check if task is active and published
    if (task.publish_status !== 'active') {
      return false
    }

    // Check publish delay
    if (task.publish_delay_date && date < task.publish_delay_date) {
      return false
    }

    const targetDate = parseISO(date)
    
    // Check each frequency
    for (const frequency of task.frequencies) {
      if (this.shouldFrequencyAppear(frequency, targetDate, task)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a specific frequency should appear on a date
   */
  private shouldFrequencyAppear(frequency: FrequencyType, date: Date, task: MasterTask): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const dayOfWeek = getDay(date)
    const dayOfMonth = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()

    switch (frequency) {
      case 'once_off':
        return this.shouldOnceOffAppear(task, date)

      case 'every_day':
        return this.shouldEveryDayAppear(date)

      case 'once_weekly':
        return this.shouldOnceWeeklyAppear(date)

      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
        return this.shouldWeekdayAppear(frequency, date)

      case 'once_monthly':
        return this.shouldOnceMonthlyAppear(date)

      case 'start_of_every_month':
        return this.shouldStartOfMonthAppear(date)

      case 'end_of_every_month':
        return this.shouldEndOfMonthAppear(date)

      default:
        // Handle specific month frequencies
        if (frequency.startsWith('start_of_month_')) {
          const monthName = frequency.replace('start_of_month_', '')
          const targetMonth = MONTH_NUMBERS[monthName]
          return month === targetMonth && this.shouldStartOfMonthAppear(date)
        }
        
        if (frequency.startsWith('end_of_month_')) {
          const monthName = frequency.replace('end_of_month_', '')
          const targetMonth = MONTH_NUMBERS[monthName]
          return month === targetMonth && this.shouldEndOfMonthAppear(date)
        }

        return false
    }
  }

  /**
   * Once Off frequency logic
   */
  private shouldOnceOffAppear(task: MasterTask, date: Date): boolean {
    // Once off tasks appear on the day they're first eligible and continue until done
    // For now, we'll check if it's the due date (admin-set)
    if (!task.due_date) {
      return false
    }
    
    const dueDate = parseISO(task.due_date)
    return isSameDay(date, dueDate) || isAfter(date, dueDate)
  }

  /**
   * Every Day frequency logic
   */
  private shouldEveryDayAppear(date: Date): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const dayOfWeek = getDay(date)
    
    // Exclude Sundays and public holidays
    return dayOfWeek !== 0 && !this.holidayChecker.isHoliday(dateStr)
  }

  /**
   * Once Weekly frequency logic (anchored Monday)
   */
  private shouldOnceWeeklyAppear(date: Date): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const dayOfWeek = getDay(date)
    
    // Should appear on Monday, or next available weekday if Monday is holiday
    if (dayOfWeek === 1 && !this.holidayChecker.isHoliday(dateStr)) {
      return true
    }
    
    // Check if this is a shifted day due to Monday being a holiday
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    const mondayStr = formatAustralianDateLocal(monday)
    
    if (this.holidayChecker.isHoliday(mondayStr)) {
      // Find the next available weekday in the same week
      let current = addDays(monday, 1)
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
      
      while (current <= weekEnd) {
        const currentStr = formatAustralianDateLocal(current)
        if (isWeekday(current) && !this.holidayChecker.isHoliday(currentStr)) {
          return isSameDay(date, current)
        }
        current = addDays(current, 1)
      }
    }
    
    return false
  }

  /**
   * Specific weekday frequency logic
   */
  private shouldWeekdayAppear(frequency: string, date: Date): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const dayOfWeek = getDay(date)
    
    // Map frequency to day number
    const targetDay = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    }[frequency]
    
    if (!targetDay) return false
    
    // If target day and not holiday, appear
    if (dayOfWeek === targetDay && !this.holidayChecker.isHoliday(dateStr)) {
      return true
    }
    
    // Handle holiday shifts
    const targetDate = this.getWeekdayInWeek(date, targetDay)
    const targetDateStr = formatAustralianDateLocal(targetDate)
    
    if (this.holidayChecker.isHoliday(targetDateStr)) {
      // For Tue-Sat: try nearest earlier weekday in same week
      if (targetDay >= 2) {
        const earlierDay = this.getNearestEarlierWeekday(targetDate, this.holidayChecker)
        if (isSameDay(date, earlierDay)) {
          return true
        }
      }
      
      // If no earlier day or Monday, try next weekday forward
      const nextDay = this.getNextNonHolidayWeekday(targetDate, this.holidayChecker)
      return isSameDay(date, nextDay)
    }
    
    return false
  }

  /**
   * Get specific weekday in the same week as given date
   */
  private getWeekdayInWeek(date: Date, targetDay: number): Date {
    const currentDay = getDay(date)
    const diff = targetDay - currentDay
    return addDays(date, diff)
  }

  /**
   * Once Monthly frequency logic
   */
  private shouldOnceMonthlyAppear(date: Date): boolean {
    // Same appearance rule as Start of Month
    return this.shouldStartOfMonthAppear(date)
  }

  /**
   * Start of Month frequency logic
   */
  private shouldStartOfMonthAppear(date: Date): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const dayOfMonth = date.getDate()
    const dayOfWeek = getDay(date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    
    // Get the 1st of the month
    const firstOfMonth = new Date(year, month - 1, 1)
    const firstDayOfWeek = getDay(firstOfMonth)
    
    // If 1st is weekday and not holiday, use 1st
    if (isWeekday(firstOfMonth)) {
      const firstStr = formatAustralianDateLocal(firstOfMonth)
      if (!this.holidayChecker.isHoliday(firstStr)) {
        return dayOfMonth === 1
      }
    }
    
    // If 1st is weekend or holiday, use first Monday after
    const firstMonday = getFirstMondayOfMonth(year, month)
    const firstMondayStr = formatAustralianDateLocal(firstMonday)
    
    // If first Monday is holiday, shift to next non-holiday weekday
    if (this.holidayChecker.isHoliday(firstMondayStr)) {
      const shiftedDate = this.getNextNonHolidayWeekday(firstMonday, this.holidayChecker)
      return isSameDay(date, shiftedDate)
    }
    
    return isSameDay(date, firstMonday)
  }

  /**
   * End of Month frequency logic
   */
  private shouldEndOfMonthAppear(date: Date): boolean {
    const dateStr = formatAustralianDateLocal(date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    
    // Get last Monday with at least 5 workdays
    const lastMonday = getLastMondayWithWorkdays(year, month, 5)
    const lastMondayStr = formatAustralianDateLocal(lastMonday)
    
    // If last Monday is holiday, shift to next non-holiday weekday
    if (this.holidayChecker.isHoliday(lastMondayStr)) {
      const shiftedDate = this.getNextNonHolidayWeekday(lastMonday, this.holidayChecker)
      return isSameDay(date, shiftedDate)
    }
    
    return isSameDay(date, lastMonday)
  }

  /**
   * Calculate due date for a task instance
   */
  calculateDueDate(task: MasterTask, instanceDate: string, frequency: FrequencyType): string {
    const instanceDateObj = parseISO(instanceDate)
    
    switch (frequency) {
      case 'once_off':
        // Use admin-set due date
        return task.due_date || instanceDate

      case 'every_day':
        // Due same day
        return instanceDate

      case 'once_weekly':
        // Due Saturday of that week, or nearest earlier non-holiday weekday
        return this.calculateWeeklyDueDate(instanceDateObj)

      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
        // Due on the scheduled day (after any holiday shift)
        return instanceDate

      case 'start_of_every_month':
      case 'start_of_month_jan':
      case 'start_of_month_feb':
      case 'start_of_month_mar':
      case 'start_of_month_apr':
      case 'start_of_month_may':
      case 'start_of_month_jun':
      case 'start_of_month_jul':
      case 'start_of_month_aug':
      case 'start_of_month_sep':
      case 'start_of_month_oct':
      case 'start_of_month_nov':
      case 'start_of_month_dec':
        // Due 5 workdays from appearance
        return this.calculateStartOfMonthDueDate(instanceDateObj)

      case 'once_monthly':
      case 'end_of_every_month':
      case 'end_of_month_jan':
      case 'end_of_month_feb':
      case 'end_of_month_mar':
      case 'end_of_month_apr':
      case 'end_of_month_may':
      case 'end_of_month_jun':
      case 'end_of_month_jul':
      case 'end_of_month_aug':
      case 'end_of_month_sep':
      case 'end_of_month_oct':
      case 'end_of_month_nov':
      case 'end_of_month_dec':
        // Due last Saturday of month, or nearest earlier non-holiday weekday
        return this.calculateMonthlyDueDate(instanceDateObj)

      default:
        return instanceDate
    }
  }

  /**
   * Calculate due date for weekly tasks (Saturday of the week)
   */
  private calculateWeeklyDueDate(instanceDate: Date): string {
    const saturday = endOfWeek(instanceDate, { weekStartsOn: 1 })
    const saturdayStr = formatAustralianDateLocal(saturday)
    
    // If Saturday is holiday, use nearest earlier non-holiday weekday
    if (this.holidayChecker.isHoliday(saturdayStr)) {
      const earlierDate = this.getNearestEarlierWeekday(saturday, this.holidayChecker)
      return formatAustralianDateLocal(earlierDate)
    }
    
    return formatAustralianDateLocal(saturday)
  }

  /**
   * Calculate due date for start of month tasks (5 workdays from appearance)
   */
  private calculateStartOfMonthDueDate(instanceDate: Date): string {
    const dueDate = addWorkdays(instanceDate, 5, this.holidayChecker)
    const dueDateStr = formatAustralianDateLocal(dueDate)
    
    // If due date lands on holiday, extend to next day
    if (this.holidayChecker.isHoliday(dueDateStr)) {
      const nextDay = this.getNextNonHolidayWeekday(dueDate, this.holidayChecker)
      return formatAustralianDateLocal(nextDay)
    }
    
    return formatAustralianDateLocal(dueDate)
  }

  /**
   * Calculate due date for monthly tasks (last Saturday of month)
   */
  private calculateMonthlyDueDate(instanceDate: Date): string {
    const year = instanceDate.getFullYear()
    const month = instanceDate.getMonth() + 1
    const lastDay = lastDayOfMonth(instanceDate)
    
    // Find last Saturday of month
    let lastSaturday = lastDay
    while (getDay(lastSaturday) !== 6) {
      lastSaturday = addDays(lastSaturday, -1)
    }
    
    const lastSaturdayStr = formatAustralianDateLocal(lastSaturday)
    
    // If Saturday is holiday, use nearest earlier non-holiday weekday
    if (this.holidayChecker.isHoliday(lastSaturdayStr)) {
      const earlierDate = this.getNearestEarlierWeekday(lastSaturday, this.holidayChecker)
      return formatAustralianDateLocal(earlierDate)
    }
    
    return formatAustralianDateLocal(lastSaturday)
  }

  /**
   * Calculate due time for a task
   */
  calculateDueTime(task: MasterTask): string {
    // Use override if present, otherwise use default timing
    return task.due_time || DEFAULT_DUE_TIMES[task.timing]
  }

  /**
   * Check if a task should continue carrying over to subsequent days
   */
  shouldTaskCarry(task: MasterTask, frequency: FrequencyType, instanceDate: string, currentDate: string): boolean {
    const instanceDateObj = parseISO(instanceDate)
    const currentDateObj = parseISO(currentDate)
    const dueDate = parseISO(this.calculateDueDate(task, instanceDate, frequency))
    
    switch (frequency) {
      case 'once_off':
        // Continues until done (no auto-stop)
        return true

      case 'every_day':
        // No carry; each day has its own instance
        return false

      case 'once_weekly':
        // Carries until Saturday of that week (or earlier holiday stop)
        const weekEnd = endOfWeek(instanceDateObj, { weekStartsOn: 1 })
        const weekEndStr = formatAustralianDateLocal(weekEnd)
        
        if (this.holidayChecker.isHoliday(weekEndStr)) {
          const stopDate = this.getNearestEarlierWeekday(weekEnd, this.holidayChecker)
          return currentDateObj <= stopDate
        }
        
        return currentDateObj <= weekEnd

      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
        // Carries until Saturday of that week, even after due date
        const weekEndWeekday = endOfWeek(instanceDateObj, { weekStartsOn: 1 })
        const weekEndWeekdayStr = formatAustralianDateLocal(weekEndWeekday)
        
        if (this.holidayChecker.isHoliday(weekEndWeekdayStr)) {
          const stopDateWeekday = this.getNearestEarlierWeekday(weekEndWeekday, this.holidayChecker)
          return currentDateObj <= stopDateWeekday
        }
        
        return currentDateObj <= weekEndWeekday

      case 'start_of_every_month':
      case 'start_of_month_jan':
      case 'start_of_month_feb':
      case 'start_of_month_mar':
      case 'start_of_month_apr':
      case 'start_of_month_may':
      case 'start_of_month_jun':
      case 'start_of_month_jul':
      case 'start_of_month_aug':
      case 'start_of_month_sep':
      case 'start_of_month_oct':
      case 'start_of_month_nov':
      case 'start_of_month_dec':
        // Carries until last Saturday of month, even after due date
        const monthEnd = endOfMonth(instanceDateObj)
        let lastSaturday = monthEnd
        while (getDay(lastSaturday) !== 6) {
          lastSaturday = addDays(lastSaturday, -1)
        }
        
        const lastSaturdayStr = formatAustralianDateLocal(lastSaturday)
        if (this.holidayChecker.isHoliday(lastSaturdayStr)) {
          const stopDateMonth = this.getNearestEarlierWeekday(lastSaturday, this.holidayChecker)
          return currentDateObj <= stopDateMonth
        }
        
        return currentDateObj <= lastSaturday

      case 'once_monthly':
      case 'end_of_every_month':
      case 'end_of_month_jan':
      case 'end_of_month_feb':
      case 'end_of_month_mar':
      case 'end_of_month_apr':
      case 'end_of_month_may':
      case 'end_of_month_jun':
      case 'end_of_month_jul':
      case 'end_of_month_aug':
      case 'end_of_month_sep':
      case 'end_of_month_oct':
      case 'end_of_month_nov':
      case 'end_of_month_dec':
        // Only carries until due date, not past
        return currentDateObj <= dueDate

      default:
        return false
    }
  }

  /**
   * Calculate when a task should be locked (missed status)
   */
  calculateLockTime(task: MasterTask, frequency: FrequencyType, instanceDate: string, dueDate: string): string | null {
    const dueDateObj = parseISO(dueDate)
    const instanceDateObj = parseISO(instanceDate)
    
    switch (frequency) {
      case 'once_off':
        // Never auto-lock
        return null

      case 'every_day':
        // Lock at 23:59 same date
        return `${dueDate} 23:59`

      case 'once_weekly':
        // Lock at 23:59 on due date
        return `${dueDate} 23:59`

      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
        // Lock at 23:59 on Saturday of that week (or earlier holiday stop)
        const weekEnd = endOfWeek(instanceDateObj, { weekStartsOn: 1 })
        const weekEndStr = formatAustralianDateLocal(weekEnd)
        
        if (this.holidayChecker.isHoliday(weekEndStr)) {
          const stopDate = this.getNearestEarlierWeekday(weekEnd, this.holidayChecker)
          return `${formatAustralianDateLocal(stopDate)} 23:59`
        }
        
        return `${weekEndStr} 23:59`

      case 'start_of_every_month':
      case 'start_of_month_jan':
      case 'start_of_month_feb':
      case 'start_of_month_mar':
      case 'start_of_month_apr':
      case 'start_of_month_may':
      case 'start_of_month_jun':
      case 'start_of_month_jul':
      case 'start_of_month_aug':
      case 'start_of_month_sep':
      case 'start_of_month_oct':
      case 'start_of_month_nov':
      case 'start_of_month_dec':
        // Lock at 23:59 on last Saturday of month (or earlier holiday stop)
        const monthEnd = endOfMonth(instanceDateObj)
        let lastSaturday = monthEnd
        while (getDay(lastSaturday) !== 6) {
          lastSaturday = addDays(lastSaturday, -1)
        }
        
        const lastSaturdayStr = formatAustralianDateLocal(lastSaturday)
        if (this.holidayChecker.isHoliday(lastSaturdayStr)) {
          const stopDate = this.getNearestEarlierWeekday(lastSaturday, this.holidayChecker)
          return `${formatAustralianDateLocal(stopDate)} 23:59`
        }
        
        return `${lastSaturdayStr} 23:59`

      case 'once_monthly':
      case 'end_of_every_month':
      case 'end_of_month_jan':
      case 'end_of_month_feb':
      case 'end_of_month_mar':
      case 'end_of_month_apr':
      case 'end_of_month_may':
      case 'end_of_month_jun':
      case 'end_of_month_jul':
      case 'end_of_month_aug':
      case 'end_of_month_sep':
      case 'end_of_month_oct':
      case 'end_of_month_nov':
      case 'end_of_month_dec':
        // Lock at 23:59 on due date
        return `${dueDate} 23:59`

      default:
        return null
    }
  }

  /**
   * Update task status based on current time and due time
   */
  updateTaskStatus(instance: TaskInstance, currentTime: Date = getAustralianNow()): TaskStatus {
    if (instance.status === 'done') {
      return 'done'
    }

    const dueDateTime = parseISO(`${instance.due_date}T${instance.due_time}:00`)
    const dueDateTimeAus = toAustralianDate(dueDateTime)
    
    // Check if overdue
    if (currentTime > dueDateTimeAus) {
      return 'overdue'
    }
    
    // Check if due today
    const today = formatAustralianDateLocal(currentTime)
    if (instance.due_date === today) {
      return 'due_today'
    }
    
    return 'not_due'
  }
}

export default TaskRecurrenceEngine