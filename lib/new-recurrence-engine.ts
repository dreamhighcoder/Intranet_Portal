/**
 * New Task Recurrence & Status Engine
 * Pharmacy Intranet Portal - Precise Implementation
 * 
 * This module implements the exact recurrence rules as specified:
 * 1. Once Off - appears daily until done, never auto-locks
 * 2. Every Day - new daily instance excluding Sundays & PHs, locks at 23:59 same date
 * 3. Once Weekly - Monday-anchored, carries through Saturday, locks on due date
 * 4. Every Mon/Tue/Wed/Thu/Fri/Sat - specific weekday, carries through Saturday
 * 5. Start of Month - 1st of month (with shifts), +5 workdays due, carries to last Saturday
 * 6. Once Monthly - same appearance as Start of Month, due last Saturday, locks on due date
 * 7. End of Month - last Monday with ≥5 workdays, due last Saturday, locks on due date
 */

import { HolidayChecker } from './holiday-checker'
import { getWorkingDaysAsNumbers, isWorkingDay, getSystemSetting } from './system-settings'
import { 
  getAustralianNow, 
  getAustralianToday, 
  parseAustralianDate, 
  formatAustralianDate,
  getAustralianDayOfWeek,
  createAustralianDateTime,
  isAustralianTimePast,
  toAustralianTime,
  australianNowUtcISOString
} from './timezone-utils'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Complete frequency types matching the specification exactly
 */
export enum NewFrequencyType {
  // Basic frequencies (Rules 1-3)
  ONCE_OFF = 'once_off',
  ONCE_OFF_STICKY = 'once_off_sticky',
  EVERY_DAY = 'every_day',
  ONCE_WEEKLY = 'once_weekly',
  
  // Specific weekdays (Rules 4-9) - ALL 6 WEEKDAYS (Sunday excluded as per spec)
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  
  // Monthly frequencies (Rules 10, 23-24)
  START_OF_EVERY_MONTH = 'start_of_every_month', // Rule 10
  ONCE_MONTHLY = 'once_monthly', // Rule 23
  END_OF_EVERY_MONTH = 'end_of_every_month', // Rule 24
  
  // Start of specific months (Rules 11-22)
  START_OF_MONTH_JAN = 'start_of_month_jan', // Rule 11
  START_OF_MONTH_FEB = 'start_of_month_feb', // Rule 12
  START_OF_MONTH_MAR = 'start_of_month_mar', // Rule 13
  START_OF_MONTH_APR = 'start_of_month_apr', // Rule 14
  START_OF_MONTH_MAY = 'start_of_month_may', // Rule 15
  START_OF_MONTH_JUN = 'start_of_month_jun', // Rule 16
  START_OF_MONTH_JUL = 'start_of_month_jul', // Rule 17
  START_OF_MONTH_AUG = 'start_of_month_aug', // Rule 18
  START_OF_MONTH_SEP = 'start_of_month_sep', // Rule 19
  START_OF_MONTH_OCT = 'start_of_month_oct', // Rule 20
  START_OF_MONTH_NOV = 'start_of_month_nov', // Rule 21
  START_OF_MONTH_DEC = 'start_of_month_dec', // Rule 22
  
  // End of specific months (Rules 25-36)
  END_OF_MONTH_JAN = 'end_of_month_jan', // Rule 25
  END_OF_MONTH_FEB = 'end_of_month_feb', // Rule 26
  END_OF_MONTH_MAR = 'end_of_month_mar', // Rule 27
  END_OF_MONTH_APR = 'end_of_month_apr', // Rule 28
  END_OF_MONTH_MAY = 'end_of_month_may', // Rule 29
  END_OF_MONTH_JUN = 'end_of_month_jun', // Rule 30
  END_OF_MONTH_JUL = 'end_of_month_jul', // Rule 31
  END_OF_MONTH_AUG = 'end_of_month_aug', // Rule 32
  END_OF_MONTH_SEP = 'end_of_month_sep', // Rule 33
  END_OF_MONTH_OCT = 'end_of_month_oct', // Rule 34
  END_OF_MONTH_NOV = 'end_of_month_nov', // Rule 35
  END_OF_MONTH_DEC = 'end_of_month_dec' // Rule 36
}

/**
 * Task status enum matching specification exactly
 */
export enum TaskStatus {
  PENDING = 'pending',        // Initial state when created
  IN_PROGRESS = 'in_progress', // When user starts working on task
  OVERDUE = 'overdue',        // Past due time but not yet locked
  MISSED = 'missed',          // Past lock time, instance is locked
  DONE = 'done'              // Completed by user
}

/**
 * Master task interface for the new engine
 */
export interface MasterTask {
  id: string
  title: string
  description?: string
  active: boolean
  frequencies: NewFrequencyType[] // Array of frequencies
  timing: string // Default due time (HH:MM format)
  publish_delay?: string; // e.g., '1d', '2w', '3m'
  due_date?: string // For OnceOff tasks - admin-entered due date
  responsibility?: string[] // Position responsibilities
  categories?: string[] // Task categories
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
  
