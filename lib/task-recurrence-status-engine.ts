/**
 * Task Recurrence & Status Engine
 * Pharmacy Intranet Portal - Complete Implementation
 * 
 * This module implements the exact recurrence rules as specified:
 * 1. Once Off - appears daily until done, never auto-locks
 * 2. Every Day - new daily instance excluding Sundays & PHs, locks at 23:59 same date
 * 3. Once Weekly - Monday-anchored, carries through Saturday, locks on due date
 * 4. Every Mon/Tue/Wed/Thu/Fri/Sat - specific weekday, carries through Saturday
 * 5. Start of Month - 1st of month (with shifts), +5 workdays due, carries to last Saturday
 * 6. Start of January/February/etc - same as Start of Month but specific months
 * 7. Once Monthly - same appearance as Start of Month, due last Saturday, locks on due date
 * 8. End of Month - last Monday with ≥5 workdays, due last Saturday, locks on due date
 * 9. End of January/February/etc - same as End of Month but specific months
 */

import { createHolidayHelper, type HolidayChecker } from './public-holidays'

// ========================================
// FACTORY FUNCTION
// ========================================

/**
 * Create a TaskRecurrenceStatusEngine instance with public holidays
 */
export async function createTaskRecurrenceStatusEngine(businessTimezone: string = 'Australia/Sydney'): Promise<TaskRecurrenceStatusEngine> {
  // Load public holidays from database
  const { supabase } = await import('./db')
  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('date, name')
    .order('date')
  
  return new TaskRecurrenceStatusEngine(holidays || [], businessTimezone)
}

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Frequency types matching the specification exactly
 */
export enum FrequencyType {
  ONCE_OFF = 'once_off',
  EVERY_DAY = 'every_day',
  ONCE_WEEKLY = 'once_weekly',
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  ONCE_MONTHLY = 'once_monthly',
  START_OF_EVERY_MONTH = 'start_of_every_month',
  START_OF_MONTH_JAN = 'start_of_month_jan',
  START_OF_MONTH_FEB = 'start_of_month_feb',
  START_OF_MONTH_MAR = 'start_of_month_mar',
  START_OF_MONTH_APR = 'start_of_month_apr',
  START_OF_MONTH_MAY = 'start_of_month_may',
  START_OF_MONTH_JUN = 'start_of_month_jun',
  START_OF_MONTH_JUL = 'start_of_month_jul',
  START_OF_MONTH_AUG = 'start_of_month_aug',
  START_OF_MONTH_SEP = 'start_of_month_sep',
  START_OF_MONTH_OCT = 'start_of_month_oct',
  START_OF_MONTH_NOV = 'start_of_month_nov',
  START_OF_MONTH_DEC = 'start_of_month_dec',
  END_OF_EVERY_MONTH = 'end_of_every_month',
  END_OF_MONTH_JAN = 'end_of_month_jan',
  END_OF_MONTH_FEB = 'end_of_month_feb',
  END_OF_MONTH_MAR = 'end_of_month_mar',
  END_OF_MONTH_APR = 'end_of_month_apr',
  END_OF_MONTH_MAY = 'end_of_month_may',
  END_OF_MONTH_JUN = 'end_of_month_jun',
  END_OF_MONTH_JUL = 'end_of_month_jul',
  END_OF_MONTH_AUG = 'end_of_month_aug',
  END_OF_MONTH_SEP = 'end_of_month_sep',
  END_OF_MONTH_OCT = 'end_of_month_oct',
  END_OF_MONTH_NOV = 'end_of_month_nov',
  END_OF_MONTH_DEC = 'end_of_month_dec'
}

/**
 * Task status enum matching specification
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  OVERDUE = 'overdue',
  MISSED = 'missed',
  DONE = 'done'
}

/**
 * Master task interface for the engine
 */
export interface MasterTask {
  id: string
  active: boolean
  frequencies: FrequencyType[]
  timing: string // Default due time (HH:MM format)
  publish_at?: string // ISO date string - no instances before this date
  due_date?: string // For OnceOff tasks - admin-entered due date
  start_date?: string // When task becomes active
  end_date?: string // When task expires
}

/**
 * Task instance interface
 */
