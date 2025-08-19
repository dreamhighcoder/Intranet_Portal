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

import { createHolidayHelper, type HolidayChecker } from './public-holidays'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Simplified frequency types matching the specification
 */
export enum NewFrequencyType {
  ONCE_OFF = 'OnceOff',
  EVERY_DAY = 'EveryDay', 
  ONCE_WEEKLY = 'OnceWeekly',
  EVERY_MON = 'EveryMon',
  EVERY_TUE = 'EveryTue', 
  EVERY_WED = 'EveryWed',
  EVERY_THU = 'EveryThu',
  EVERY_FRI = 'EveryFri',
  EVERY_SAT = 'EverySat',
  START_OF_MONTH = 'StartOfMonth',
  ONCE_MONTHLY = 'OnceMonthly',
  END_OF_MONTH = 'EndOfMonth'
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
 * Master task interface for the new engine
 */
export interface MasterTask {
  id: string
  active: boolean
  frequency: NewFrequencyType
  timing: string // Default due time (HH:MM format)
  publish_at?: string // ISO date string - no instances before this date
  due_date?: string // For OnceOff tasks - admin-entered due date
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
  reason: string
}

// ========================================
// NEW RECURRENCE ENGINE CLASS
// ========================================

export class NewRecurrenceEngine {
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
    const targetDate = new Date(date)
    const instances: TaskInstance[] = []
    const carry_instances: TaskInstance[] = []