  // Carry instance tracking
  is_carry_instance?: boolean
  original_appearance_date?: string
}

/**
 * Generation result for a single date
 */
export interface GenerationResult {
  date: string
  instances: TaskInstance[]
  carry_instances: TaskInstance[] // Instances that continue from previous days
}

/**
 * Status update result
 */
export interface StatusUpdateResult {
  instance_id: string
  old_status: TaskStatus
  new_status: TaskStatus
  locked: boolean
  updated: boolean
  reason: string
}

// ========================================
// NEW RECURRENCE ENGINE CLASS
// ========================================

export class NewRecurrenceEngine {
  private holidayChecker: HolidayChecker
  private businessTimezone: string

  constructor(holidayChecker: HolidayChecker, businessTimezone: string = 'Australia/Sydney') {
    this.holidayChecker = holidayChecker
    this.businessTimezone = businessTimezone
  }

  /**
   * Generate task instances for a specific date
   */
  generateInstancesForDate(masterTasks: MasterTask[], date: string): GenerationResult {
    const targetDate = parseAustralianDate(date)
    const instances: TaskInstance[] = []
    const carry_instances: TaskInstance[] = []

    for (const task of masterTasks) {
      if (!this.isTaskActiveOnDate(task, targetDate)) {
        continue
      }

      for (const frequency of task.frequencies) {
        const result = this.processTaskForDate(task, frequency, targetDate)
        if (result.shouldAppear) {
          const instance: TaskInstance = {
            id: this.generateInstanceId(task.id, frequency, date),
            master_task_id: task.id,
            date: date,
            due_date: result.dueDate,
            due_time: task.timing,
            status: TaskStatus.PENDING,
            locked: false,
            created_at: australianNowUtcISOString(),
            updated_at: australianNowUtcISOString(),
            is_carry_instance: result.isCarryOver,
            original_appearance_date: result.isCarryOver ? result.originalAppearanceDate : date
          }
          
          if (result.isCarryOver) {
            carry_instances.push(instance)
          } else {
            instances.push(instance)
          }
        }
      }
    }

    return {
      date,
      instances,
      carry_instances
    }
  }

  /**
   * Check if a task should appear on a specific date (for calendar/checklist views)
   */
  shouldTaskAppearOnDate(task: MasterTask, date: string): boolean {
    const targetDate = parseAustralianDate(date)

    // Global rule: never assign/show tasks on Sundays or public holidays
    if (this.isSundayOrHoliday(targetDate)) {
      return false
    }

    if (!this.isTaskActiveOnDate(task, targetDate)) {
      return false
    }

    for (const frequency of task.frequencies) {
      const result = this.processTaskForDate(task, frequency, targetDate)
      if (result.shouldAppear) {
        return true
      }
    }
    
    return false
  }