export interface TaskInstance {
  id: string
  master_task_id: string
  date: string // ISO date string (YYYY-MM-DD)
  due_date: string // ISO date string
  due_time: string // HH:MM format
  status: TaskStatus
  locked: boolean
  created_at: string
  updated_at: string
  
  // Optional overrides
  due_date_override?: string
  due_time_override?: string
  
  // Carry tracking
  is_carry_instance: boolean
  original_appearance_date?: string
}

/**
 * Generation result for a single date
 */
export interface GenerationResult {
  date: string
  new_instances: TaskInstance[]
  carry_instances: TaskInstance[]
  total_instances: number
}

/**
 * Status update result
 */
export interface StatusUpdateResult {
  instance_id: string
  old_status: TaskStatus
  new_status: TaskStatus
  locked: boolean
  reason: string
  updated: boolean
}

/**
 * Appearance calculation result
 */
interface AppearanceResult {
  should_appear: boolean
  is_carry_instance: boolean
  due_date: string
  original_appearance_date?: string
  stop_appearing_after?: string // Date after which instance should not appear
}

// ========================================
// MAIN ENGINE CLASS
// ========================================

export class TaskRecurrenceStatusEngine {
  private holidayChecker: HolidayChecker
  private businessTimezone: string

  constructor(publicHolidays: any[] = [], businessTimezone: string = 'Australia/Sydney') {
    this.holidayChecker = createHolidayHelper(publicHolidays)
    this.businessTimezone = businessTimezone
  }

  /**
   * Generate task instances for a specific date
   */
  generateInstancesForDate(masterTasks: MasterTask[], date: string): GenerationResult {
    const targetDate = new Date(date + 'T00:00:00')
    const new_instances: TaskInstance[] = []
    const carry_instances: TaskInstance[] = []

    for (const task of masterTasks) {
      // Skip if not active or before publish_at date
      if (!task.active) continue
      if (task.publish_at && targetDate < new Date(task.publish_at + 'T00:00:00')) continue

      // Process each frequency in the task
      for (const frequency of task.frequencies) {
        const result = this.calculateAppearance(task, frequency, targetDate)
        
        if (result.should_appear) {
          const instance: TaskInstance = {
            id: `${task.id}-${frequency}-${date}`,
            master_task_id: task.id,
            date: date,
            due_date: result.due_date,
            due_time: task.timing,
            status: TaskStatus.PENDING,
            locked: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_carry_instance: result.is_carry_instance,
            original_appearance_date: result.original_appearance_date
          }

          if (result.is_carry_instance) {
            carry_instances.push(instance)
          } else {
            new_instances.push(instance)
          }
        }
      }
    }

    return {
      date,
      new_instances,
      carry_instances,
      total_instances: new_instances.length + carry_instances.length
    }
  }

  /**
   * Update statuses for existing instances based on current time
   */
  updateInstanceStatuses(instances: TaskInstance[], currentDateTime: Date): StatusUpdateResult[] {
    const results: StatusUpdateResult[] = []

    for (const instance of instances) {
      const result = this.calculateStatusUpdate(instance, currentDateTime)
      results.push(result)
    }

    return results
  }

  /**
   * Calculate if a task should appear on a specific date for a given frequency
   */
  private calculateAppearance(task: MasterTask, frequency: FrequencyType, date: Date): AppearanceResult {
    // Check if task is within active period
    if (task.start_date && date < new Date(task.start_date + 'T00:00:00')) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }
    