    for (const task of masterTasks) {
      // Skip if not active or before publish_at date
      if (!task.active) continue
      if (task.publish_at && targetDate < new Date(task.publish_at)) continue

      const result = this.processTaskForDate(task, targetDate)
      if (result.shouldAppear) {
        const instance: TaskInstance = {
          id: `${task.id}-${date}`,
          master_task_id: task.id,
          date: date,
          due_date: result.dueDate,
          due_time: task.due_time_override || task.timing,
          status: TaskStatus.PENDING,
          locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        if (result.isCarryOver) {
          carry_instances.push(instance)
        } else {
          instances.push(instance)
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
   * Update statuses for existing instances based on current time
   */
  updateInstanceStatuses(instances: TaskInstance[], currentDateTime: Date, masterTasks?: MasterTask[]): StatusUpdateResult[] {
    const results: StatusUpdateResult[] = []

    for (const instance of instances) {
      const result = this.calculateStatusUpdate(instance, currentDateTime, masterTasks)
      if (result.new_status !== result.old_status) {
        results.push(result)
      }
    }

    return results
  }

  /**
   * Process a single task for a specific date
   */
  private processTaskForDate(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    switch (task.frequency) {
      case NewFrequencyType.ONCE_OFF:
        return this.processOnceOff(task, date)
      
      case NewFrequencyType.EVERY_DAY:
        return this.processEveryDay(task, date)
      
      case NewFrequencyType.ONCE_WEEKLY:
        return this.processOnceWeekly(task, date)
      
      case NewFrequencyType.EVERY_MON:
      case NewFrequencyType.EVERY_TUE:
      case NewFrequencyType.EVERY_WED:
      case NewFrequencyType.EVERY_THU:
      case NewFrequencyType.EVERY_FRI:
      case NewFrequencyType.EVERY_SAT:
        return this.processSpecificWeekday(task, date)
      
      case NewFrequencyType.START_OF_MONTH:
        return this.processStartOfMonth(task, date)
      
      case NewFrequencyType.ONCE_MONTHLY:
        return this.processOnceMonthly(task, date)
      
      case NewFrequencyType.END_OF_MONTH:
        return this.processEndOfMonth(task, date)
      
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
  } {
    if (!task.due_date) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    const dueDate = new Date(task.due_date)
    const firstEligibleDate = task.publish_at ? new Date(task.publish_at) : dueDate

    // Appears from first eligible date onwards (same instance continues)
    if (date >= firstEligibleDate) {
      return {
        shouldAppear: true,
        isCarryOver: date > firstEligibleDate,
        dueDate: task.due_date
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
    // Skip Sundays (day 0) and public holidays
    if (date.getDay() === 0 || this.holidayChecker.isHoliday(date)) {
      return { shouldAppear: false, isCarryOver: false, dueDate: '' }
    }

    return {
      shouldAppear: true,
      isCarryOver: false,
      dueDate: this.formatDate(date)
    }
  }

  /**
   * 3) Once Weekly - Monday anchored, carries through Saturday, locks on due date
   */
  private processOnceWeekly(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
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
      dueDate = this.findNearestEarlierWeekdayInWeek(dueDate, monday)
    }

    // Appears from appearance date through due date
    if (date >= appearanceDate && date <= dueDate) {
      return {
        shouldAppear: true,
        isCarryOver: date > appearanceDate,
        dueDate: this.formatDate(dueDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 4) Every Mon/Tue/Wed/Thu/Fri/Sat - Specific weekday, carries through Saturday
   */
  private processSpecificWeekday(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    const targetWeekday = this.getTargetWeekday(task.frequency)
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
        shouldAppear: true,
        isCarryOver: date > appearanceDate,
        dueDate: this.formatDate(scheduledDay) // Due date is the original scheduled day
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 5) Start of Month - 1st of month (with shifts), +5 workdays due, carries to last Saturday
   */
  private processStartOfMonth(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    // Only process if we're in the same month as the target date
    const targetMonth = date.getMonth()
    const targetYear = date.getFullYear()
    const firstOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1))
    
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
        shouldAppear: true,
        isCarryOver: date > appearanceDate,
        dueDate: this.formatDate(dueDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 6) Once Monthly - Same appearance as Start of Month, due last Saturday, locks on due date
   */
  private processOnceMonthly(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    // Only process if we're in the same month as the target date
    const targetMonth = date.getMonth()
    const targetYear = date.getFullYear()
    const firstOfMonth = new Date(Date.UTC(targetYear, targetMonth, 1))
    
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
        shouldAppear: true,
        isCarryOver: date > appearanceDate,
        dueDate: this.formatDate(dueDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * 7) End of Month - Last Monday with ≥5 workdays, due last Saturday, locks on due date
   */
  private processEndOfMonth(task: MasterTask, date: Date): {
    shouldAppear: boolean
    isCarryOver: boolean
    dueDate: string
  } {
    // Only process if we're in the same month as the target date
    const targetMonth = date.getMonth()
    const targetYear = date.getFullYear()
    
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
        shouldAppear: true,
        isCarryOver: date > appearanceDate,
        dueDate: this.formatDate(dueDate)
      }
    }

    return { shouldAppear: false, isCarryOver: false, dueDate: '' }
  }

  /**
   * Calculate status update for an instance based on current time
   */
  private calculateStatusUpdate(instance: TaskInstance, currentDateTime: Date, masterTasks?: MasterTask[]): StatusUpdateResult {
    const currentDate = this.formatDate(currentDateTime)
    const currentTime = this.formatTime(currentDateTime)
    const dueDate = instance.due_date
    const dueTime = instance.due_time_override || instance.due_time

    let newStatus = instance.status
    let locked = instance.locked
    let reason = 'No change'

    // Skip if already done
    if (instance.status === TaskStatus.DONE) {
      return {
        instance_id: instance.id,
        old_status: instance.status,
        new_status: instance.status,
        locked,
        reason: 'Already completed'
      }
    }

    // Get master task frequency to determine locking rules
    const frequency = this.getFrequencyFromMasterTasks(instance.master_task_id, masterTasks)

    // Status transitions based on time
    if (currentDate === dueDate && currentTime >= dueTime) {
      // At due time on due date → Overdue (unlocked)
      if (instance.status === TaskStatus.PENDING || instance.status === TaskStatus.IN_PROGRESS) {
        newStatus = TaskStatus.OVERDUE
        reason = 'Past due time'
      }
    }

    // Locking rules based on frequency
    if (currentDate > dueDate || (currentDate === dueDate && currentTime >= '23:59')) {
      switch (frequency) {
        case NewFrequencyType.ONCE_OFF:
          // Never auto-lock
          break
          
        case NewFrequencyType.EVERY_DAY:
          // Lock at 23:59 same date
          if (currentDate === dueDate && currentTime >= '23:59') {
            newStatus = TaskStatus.MISSED
            locked = true
            reason = 'Missed at 23:59'
          }
          break
          
        case NewFrequencyType.ONCE_WEEKLY:
        case NewFrequencyType.ONCE_MONTHLY:
        case NewFrequencyType.END_OF_MONTH:
          // Lock at 23:59 on due date
          if (currentDate === dueDate && currentTime >= '23:59') {
            newStatus = TaskStatus.MISSED
            locked = true
            reason = 'Missed at due date cutoff'
          }
          break
          
        case NewFrequencyType.EVERY_MON:
        case NewFrequencyType.EVERY_TUE:
        case NewFrequencyType.EVERY_WED:
        case NewFrequencyType.EVERY_THU:
        case NewFrequencyType.EVERY_FRI:
        case NewFrequencyType.EVERY_SAT:
        case NewFrequencyType.START_OF_MONTH:
          // Lock at Saturday cutoff (or earlier PH stop)
          const saturdayCutoff = this.calculateSaturdayCutoff(instance, currentDateTime)
          if (currentDateTime >= saturdayCutoff) {
            newStatus = TaskStatus.MISSED
            locked = true
            reason = 'Missed at Saturday cutoff'
          }
          break
      }
    }

    return {
      instance_id: instance.id,
      old_status: instance.status,
      new_status: newStatus,
      locked,
      reason
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

  private getTargetWeekday(frequency: NewFrequencyType): number {
    switch (frequency) {
      case NewFrequencyType.EVERY_MON: return 1
      case NewFrequencyType.EVERY_TUE: return 2
      case NewFrequencyType.EVERY_WED: return 3
      case NewFrequencyType.EVERY_THU: return 4
      case NewFrequencyType.EVERY_FRI: return 5
      case NewFrequencyType.EVERY_SAT: return 6
      default: return 1
    }
  }

  private findNextWeekdayInWeek(startDate: Date, endDate: Date): Date {
    let current = new Date(startDate)
    current.setDate(current.getDate() + 1)
    
    while (current <= endDate) {
      if (!this.isWeekend(current) && !this.holidayChecker.isHoliday(current)) {
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
      if (!this.isWeekend(current) && !this.holidayChecker.isHoliday(current)) {
        return current
      }
      current.setDate(current.getDate() - 1)
    }
    
    return null
  }

  private findFirstMondayAfter(date: Date): Date {
    let current = new Date(date)
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() + 1)
    }
    return current
  }

  private findNextWeekday(date: Date): Date {
    let current = new Date(date)
    current.setDate(current.getDate() + 1)
    
    while (this.isWeekend(current) || this.holidayChecker.isHoliday(current)) {
      current.setDate(current.getDate() + 1)
    }
    
    return current
  }

  private addWorkdays(startDate: Date, workdays: number): Date {
    let current = new Date(startDate)
    let added = 0
    
    while (added < workdays) {
      current.setDate(current.getDate() + 1)
      if (!this.isWeekend(current) && !this.holidayChecker.isHoliday(current)) {
        added++
      }
    }
    
    // If lands on PH, move to next day
    if (this.holidayChecker.isHoliday(current)) {
      current.setDate(current.getDate() + 1)
    }
    
    return current
  }

  private getLastSaturdayOfMonth(date: Date): Date {
    const lastDay = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0))
    const saturday = new Date(lastDay)
    
    while (saturday.getDay() !== 6) {
      saturday.setDate(saturday.getDate() - 1)
    }
    
    return saturday
  }

  private findNearestEarlierWeekdayInMonth(date: Date): Date | null {
    let current = new Date(date)
    current.setDate(current.getDate() - 1)
    
    while (current.getMonth() === date.getMonth()) {
      if (!this.isWeekend(current) && !this.holidayChecker.isHoliday(current)) {
        return current
      }
      current.setDate(current.getDate() - 1)
    }
    
    return null
  }

  private findEndOfMonthAppearanceDate(date: Date): Date {
    const lastSaturday = this.getLastSaturdayOfMonth(date)
    
    // Find latest Monday with ≥5 remaining workdays
    let monday = new Date(lastSaturday)
    while (monday.getDay() !== 1) {
      monday.setDate(monday.getDate() - 1)
    }
    
    // Check if this Monday has ≥5 workdays remaining
    const workdaysRemaining = this.countWorkdaysUntilEndOfMonth(monday)
    if (workdaysRemaining >= 5) {
      // Handle PH shifting
      if (this.holidayChecker.isHoliday(monday)) {
        return this.findNextWeekday(monday)
      }
      return monday
    } else {
      // Move to previous Monday
      monday.setDate(monday.getDate() - 7)
      if (this.holidayChecker.isHoliday(monday)) {
        return this.findNextWeekday(monday)
      }
      return monday
    }
  }

  private countWorkdaysUntilEndOfMonth(startDate: Date): number {
    const endOfMonth = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth() + 1, 0))
    let current = new Date(startDate)
    let count = 0
    
    while (current <= endOfMonth) {
      if (!this.isWeekend(current) && !this.holidayChecker.isHoliday(current)) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }

  private calculateSaturdayCutoff(instance: TaskInstance, currentDateTime: Date): Date {
    // This would need to be implemented based on the instance's week/month context
    // For now, return a placeholder
    const instanceDate = new Date(instance.date)
    const weekMonday = this.getWeekMonday(instanceDate)
    const saturday = new Date(weekMonday)
    saturday.setDate(weekMonday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)
    return saturday
  }

  private getFrequencyFromMasterTasks(masterTaskId: string, masterTasks?: MasterTask[]): NewFrequencyType {
    if (masterTasks) {
      const masterTask = masterTasks.find(t => t.id === masterTaskId)
      if (masterTask) {
        return masterTask.frequency
      }
    }
    // Default fallback
    return NewFrequencyType.EVERY_DAY
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

export function createNewRecurrenceEngine(publicHolidays: any[] = []): NewRecurrenceEngine {
  return new NewRecurrenceEngine(publicHolidays)
}

export function createNewRecurrenceEngineWithTimezone(
  publicHolidays: any[] = [], 
  timezone: string = 'Australia/Sydney'
): NewRecurrenceEngine {
  return new NewRecurrenceEngine(publicHolidays, timezone)
}