  /**
   * Calculate the current status of a task for a specific date and time
   */
  calculateTaskStatus(task: MasterTask, date: string, currentDateTime: Date, isCompleted: boolean = false): {
    status: 'not_due_yet' | 'due_today' | 'overdue' | 'missed' | 'completed'
    dueDate: string | null
    dueTime: string | null
    lockDate: string | null
    lockTime: string | null
    canComplete: boolean
  } {
    if (isCompleted) {
      return {
        status: 'completed',
        dueDate: null,
        dueTime: null,
        lockDate: null,
        lockTime: null,
        canComplete: false
      }
    }

    const targetDate = parseAustralianDate(date)
    const currentAustralianTime = toAustralianTime(currentDateTime)
    const currentAustralianDate = parseAustralianDate(formatAustralianDate(currentAustralianTime))

    // Find the best status across all frequencies
    let bestStatus: 'not_due_yet' | 'due_today' | 'overdue' | 'missed' = 'not_due_yet'
    let bestDueDate: string | null = null
    let bestDueTime: string | null = null
    let bestLockDate: string | null = null
    let bestLockTime: string | null = null
    let canComplete = true

    const statusPriority = { 'not_due_yet': 1, 'due_today': 2, 'overdue': 3, 'missed': 4 }

    for (const frequency of task.frequencies) {
      const result = this.processTaskForDate(task, frequency, targetDate)
      if (!result.shouldAppear) continue

      const dueDate = parseAustralianDate(result.dueDate)
      const dueTime = (task as any).due_time || '09:30'
      const dueMoment = createAustralianDateTime(result.dueDate, dueTime)

      // Determine lock time based on frequency
      let lockMoment: Date | null = null
      let lockDate: string | null = null
      let lockTime: string | null = null

      const hasOnceOffFrequency = frequency === NewFrequencyType.ONCE_OFF || frequency === NewFrequencyType.ONCE_OFF_STICKY
      
      if (hasOnceOffFrequency) {
        // Once-off tasks never auto-lock
        lockMoment = null
      } else {
        const hasWeekdayFrequency = [
          NewFrequencyType.MONDAY, NewFrequencyType.TUESDAY, NewFrequencyType.WEDNESDAY,
          NewFrequencyType.THURSDAY, NewFrequencyType.FRIDAY, NewFrequencyType.SATURDAY
        ].includes(frequency)
        
        if (hasWeekdayFrequency) {
          // Weekday tasks lock at 23:59 on Saturday of the same week
          const weekSaturday = this.getWeekSaturday(targetDate)
          const saturdayBusinessDay = this.findPreviousBusinessDay(weekSaturday)
          lockDate = formatAustralianDate(saturdayBusinessDay)
          lockTime = '23:59'
          lockMoment = createAustralianDateTime(lockDate, lockTime)
        } else {
          // Determine if this frequency is a monthly-start type (Start of Month family)
          const isMonthlyStart = (
            frequency === NewFrequencyType.START_OF_EVERY_MONTH ||
            [
              NewFrequencyType.START_OF_MONTH_JAN, NewFrequencyType.START_OF_MONTH_FEB, NewFrequencyType.START_OF_MONTH_MAR,
              NewFrequencyType.START_OF_MONTH_APR, NewFrequencyType.START_OF_MONTH_MAY, NewFrequencyType.START_OF_MONTH_JUN,
              NewFrequencyType.START_OF_MONTH_JUL, NewFrequencyType.START_OF_MONTH_AUG, NewFrequencyType.START_OF_MONTH_SEP,
              NewFrequencyType.START_OF_MONTH_OCT, NewFrequencyType.START_OF_MONTH_NOV, NewFrequencyType.START_OF_MONTH_DEC,
            ].includes(frequency)
          )

          if (isMonthlyStart) {
            // Start-of-month tasks lock at 23:59 on the last Saturday of the month (PH-adjusted)
            const lastSaturday = this.getLastSaturdayOfMonth(dueDate)
            const carryEnd = this.findPreviousBusinessDay(lastSaturday)
            lockDate = formatAustralianDate(carryEnd)
            lockTime = '23:59'
            lockMoment = createAustralianDateTime(lockDate, lockTime)
          } else {
            // Other tasks lock at 23:59 on their due date
            lockDate = result.dueDate
            lockTime = '23:59'
            lockMoment = createAustralianDateTime(lockDate, lockTime)
          }
        }
      }

      // Calculate status for this frequency
      let frequencyStatus: 'not_due_yet' | 'due_today' | 'overdue' | 'missed' = 'not_due_yet'

      if (currentAustralianDate < dueDate) {
        frequencyStatus = 'not_due_yet'
      } else if (currentAustralianDate.getTime() === dueDate.getTime()) {
        // On due date - check time
        if (lockMoment && currentAustralianTime >= lockMoment) {
          frequencyStatus = 'missed'
        } else if (currentAustralianTime >= dueMoment) {
          frequencyStatus = 'overdue'
        } else {
          frequencyStatus = 'due_today'
        }
      } else {
        // After due date
        if (lockMoment && currentAustralianTime >= lockMoment) {
          frequencyStatus = 'missed'
        } else {
          frequencyStatus = 'overdue'
        }
      }

      // Update best status if this one has higher priority
      if (statusPriority[frequencyStatus] > statusPriority[bestStatus]) {
        bestStatus = frequencyStatus
        bestDueDate = result.dueDate
        bestDueTime = dueTime
        bestLockDate = lockDate
        bestLockTime = lockTime
        canComplete = frequencyStatus !== 'missed'
      }
    }

    return {
      status: bestStatus,
      dueDate: bestDueDate,
      dueTime: bestDueTime,
      lockDate: bestLockDate,
      lockTime: bestLockTime,
      canComplete
    }
  }

  /**
   * Check if a task is active and within its valid date range
   */
  private isTaskActiveOnDate(task: MasterTask, date: Date): boolean {
    // Check if task is active (handle both interface formats)
    const isActive = (task as any).publish_status === 'active' || task.active === true
    if (!isActive) return false
    
    // Check start_date if present
    const startDate = (task as any).start_date
    if (startDate) {
      const taskStartDate = parseAustralianDate(startDate)
      if (date < taskStartDate) return false
    }
    
    // Check end_date if present
    const endDate = (task as any).end_date
    if (endDate) {
      const taskEndDate = parseAustralianDate(endDate)
      if (date > taskEndDate) return false
    }
    
    return true
  }