    if (task.end_date && date > new Date(task.end_date + 'T00:00:00')) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }

    switch (frequency) {
      case FrequencyType.ONCE_OFF:
        return this.calculateOnceOff(task, date)
      
      case FrequencyType.EVERY_DAY:
        return this.calculateEveryDay(task, date)
      
      case FrequencyType.ONCE_WEEKLY:
        return this.calculateOnceWeekly(task, date)
      
      case FrequencyType.MONDAY:
      case FrequencyType.TUESDAY:
      case FrequencyType.WEDNESDAY:
      case FrequencyType.THURSDAY:
      case FrequencyType.FRIDAY:
      case FrequencyType.SATURDAY:
        return this.calculateSpecificWeekday(task, frequency, date)
      
      case FrequencyType.START_OF_EVERY_MONTH:
        return this.calculateStartOfMonth(task, date, null)
      
      case FrequencyType.START_OF_MONTH_JAN:
      case FrequencyType.START_OF_MONTH_FEB:
      case FrequencyType.START_OF_MONTH_MAR:
      case FrequencyType.START_OF_MONTH_APR:
      case FrequencyType.START_OF_MONTH_MAY:
      case FrequencyType.START_OF_MONTH_JUN:
      case FrequencyType.START_OF_MONTH_JUL:
      case FrequencyType.START_OF_MONTH_AUG:
      case FrequencyType.START_OF_MONTH_SEP:
      case FrequencyType.START_OF_MONTH_OCT:
      case FrequencyType.START_OF_MONTH_NOV:
      case FrequencyType.START_OF_MONTH_DEC:
        return this.calculateStartOfSpecificMonth(task, frequency, date)
      
      case FrequencyType.ONCE_MONTHLY:
        return this.calculateOnceMonthly(task, date)
      
      case FrequencyType.END_OF_EVERY_MONTH:
        return this.calculateEndOfMonth(task, date, null)
      
      case FrequencyType.END_OF_MONTH_JAN:
      case FrequencyType.END_OF_MONTH_FEB:
      case FrequencyType.END_OF_MONTH_MAR:
      case FrequencyType.END_OF_MONTH_APR:
      case FrequencyType.END_OF_MONTH_MAY:
      case FrequencyType.END_OF_MONTH_JUN:
      case FrequencyType.END_OF_MONTH_JUL:
      case FrequencyType.END_OF_MONTH_AUG:
      case FrequencyType.END_OF_MONTH_SEP:
      case FrequencyType.END_OF_MONTH_OCT:
      case FrequencyType.END_OF_MONTH_NOV:
      case FrequencyType.END_OF_MONTH_DEC:
        return this.calculateEndOfSpecificMonth(task, frequency, date)
      
      default:
        return { should_appear: false, is_carry_instance: false, due_date: '' }
    }
  }

  /**
   * 1) Once Off - Appear on first eligible day, carry daily until done, never auto-lock
   */
  private calculateOnceOff(task: MasterTask, date: Date): AppearanceResult {
    if (!task.due_date) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }

    const dueDate = new Date(task.due_date + 'T00:00:00')
    const firstEligibleDate = task.publish_at ? new Date(task.publish_at + 'T00:00:00') : dueDate

    // Appears from first eligible date onwards (same instance continues)
    if (date >= firstEligibleDate) {
      return {
        should_appear: true,
        is_carry_instance: date > firstEligibleDate,
        due_date: task.due_date,
        original_appearance_date: this.formatDate(firstEligibleDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * 2) Every Day - New daily instance excluding Sundays & PHs, locks at 23:59 same date
   */
  private calculateEveryDay(task: MasterTask, date: Date): AppearanceResult {
    // Skip Sundays (day 0) and public holidays
    if (date.getDay() === 0 || this.holidayChecker.isHoliday(date)) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }

    return {
      should_appear: true,
      is_carry_instance: false,
      due_date: this.formatDate(date)
    }
  }

  /**
   * 3) Once Weekly - Monday anchored, carries through Saturday, locks on due date
   */
  private calculateOnceWeekly(task: MasterTask, date: Date): AppearanceResult {
    const monday = this.getWeekMonday(date)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)

    // Find the appearance date (Monday or shifted)
    let appearanceDate = new Date(monday)
    if (this.holidayChecker.isHoliday(appearanceDate)) {
      // If Monday is PH → Tuesday
      appearanceDate.setDate(appearanceDate.getDate() + 1)
      if (this.holidayChecker.isHoliday(appearanceDate)) {
        // If Tuesday also PH → next latest weekday forward in same week
        appearanceDate = this.findNextWeekdayInWeek(appearanceDate, saturday)
      }
    }

    // Find the due date (Saturday or nearest earlier non-PH weekday)
    let dueDate = new Date(saturday)
    if (this.holidayChecker.isHoliday(dueDate)) {
      const earlierDate = this.findNearestEarlierWeekdayInWeek(dueDate, monday)
      dueDate = earlierDate || dueDate // Fallback to original if no earlier date found
    }

    // Appears from appearance date through due date
    if (date >= appearanceDate && date <= dueDate) {
      return {
        should_appear: true,
        is_carry_instance: date > appearanceDate,
        due_date: this.formatDate(dueDate),
        original_appearance_date: this.formatDate(appearanceDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * 4) Every Mon/Tue/Wed/Thu/Fri/Sat - Specific weekday, carries through Saturday
   */
  private calculateSpecificWeekday(task: MasterTask, frequency: FrequencyType, date: Date): AppearanceResult {
    const targetWeekday = this.getTargetWeekday(frequency)
    const weekMonday = this.getWeekMonday(date)
    const weekSaturday = new Date(weekMonday)
    weekSaturday.setDate(weekMonday.getDate() + 5)

    // Find the scheduled day in this week
    const scheduledDay = new Date(weekMonday)
    scheduledDay.setDate(weekMonday.getDate() + (targetWeekday - 1))

    // Handle PH shifting
    let appearanceDate = new Date(scheduledDay)
    if (this.holidayChecker.isHoliday(appearanceDate)) {
      if (targetWeekday === 1) { // Monday
        // For Mon: appear on next latest non-PH weekday forward
        appearanceDate = this.findNextWeekdayInWeek(appearanceDate, weekSaturday)
      } else { // Tue-Sat
        // For Tue-Sat: appear on nearest earlier non-PH weekday in same week
        const earlierDate = this.findNearestEarlierWeekdayInWeek(appearanceDate, weekMonday)
        if (earlierDate) {
          appearanceDate = earlierDate
        } else {
          // If none earlier, appear on next latest non-PH weekday forward
          appearanceDate = this.findNextWeekdayInWeek(appearanceDate, weekSaturday)
        }
      }
    }

    // Find the cutoff date (Saturday or nearest earlier non-PH weekday)
    let cutoffDate = new Date(weekSaturday)
    if (this.holidayChecker.isHoliday(cutoffDate)) {
      cutoffDate = this.findNearestEarlierWeekdayInWeek(cutoffDate, weekMonday) || cutoffDate
    }

    // Appears from appearance date through cutoff date
    if (date >= appearanceDate && date <= cutoffDate) {
      return {
        should_appear: true,
        is_carry_instance: date > appearanceDate,
        due_date: this.formatDate(scheduledDay), // Due date is the original scheduled day
        original_appearance_date: this.formatDate(appearanceDate),
        stop_appearing_after: this.formatDate(cutoffDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * 5) Start of Month - 1st of month (with shifts), +5 workdays due, carries to last Saturday
   */
  private calculateStartOfMonth(task: MasterTask, date: Date, specificMonth: number | null): AppearanceResult {
    // Only process if we're in the target month (or any month if specificMonth is null)
    const targetMonth = date.getMonth()
    if (specificMonth !== null && targetMonth !== specificMonth) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }

    const targetYear = date.getFullYear()
    const firstOfMonth = new Date(targetYear, targetMonth, 1)
    
    // Find appearance date for this month
    let appearanceDate = new Date(firstOfMonth)
    if (this.isWeekend(appearanceDate)) {
      // If 1st is Sat/Sun → first Monday after
      appearanceDate = this.findFirstMondayAfter(appearanceDate)
    }
    if (this.holidayChecker.isHoliday(appearanceDate)) {
      // If that day is PH → next latest non-PH weekday forward
      appearanceDate = this.findNextWeekday(appearanceDate)
    }

    // Calculate due date: +5 workdays from appearance
    const dueDate = this.addWorkdays(appearanceDate, 5)
    
    // Find cutoff date: last Saturday of month (or nearest earlier non-PH)
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    let cutoffDate = new Date(lastSaturday)
    if (this.holidayChecker.isHoliday(cutoffDate)) {
      const earlierDate = this.findNearestEarlierWeekdayInMonth(cutoffDate)
      if (earlierDate) {
        cutoffDate = earlierDate
      }
    }

    // Appears from appearance date through cutoff date
    if (date >= appearanceDate && date <= cutoffDate) {
      return {
        should_appear: true,
        is_carry_instance: date > appearanceDate,
        due_date: this.formatDate(dueDate),
        original_appearance_date: this.formatDate(appearanceDate),
        stop_appearing_after: this.formatDate(cutoffDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * Start of specific month (Jan, Feb, etc.)
   */
  private calculateStartOfSpecificMonth(task: MasterTask, frequency: FrequencyType, date: Date): AppearanceResult {
    const monthMap: { [key: string]: number } = {
      [FrequencyType.START_OF_MONTH_JAN]: 0,
      [FrequencyType.START_OF_MONTH_FEB]: 1,
      [FrequencyType.START_OF_MONTH_MAR]: 2,
      [FrequencyType.START_OF_MONTH_APR]: 3,
      [FrequencyType.START_OF_MONTH_MAY]: 4,
      [FrequencyType.START_OF_MONTH_JUN]: 5,
      [FrequencyType.START_OF_MONTH_JUL]: 6,
      [FrequencyType.START_OF_MONTH_AUG]: 7,
      [FrequencyType.START_OF_MONTH_SEP]: 8,
      [FrequencyType.START_OF_MONTH_OCT]: 9,
      [FrequencyType.START_OF_MONTH_NOV]: 10,
      [FrequencyType.START_OF_MONTH_DEC]: 11
    }

    const targetMonth = monthMap[frequency]
    return this.calculateStartOfMonth(task, date, targetMonth)
  }

  /**
   * 6) Once Monthly - Same appearance as Start of Month, due last Saturday, locks on due date
   */
  private calculateOnceMonthly(task: MasterTask, date: Date): AppearanceResult {
    const targetMonth = date.getMonth()
    const targetYear = date.getFullYear()
    const firstOfMonth = new Date(targetYear, targetMonth, 1)
    
    // Find appearance date (same as Start of Month)
    let appearanceDate = new Date(firstOfMonth)
    if (this.isWeekend(appearanceDate)) {
      appearanceDate = this.findFirstMondayAfter(appearanceDate)
    }
    if (this.holidayChecker.isHoliday(appearanceDate)) {
      appearanceDate = this.findNextWeekday(appearanceDate)
    }

    // Due date: last Saturday of month (or nearest earlier non-PH)
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    let dueDate = new Date(lastSaturday)
    if (this.holidayChecker.isHoliday(dueDate)) {
      const earlierDate = this.findNearestEarlierWeekdayInMonth(dueDate)
      if (earlierDate) {
        dueDate = earlierDate
      }
    }

    // Appears from appearance date through due date only (not past due date)
    if (date >= appearanceDate && date <= dueDate) {
      return {
        should_appear: true,
        is_carry_instance: date > appearanceDate,
        due_date: this.formatDate(dueDate),
        original_appearance_date: this.formatDate(appearanceDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * 7) End of Month - Last Monday with ≥5 workdays, due last Saturday, locks on due date
   */
  private calculateEndOfMonth(task: MasterTask, date: Date, specificMonth: number | null): AppearanceResult {
    // Only process if we're in the target month (or any month if specificMonth is null)
    const targetMonth = date.getMonth()
    if (specificMonth !== null && targetMonth !== specificMonth) {
      return { should_appear: false, is_carry_instance: false, due_date: '' }
    }
    
    // Find appearance date: latest Monday with ≥5 remaining workdays
    const appearanceDate = this.findEndOfMonthAppearanceDate(date)
    
    // Due date: last Saturday of month (or nearest earlier non-PH)
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    let dueDate = new Date(lastSaturday)
    if (this.holidayChecker.isHoliday(dueDate)) {
      const earlierDate = this.findNearestEarlierWeekdayInMonth(dueDate)
      if (earlierDate) {
        dueDate = earlierDate
      }
    }

    // Appears from appearance date through due date only
    if (date >= appearanceDate && date <= dueDate) {
      return {
        should_appear: true,
        is_carry_instance: date > appearanceDate,
        due_date: this.formatDate(dueDate),
        original_appearance_date: this.formatDate(appearanceDate)
      }
    }

    return { should_appear: false, is_carry_instance: false, due_date: '' }
  }

  /**
   * End of specific month (Jan, Feb, etc.)
   */
  private calculateEndOfSpecificMonth(task: MasterTask, frequency: FrequencyType, date: Date): AppearanceResult {
    const monthMap: { [key: string]: number } = {
      [FrequencyType.END_OF_MONTH_JAN]: 0,
      [FrequencyType.END_OF_MONTH_FEB]: 1,
      [FrequencyType.END_OF_MONTH_MAR]: 2,
      [FrequencyType.END_OF_MONTH_APR]: 3,
      [FrequencyType.END_OF_MONTH_MAY]: 4,
      [FrequencyType.END_OF_MONTH_JUN]: 5,
      [FrequencyType.END_OF_MONTH_JUL]: 6,
      [FrequencyType.END_OF_MONTH_AUG]: 7,
      [FrequencyType.END_OF_MONTH_SEP]: 8,
      [FrequencyType.END_OF_MONTH_OCT]: 9,
      [FrequencyType.END_OF_MONTH_NOV]: 10,
      [FrequencyType.END_OF_MONTH_DEC]: 11
    }

    const targetMonth = monthMap[frequency]
    return this.calculateEndOfMonth(task, date, targetMonth)
  }

  /**
   * Calculate status update for an instance based on current time
   */
  private calculateStatusUpdate(instance: TaskInstance, currentDateTime: Date): StatusUpdateResult {
    const currentDate = this.formatDate(currentDateTime)
    const currentTime = this.formatTime(currentDateTime)
    const dueDate = instance.due_date
    const dueTime = instance.due_time_override || instance.due_time

    let newStatus = instance.status
    let locked = instance.locked
    let reason = 'No change'
    let updated = false

    // Skip if already done or locked
    if (instance.status === TaskStatus.DONE || instance.locked) {
      return {
        instance_id: instance.id,
        old_status: instance.status,
        new_status: instance.status,
        locked,
        reason: instance.status === TaskStatus.DONE ? 'Already completed' : 'Already locked',
        updated: false
      }
    }

    // Status transitions based on time
    if (currentDate === dueDate && currentTime >= dueTime) {
      // At due time on due date → Overdue (unlocked)
      if (instance.status === TaskStatus.PENDING || instance.status === TaskStatus.IN_PROGRESS) {
        newStatus = TaskStatus.OVERDUE
        reason = 'Past due time'
        updated = true
      }
    }

    // Determine frequency type for locking rules
    const frequency = this.getFrequencyFromInstanceId(instance.id)
    
    // Locking rules based on frequency
    if (this.shouldLockInstance(instance, frequency, currentDateTime)) {
      newStatus = TaskStatus.MISSED
      locked = true
      reason = this.getLockReason(frequency)
      updated = true
    }

    return {
      instance_id: instance.id,
      old_status: instance.status,
      new_status: newStatus,
      locked,
      reason,
      updated
    }
  }

  /**
   * Determine if an instance should be locked based on frequency and current time
   */
  private shouldLockInstance(instance: TaskInstance, frequency: FrequencyType, currentDateTime: Date): boolean {
    const currentDate = this.formatDate(currentDateTime)
    const currentTime = this.formatTime(currentDateTime)
    const dueDate = instance.due_date

    switch (frequency) {
      case FrequencyType.ONCE_OFF:
        // Never auto-lock
        return false
        
      case FrequencyType.EVERY_DAY:
        // Lock at 23:59 same date
        return currentDate === dueDate && currentTime >= '23:59'
        
      case FrequencyType.ONCE_WEEKLY:
      case FrequencyType.ONCE_MONTHLY:
      case FrequencyType.END_OF_EVERY_MONTH:
      case FrequencyType.END_OF_MONTH_JAN:
      case FrequencyType.END_OF_MONTH_FEB:
      case FrequencyType.END_OF_MONTH_MAR:
      case FrequencyType.END_OF_MONTH_APR:
      case FrequencyType.END_OF_MONTH_MAY:
      case FrequencyType.END_OF_MONTH_JUN:
      case FrequencyType.END_OF_MONTH_JUL:
      case FrequencyType.END_OF_MONTH_AUG:
      case FrequencyType.END_OF_MONTH_SEP:
      case FrequencyType.END_OF_MONTH_OCT:
      case FrequencyType.END_OF_MONTH_NOV:
      case FrequencyType.END_OF_MONTH_DEC:
        // Lock at 23:59 on due date
        return currentDate === dueDate && currentTime >= '23:59'
        
      case FrequencyType.MONDAY:
      case FrequencyType.TUESDAY:
      case FrequencyType.WEDNESDAY:
      case FrequencyType.THURSDAY:
      case FrequencyType.FRIDAY:
      case FrequencyType.SATURDAY:
      case FrequencyType.START_OF_EVERY_MONTH:
      case FrequencyType.START_OF_MONTH_JAN:
      case FrequencyType.START_OF_MONTH_FEB:
      case FrequencyType.START_OF_MONTH_MAR:
      case FrequencyType.START_OF_MONTH_APR:
      case FrequencyType.START_OF_MONTH_MAY:
      case FrequencyType.START_OF_MONTH_JUN:
      case FrequencyType.START_OF_MONTH_JUL:
      case FrequencyType.START_OF_MONTH_AUG:
      case FrequencyType.START_OF_MONTH_SEP:
      case FrequencyType.START_OF_MONTH_OCT:
      case FrequencyType.START_OF_MONTH_NOV:
      case FrequencyType.START_OF_MONTH_DEC:
        // Lock at Saturday cutoff (or earlier PH stop)
        return this.isPastSaturdayCutoff(instance, currentDateTime)
        
      default:
        return false
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0].substring(0, 5)
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }

  private getWeekMonday(date: Date): Date {
    const monday = new Date(date)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day // Sunday is 0, Monday is 1
    monday.setDate(date.getDate() + diff)
    return monday
  }

  private getTargetWeekday(frequency: FrequencyType): number {
    switch (frequency) {
      case FrequencyType.MONDAY: return 1
      case FrequencyType.TUESDAY: return 2
      case FrequencyType.WEDNESDAY: return 3
      case FrequencyType.THURSDAY: return 4
      case FrequencyType.FRIDAY: return 5
      case FrequencyType.SATURDAY: return 6
      default: return 1
    }
  }

  private findNextWeekdayInWeek(startDate: Date, weekEnd: Date): Date {
    let current = new Date(startDate)
    current.setDate(current.getDate() + 1)
    
    while (current <= weekEnd) {
      if (!this.holidayChecker.isHoliday(current) && !this.isWeekend(current)) {
        return current
      }
      current.setDate(current.getDate() + 1)
    }
    
    return startDate // Fallback
  }

  private findNearestEarlierWeekdayInWeek(startDate: Date, weekStart: Date): Date | null {
    let current = new Date(startDate)
    current.setDate(current.getDate() - 1)
    
    while (current >= weekStart) {
      if (!this.holidayChecker.isHoliday(current) && !this.isWeekend(current)) {
        return current
      }
      current.setDate(current.getDate() - 1)
    }
    
    return null
  }

  private findFirstMondayAfter(date: Date): Date {
    let current = new Date(date)
    current.setDate(current.getDate() + 1)
    
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() + 1)
    }
    
    return current
  }

  private findNextWeekday(date: Date): Date {
    let current = new Date(date)
    current.setDate(current.getDate() + 1)
    
    while (this.holidayChecker.isHoliday(current) || this.isWeekend(current)) {
      current.setDate(current.getDate() + 1)
    }
    
    return current
  }

  private addWorkdays(startDate: Date, workdays: number): Date {
    let current = new Date(startDate)
    let added = 0
    
    while (added < workdays) {
      current.setDate(current.getDate() + 1)
      if (!this.holidayChecker.isHoliday(current) && !this.isWeekend(current)) {
        added++
      }
    }
    
    // If the computed due date lands on a PH → extend to the day after the PH
    while (this.holidayChecker.isHoliday(current)) {
      current.setDate(current.getDate() + 1)
    }
    
    return current
  }

  private getLastSaturdayOfMonth(date: Date): Date {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    
    // Find the last Saturday
    while (lastDay.getDay() !== 6) {
      lastDay.setDate(lastDay.getDate() - 1)
    }
    
    return lastDay
  }

  private findNearestEarlierWeekdayInMonth(date: Date): Date | null {
    let current = new Date(date)
    current.setDate(current.getDate() - 1)
    
    while (current.getMonth() === date.getMonth()) {
      if (!this.holidayChecker.isHoliday(current) && !this.isWeekend(current)) {
        return current
      }
      current.setDate(current.getDate() - 1)
    }
    
    return null
  }

  private findEndOfMonthAppearanceDate(date: Date): Date {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    
    // Find all Mondays in the month
    const mondays: Date[] = []
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const testDate = new Date(year, month, day)
      if (testDate.getDay() === 1) {
        mondays.push(testDate)
      }
    }
    
    // Find the latest Monday with at least 5 workdays remaining
    for (let i = mondays.length - 1; i >= 0; i--) {
      const monday = mondays[i]
      const workdaysRemaining = this.countWorkdaysAfter(monday, lastDay)
      
      if (workdaysRemaining >= 5) {
        // If this Monday is PH, shift to next non-PH weekday
        if (this.holidayChecker.isHoliday(monday)) {
          return this.findNextWeekday(monday)
        }
        return monday
      }
    }
    
    // Fallback to first Monday if no suitable Monday found
    return mondays[0] || new Date(year, month, 1)
  }

  private countWorkdaysAfter(startDate: Date, endDate: Date): number {
    let count = 0
    let current = new Date(startDate)
    current.setDate(current.getDate() + 1)
    
    while (current <= endDate) {
      if (!this.holidayChecker.isHoliday(current) && !this.isWeekend(current)) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  private getFrequencyFromInstanceId(instanceId: string): FrequencyType {
    // Extract frequency from instance ID format: {task.id}-{frequency}-{date}
    const parts = instanceId.split('-')
    if (parts.length >= 2) {
      return parts[1] as FrequencyType
    }
    return FrequencyType.EVERY_DAY // Default fallback
  }

  private isPastSaturdayCutoff(instance: TaskInstance, currentDateTime: Date): boolean {
    // Calculate the Saturday cutoff for this instance
    const instanceDate = new Date(instance.date + 'T00:00:00')
    const weekMonday = this.getWeekMonday(instanceDate)
    const weekSaturday = new Date(weekMonday)
    weekSaturday.setDate(weekMonday.getDate() + 5)
    
    // Find actual cutoff (Saturday or earlier if PH)
    let cutoffDate = new Date(weekSaturday)
    if (this.holidayChecker.isHoliday(cutoffDate)) {
      const earlierDate = this.findNearestEarlierWeekdayInWeek(cutoffDate, weekMonday)
      if (earlierDate) {
        cutoffDate = earlierDate
      }
    }
    
    // Set cutoff time to 23:59
    cutoffDate.setHours(23, 59, 59, 999)
    
    return currentDateTime >= cutoffDate
  }

  private getLockReason(frequency: FrequencyType): string {
    switch (frequency) {
      case FrequencyType.EVERY_DAY:
        return 'Missed at 23:59 same date'
      case FrequencyType.ONCE_WEEKLY:
      case FrequencyType.ONCE_MONTHLY:
      case FrequencyType.END_OF_EVERY_MONTH:
      case FrequencyType.END_OF_MONTH_JAN:
      case FrequencyType.END_OF_MONTH_FEB:
      case FrequencyType.END_OF_MONTH_MAR:
      case FrequencyType.END_OF_MONTH_APR:
      case FrequencyType.END_OF_MONTH_MAY:
      case FrequencyType.END_OF_MONTH_JUN:
      case FrequencyType.END_OF_MONTH_JUL:
      case FrequencyType.END_OF_MONTH_AUG:
      case FrequencyType.END_OF_MONTH_SEP:
      case FrequencyType.END_OF_MONTH_OCT:
      case FrequencyType.END_OF_MONTH_NOV:
      case FrequencyType.END_OF_MONTH_DEC:
        return 'Missed at due date cutoff'
      default:
        return 'Missed at Saturday cutoff'
    }
  }
}