  /**
   * Generate a unique ID for a task instance
   */
  private generateInstanceId(taskId: string, frequency: NewFrequencyType, date: string): string {
    const hash = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash |= 0 // Convert to 32bit integer
      }
      return Math.abs(hash).toString(36).substring(0, 5)
    }
    return `${taskId}-${frequency}-${date}-${hash(taskId + frequency + date)}`
  }

  /**
   * Update statuses for existing instances based on current time
   */
  updateInstanceStatuses(instances: TaskInstance[], currentDateTime: Date, masterTasks?: MasterTask[]): StatusUpdateResult[] {
    const results: StatusUpdateResult[] = []

    for (const instance of instances) {
      const result = this.calculateStatusUpdate(instance, currentDateTime, masterTasks)
      if (result.updated) {
        results.push(result)
      }
    }

    return results
  }

  /**
   * Calculate status update for a single task instance
   */
  private calculateStatusUpdate(instance: TaskInstance, currentDateTime: Date, masterTasks?: MasterTask[]): StatusUpdateResult {
    const oldStatus = instance.status
    let newStatus = oldStatus
    let locked = instance.locked
    let updated = false
    let reason = 'No change needed'

    try {
      // Skip if already completed
      if (oldStatus === TaskStatus.DONE) {
        return {
          instance_id: instance.id,
          old_status: oldStatus,
          new_status: oldStatus,
          locked,
          updated: false,
          reason: 'Task already completed'
        }
      }

      // Get master task to determine frequency and lock rules
      const masterTask = masterTasks?.find(t => t.id === instance.master_task_id)
      if (!masterTask) {
        return {
          instance_id: instance.id,
          old_status: oldStatus,
          new_status: oldStatus,
          locked,
          updated: false,
          reason: 'Master task not found'
        }
      }

      // Parse dates and times
      const instanceDate = parseAustralianDate(instance.date)
      const dueDate = parseAustralianDate(instance.due_date)
      const currentAustralianTime = toAustralianTime(currentDateTime)
      const currentAustralianDate = parseAustralianDate(formatAustralianDate(currentAustralianTime))

      // Create due time and lock time
      const dueTime = instance.due_time_override || instance.due_time || masterTask.timing || '09:30'
      const dueMoment = createAustralianDateTime(instance.due_date, dueTime)
      
      // Determine lock time based on frequency
      let lockMoment: Date | null = null
      const hasOnceOffFrequency = masterTask.frequencies.some(f => 
        f === NewFrequencyType.ONCE_OFF || f === NewFrequencyType.ONCE_OFF_STICKY
      )

      if (hasOnceOffFrequency) {
        // Once-off tasks never auto-lock
        lockMoment = null
      } else {
        // Other tasks lock at different times based on frequency
        const hasWeekdayFrequency = masterTask.frequencies.some(f => 
          [NewFrequencyType.MONDAY, NewFrequencyType.TUESDAY, NewFrequencyType.WEDNESDAY, 
           NewFrequencyType.THURSDAY, NewFrequencyType.FRIDAY, NewFrequencyType.SATURDAY].includes(f)
        )

        // Monthly start frequencies (Start of Month family) should lock at last Saturday (PH-adjusted)
        const hasMonthlyStartFrequency = masterTask.frequencies.some(f =>
          f === NewFrequencyType.START_OF_EVERY_MONTH ||
          [
            NewFrequencyType.START_OF_MONTH_JAN, NewFrequencyType.START_OF_MONTH_FEB, NewFrequencyType.START_OF_MONTH_MAR,
            NewFrequencyType.START_OF_MONTH_APR, NewFrequencyType.START_OF_MONTH_MAY, NewFrequencyType.START_OF_MONTH_JUN,
            NewFrequencyType.START_OF_MONTH_JUL, NewFrequencyType.START_OF_MONTH_AUG, NewFrequencyType.START_OF_MONTH_SEP,
            NewFrequencyType.START_OF_MONTH_OCT, NewFrequencyType.START_OF_MONTH_NOV, NewFrequencyType.START_OF_MONTH_DEC,
          ].includes(f)
        )
        
        if (hasWeekdayFrequency) {
          // Weekday tasks lock at 23:59 on Saturday of the same week
          const weekSaturday = this.getWeekSaturday(instanceDate)
          lockMoment = createAustralianDateTime(formatAustralianDate(weekSaturday), '23:59')
        } else if (hasMonthlyStartFrequency) {
          // Start-of-month tasks lock at 23:59 on the last Saturday of the month (PH-adjusted)
          const lastSaturday = this.getLastSaturdayOfMonth(dueDate)
          const carryEnd = this.findPreviousBusinessDay(lastSaturday)
          lockMoment = createAustralianDateTime(formatAustralianDate(carryEnd), '23:59')
        } else {
          // Other tasks lock at 23:59 on their due date
          lockMoment = createAustralianDateTime(instance.due_date, '23:59')
        }
      }

      // Calculate new status based on current time
      if (currentAustralianDate < dueDate) {
        // Before due date
        newStatus = TaskStatus.PENDING
        reason = 'Not due yet'
      } else if (currentAustralianDate.getTime() === dueDate.getTime()) {
        // On due date - check time
        if (lockMoment && currentAustralianTime >= lockMoment) {
          newStatus = TaskStatus.MISSED
          locked = true
          reason = 'Missed - past lock time'
        } else if (currentAustralianTime >= dueMoment) {
          newStatus = TaskStatus.OVERDUE
          reason = 'Overdue - past due time'
        } else {
          newStatus = TaskStatus.PENDING
          reason = 'Due today'
        }
      } else {
        // After due date
        if (lockMoment && currentAustralianTime >= lockMoment) {
          newStatus = TaskStatus.MISSED
          locked = true
          reason = 'Missed - past lock time'
        } else {
          newStatus = TaskStatus.OVERDUE
          reason = 'Overdue - past due date'
        }
      }

      // Recompute locked based on lock moment and current time
      locked = !!(lockMoment && currentAustralianTime >= lockMoment)

      // Check if update is needed
      updated = (newStatus !== oldStatus) || (locked !== instance.locked)

      return {
        instance_id: instance.id,
        old_status: oldStatus,
        new_status: newStatus,
        locked,
        updated,
        reason
      }

    } catch (error) {
      return {
        instance_id: instance.id,
        old_status: oldStatus,
        new_status: oldStatus,
        locked,
        updated: false,
        reason: `Error calculating status: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Process a single task for a specific date and frequency
   */
  private processTaskForDate(task: MasterTask, frequency: NewFrequencyType, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    switch (frequency) {
      case NewFrequencyType.ONCE_OFF:
      case NewFrequencyType.ONCE_OFF_STICKY:
        return this.processOnceOff(task, date)
      
      case NewFrequencyType.EVERY_DAY:
        return this.processEveryDay(task, date)
      
      case NewFrequencyType.ONCE_WEEKLY:
        return this.processOnceWeekly(task, date)
      
      case NewFrequencyType.MONDAY:
      case NewFrequencyType.TUESDAY:
      case NewFrequencyType.WEDNESDAY:
      case NewFrequencyType.THURSDAY:
      case NewFrequencyType.FRIDAY:
      case NewFrequencyType.SATURDAY:
        return this.processSpecificWeekday(task, frequency, date)
      
      case NewFrequencyType.START_OF_EVERY_MONTH:
        return this.processStartOfMonth(task, date)
      
      case NewFrequencyType.START_OF_MONTH_JAN:
      case NewFrequencyType.START_OF_MONTH_FEB:
      case NewFrequencyType.START_OF_MONTH_MAR:
      case NewFrequencyType.START_OF_MONTH_APR:
      case NewFrequencyType.START_OF_MONTH_MAY:
      case NewFrequencyType.START_OF_MONTH_JUN:
      case NewFrequencyType.START_OF_MONTH_JUL:
      case NewFrequencyType.START_OF_MONTH_AUG:
      case NewFrequencyType.START_OF_MONTH_SEP:
      case NewFrequencyType.START_OF_MONTH_OCT:
      case NewFrequencyType.START_OF_MONTH_NOV:
      case NewFrequencyType.START_OF_MONTH_DEC:
        return this.processStartOfSpecificMonth(task, frequency, date)
      
      case NewFrequencyType.ONCE_MONTHLY:
        return this.processOnceMonthly(task, date)
      
      case NewFrequencyType.END_OF_EVERY_MONTH:
        return this.processEndOfMonth(task, date)
      
      case NewFrequencyType.END_OF_MONTH_JAN:
      case NewFrequencyType.END_OF_MONTH_FEB:
      case NewFrequencyType.END_OF_MONTH_MAR:
      case NewFrequencyType.END_OF_MONTH_APR:
      case NewFrequencyType.END_OF_MONTH_MAY:
      case NewFrequencyType.END_OF_MONTH_JUN:
      case NewFrequencyType.END_OF_MONTH_JUL:
      case NewFrequencyType.END_OF_MONTH_AUG:
      case NewFrequencyType.END_OF_MONTH_SEP:
      case NewFrequencyType.END_OF_MONTH_OCT:
      case NewFrequencyType.END_OF_MONTH_NOV:
      case NewFrequencyType.END_OF_MONTH_DEC:
        return this.processEndOfSpecificMonth(task, frequency, date)
      
      default:
        return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }
  }

  /**
   * 1) Once Off - Appear on first eligible day, carry daily until done, never auto-lock
   */
  private processOnceOff(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    // Once-off behavior:
    // - Appears on the day it becomes active (first eligible day)
    // - Same instance appears every day until Done
    // - Never auto-locks, keeps appearing indefinitely until completed
    if (!task.due_date) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = parseAustralianDate(task.due_date)
    
    // Determine the first appearance date (activation date)
    // This is the maximum of: created_at (AU date), publish_delay, start_date
    let firstAppearanceDate: Date | null = null
    try {
      const candidates: Date[] = []
      
      // Add created_at date (convert to AU date)
      if ((task as any).created_at) {
        const createdAtAU = toAustralianTime(new Date((task as any).created_at))
        candidates.push(parseAustralianDate(formatAustralianDate(createdAtAU)))
      }
      
      // Add publish_delay if present
      if (task.publish_delay) {
        candidates.push(parseAustralianDate(task.publish_delay))
      }
      
      // Add start_date if present
      if ((task as any).start_date) {
        candidates.push(parseAustralianDate((task as any).start_date))
      }
      
      if (candidates.length > 0) {
        firstAppearanceDate = new Date(Math.max(...candidates.map(d => d.getTime())))
      }
    } catch (error) {
      // If we can't determine activation date, use today as fallback
      firstAppearanceDate = date
    }
    
    // If no activation date determined, use current date
    if (!firstAppearanceDate) {
      firstAppearanceDate = date
    }
    
    // Once-off tasks appear from activation date onwards indefinitely until completed
    if (date >= firstAppearanceDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > firstAppearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(firstAppearanceDate)
      }
    }
    
    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 2) Every Day - New daily instance excluding Sundays & PHs, locks at 23:59 same date
   */
  private processEveryDay(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    if (this.isSundayOrHoliday(date)) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    return {
      shouldAppear: true,
      isCarryOver: false,
      dueDate: formatAustralianDate(date)
    }
  }

  /**
   * 3) Once Weekly - Monday anchored, carries through Saturday
   * - Appear each Monday; if Monday is PH → Tuesday; if Tuesday also PH → next non-PH weekday forward within same week.
   * - Due date: Saturday of that week; if PH, nearest earlier non-PH weekday (same week).
   */
  private processOnceWeekly(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const weekMonday = this.getWeekMonday(date)
    const weekSaturday = this.getWeekSaturday(date)

    // Find next non-PH weekday (Mon–Fri) within the same week starting from Monday
    const nextWorkdayInWeek = (start: Date): Date | null => {
      const d = new Date(start)
      while (d <= weekSaturday) {
        const day = d.getDay()
        const isWeekday = day >= 1 && day <= 5 // Mon–Fri
        if (isWeekday && !this.isHoliday(d)) return d
        d.setDate(d.getDate() + 1)
      }
      return null
    }

    const appearanceDate = nextWorkdayInWeek(weekMonday)
    if (!appearanceDate) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = this.findPreviousBusinessDay(weekSaturday)

    if (date >= appearanceDate && date <= dueDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 4) Every Mon/Tue/Wed/Thu/Fri/Sat (per selected weekday)
   * - Appear on the specified weekday.
   * - If target weekday is PH:
   *   - Tue–Sat: appear on nearest earlier non-PH weekday in the same week; if none earlier, appear on the next latest non-PH weekday forward (same week).
   *   - Mon: appear on the next latest non-PH weekday forward (same week).
   * - Carry: Same instance keeps reappearing daily up to and including Saturday of that week.
   * - Due date: The scheduled day’s date (after any PH shift) or last business day before Saturday if carrying.
   */
  private processSpecificWeekday(task: MasterTask, frequency: NewFrequencyType, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const weekdayIndexMap: { [key: string]: number } = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    }
    const targetWeekday = weekdayIndexMap[frequency]
    if (targetWeekday === undefined) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    // Compute week boundaries and the scheduled day for this week
    const weekMonday = this.getWeekMonday(date)
    const weekSaturday = this.getWeekSaturday(date)
    const scheduled = new Date(weekMonday)
    scheduled.setDate(weekMonday.getDate() + (targetWeekday - 1))

    // Helper: find previous business day within the same week
    const prevBusinessInWeek = (start: Date): Date | null => {
      const d = new Date(start)
      while (d >= weekMonday) {
        if (!this.isSundayOrHoliday(d)) return d
        d.setDate(d.getDate() - 1)
      }
      return null
    }

    // Helper: find next business day within the same week
    const nextBusinessInWeek = (start: Date): Date | null => {
      const d = new Date(start)
      while (d <= weekSaturday) {
        if (!this.isSundayOrHoliday(d)) return d
        d.setDate(d.getDate() + 1)
      }
      return null
    }

    // Determine appearance date based on PH shifting rules
    let appearanceDate: Date | null = null
    if (!this.isHoliday(scheduled)) {
      appearanceDate = scheduled
    } else {
      if (targetWeekday === 1) {
        // Monday: always move forward within the same week
        appearanceDate = nextBusinessInWeek(new Date(scheduled))
      } else {
        // Tue–Sat: prefer nearest earlier within the same week; if none, move forward
        appearanceDate = prevBusinessInWeek(new Date(scheduled))
        if (!appearanceDate) {
          appearanceDate = nextBusinessInWeek(new Date(scheduled))
        }
      }
    }

    if (!appearanceDate) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    // Due date: the scheduled day (after shift) - this is when the task is due
    const dueDate = appearanceDate

    // Carry end: last business day of the week (Saturday or earlier if Saturday is holiday)
    const carryEndDate = this.findPreviousBusinessDay(weekSaturday)

    // Weekday tasks appear on their designated day and carry through until Saturday of that week
    if (date >= appearanceDate && date <= carryEndDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 5) Start of Every Month
   * - Appear: 1st; if Sat/Sun → first Monday after; if that day is a PH → next non-PH weekday.
   * - Carry: Reappears daily until the last Saturday of the month (or earlier if PH).
   * - Due: 5 full workdays from appearance, excluding weekends & PHs; if lands on PH → extend to next weekday.
   */
  private processStartOfMonth(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    // First Monday after if weekend; then push forward if PH to next weekday
    const mondayAfterWeekend = firstDayOfMonth.getDay() === 6
      ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 3)
      : firstDayOfMonth.getDay() === 0
        ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 2)
        : firstDayOfMonth
    const appearanceDate = this.findNextWeekday(mondayAfterWeekend)

    if (appearanceDate.getMonth() !== date.getMonth()) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = this.addWorkdaysExcludingWeekends(appearanceDate, 5)
    
    // Carry until last Saturday of the month (or earlier if PH)
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    const carryUntil = this.findPreviousBusinessDay(lastSaturday)

    // Appear from appearance date until the end of month cutoff (continues even after due date)
    if (date >= appearanceDate && date <= carryUntil) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 6) Start of Specific Month - follows Start of Every Month rules for a specific month
   */
  private processStartOfSpecificMonth(task: MasterTask, frequency: NewFrequencyType, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const month = this.getMonthFromFrequency(frequency)
    if (month === -1 || date.getMonth() !== month) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const mondayAfterWeekend = firstDayOfMonth.getDay() === 6
      ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 3)
      : firstDayOfMonth.getDay() === 0
        ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 2)
        : firstDayOfMonth
    const appearanceDate = this.findNextWeekday(mondayAfterWeekend)

    if (appearanceDate.getMonth() !== month) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = this.addWorkdaysExcludingWeekends(appearanceDate, 5)
    
    // Carry until last Saturday of the month (or earlier if PH)
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    const carryUntil = this.findPreviousBusinessDay(lastSaturday)

    // Appear from appearance date until the end of month cutoff (continues even after due date)
    if (date >= appearanceDate && date <= carryUntil) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 7) Once Monthly
   * - Appear: Same as Start of Every Month (weekend→Monday; PH→next weekday).
   * - Due: Last Saturday of the month; if PH, nearest earlier non-PH weekday.
   */
  private processOnceMonthly(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const mondayAfterWeekend = firstDayOfMonth.getDay() === 6
      ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 3)
      : firstDayOfMonth.getDay() === 0
        ? new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), 2)
        : firstDayOfMonth
    const appearanceDate = this.findNextWeekday(mondayAfterWeekend)

    if (appearanceDate.getMonth() !== date.getMonth()) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const dueDate = this.findPreviousBusinessDay(this.getWeekSaturday(lastDayOfMonth))

    if (date >= appearanceDate && date <= dueDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 8) End of Every Month
   * - Appear: Last Monday of the month. If <5 workdays remain → shift to previous Monday. If that Monday is a PH → shift to next non-PH weekday (still within week/month).
   * - Due: Last Saturday of the month. If PH → nearest earlier non-PH weekday.
   */
  private processEndOfMonth(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    let lastMonday = this.getLastMondayOfMonth(date)

    // Ensure at least 5 workdays (Mon–Fri excluding PH) remain after appearance
    const hasFiveWorkdays = (start: Date, end: Date): boolean => {
      let d = new Date(start)
      let count = 0
      while (d <= end) {
        const day = d.getDay()
        const isWeekday = day >= 1 && day <= 5
        if (isWeekday && !this.isHoliday(d)) count++
        d.setDate(d.getDate() + 1)
      }
      return count >= 5
    }

    if (!hasFiveWorkdays(lastMonday, lastDayOfMonth)) {
      lastMonday.setDate(lastMonday.getDate() - 7)
    }

    // If that Monday is a PH → next non-PH weekday (prefer within same week/month)
    let appearanceDate = new Date(lastMonday)
    while (appearanceDate.getMonth() === date.getMonth() && this.isHoliday(appearanceDate)) {
      appearanceDate.setDate(appearanceDate.getDate() + 1)
      // stop if goes beyond month
      if (appearanceDate > lastDayOfMonth) break
    }

    if (appearanceDate.getMonth() !== date.getMonth()) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = this.findPreviousBusinessDay(this.getWeekSaturday(lastDayOfMonth))

    if (date >= appearanceDate && date <= dueDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 9) End of Specific Month - follows End of Every Month rules for a specific month
   */
  private processEndOfSpecificMonth(task: MasterTask, frequency: NewFrequencyType, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
    originalAppearanceDate?: string
  } {
    const month = this.getMonthFromFrequency(frequency)
    if (month === -1 || date.getMonth() !== month) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    let lastMonday = this.getLastMondayOfMonth(date)

    // Ensure at least 5 workdays (Mon–Fri excluding PH) remain after appearance
    const hasFiveWorkdays = (start: Date, end: Date): boolean => {
      let d = new Date(start)
      let count = 0
      while (d <= end) {
        const day = d.getDay()
        const isWeekday = day >= 1 && day <= 5
        if (isWeekday && !this.isHoliday(d)) count++
        d.setDate(d.getDate() + 1)
      }
      return count >= 5
    }

    if (!hasFiveWorkdays(lastMonday, lastDayOfMonth)) {
      lastMonday.setDate(lastMonday.getDate() - 7)
    }

    // If that Monday is a PH → next non-PH weekday within month
    let appearanceDate = new Date(lastMonday)
    while (appearanceDate.getMonth() === month && this.isHoliday(appearanceDate)) {
      appearanceDate.setDate(appearanceDate.getDate() + 1)
      if (appearanceDate > lastDayOfMonth) break
    }

    if (appearanceDate.getMonth() !== month) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = this.findPreviousBusinessDay(this.getWeekSaturday(lastDayOfMonth))

    if (date >= appearanceDate && date <= dueDate) {
      return {
        shouldAppear: true,
        isCarryOver: date.getTime() > appearanceDate.getTime(),
        dueDate: formatAustralianDate(dueDate),
        originalAppearanceDate: formatAustralianDate(appearanceDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  private getMonthFromFrequency(frequency: NewFrequencyType): number {
    const monthMap: { [key: string]: number } = {
      'start_of_month_jan': 0, 'end_of_month_jan': 0,
      'start_of_month_feb': 1, 'end_of_month_feb': 1,
      'start_of_month_mar': 2, 'end_of_month_mar': 2,
      'start_of_month_apr': 3, 'end_of_month_apr': 3,
      'start_of_month_may': 4, 'end_of_month_may': 4,
      'start_of_month_jun': 5, 'end_of_month_jun': 5,
      'start_of_month_jul': 6, 'end_of_month_jul': 6,
      'start_of_month_aug': 7, 'end_of_month_aug': 7,
      'start_of_month_sep': 8, 'end_of_month_sep': 8,
      'start_of_month_oct': 9, 'end_of_month_oct': 9,
      'start_of_month_nov': 10, 'end_of_month_nov': 10,
      'start_of_month_dec': 11, 'end_of_month_dec': 11,
    };
    return monthMap[frequency] ?? -1;
  }

  private isHoliday(date: Date): boolean {
    return this.holidayChecker.isHolidaySync(date);
  }

  private isSundayOrHoliday(date: Date): boolean {
    return date.getDay() === 0 || this.isHoliday(date);
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }

  private isNonWorkingDay(date: Date): boolean {
    // Non-working for monthly workday calculations: weekends (Sat/Sun) or PH
    return this.isWeekend(date) || this.isHoliday(date)
  }

  private async isSystemWorkingDay(date: Date): Promise<boolean> {
    // Check if date is a working day according to system settings
    return await isWorkingDay(date)
  }

  private async isSystemNonWorkingDay(date: Date): Promise<boolean> {
    // Check if date is a non-working day according to system settings or is a holiday
    const isWorking = await this.isSystemWorkingDay(date)
    return !isWorking || this.isHoliday(date)
  }

  private async getSystemCutoffTime(): Promise<string> {
    // Get the system cutoff time for missed tasks
    return await getSystemSetting('missed_cutoff_time')
  }

  private findNextBusinessDay(date: Date): Date {
    // Business day for weekly/carry rules: skip Sundays and PHs; Saturday allowed
    let nextDay = new Date(date);
    while (this.isSundayOrHoliday(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
  }

  private findPreviousBusinessDay(date: Date): Date {
    // Business day for weekly/carry rules: skip Sundays and PHs; Saturday allowed
    let prevDay = new Date(date);
    while (this.isSundayOrHoliday(prevDay)) {
      prevDay.setDate(prevDay.getDate() - 1);
    }
    return prevDay;
  }

  private findNextWeekday(date: Date): Date {
    // Weekday Mon–Fri and not a PH (used for monthly start rules)
    let d = new Date(date)
    while (d.getDay() === 0 || d.getDay() === 6 || this.isHoliday(d)) {
      d.setDate(d.getDate() + 1)
    }
    return d
  }

  private addWorkdaysExcludingWeekends(date: Date, days: number): Date {
    // Count 5 full workdays excluding weekends & PHs, extend forward if landing on PH/weekend
    let d = new Date(date)
    let added = 0
    while (added < days) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      const isWeekday = day >= 1 && day <= 5
      if (isWeekday && !this.isHoliday(d)) {
        added++
      }
    }
    // If final day happens to be PH (shouldn't due to loop), still safeguard
    while (d.getDay() === 0 || d.getDay() === 6 || this.isHoliday(d)) {
      d.setDate(d.getDate() + 1)
    }
    return d
  }

  private countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (!this.isSundayOrHoliday(currentDate)) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  }

  private getWeekMonday(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    return monday;
  }

  private getWeekSaturday(date: Date): Date {
    const monday = this.getWeekMonday(date);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return saturday;
  }

  private getLastMondayOfMonth(date: Date): Date {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const day = lastDay.getDay();
    const diff = lastDay.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(lastDay.setDate(diff));
  }

  private getLastSaturdayOfMonth(date: Date): Date {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const day = lastDay.getDay();
    // Calculate days to subtract to get to Saturday (6)
    const diff = day === 0 ? 1 : (7 - day + 6) % 7;
    const lastSaturday = new Date(lastDay);
    lastSaturday.setDate(lastDay.getDate() - diff);
    return lastSaturday;
  }
}
""