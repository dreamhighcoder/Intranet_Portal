/**
 * Recurrence Engine for Pharmacy Intranet Portal
 * Implements all complex recurrence rules and public holiday logic
 */

import { supabase } from './supabase'
import type { MasterTask, PublicHoliday } from './supabase'

export interface RecurrenceOptions {
  masterTask: MasterTask
  startDate: Date
  endDate: Date
  publicHolidays: PublicHoliday[]
}

export interface TaskInstanceData {
  master_task_id: string
  instance_date: string
  due_date: string
  due_time: string
  status: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done'
}

/**
 * Main recurrence engine - generates task instances for a master task
 */
export class RecurrenceEngine {
  private publicHolidays: Set<string>

  constructor(holidays: PublicHoliday[]) {
    this.publicHolidays = new Set(holidays.map(h => h.date))
  }

  /**
   * Generate all task instances for a master task within date range
   */
  generateInstances(options: RecurrenceOptions): TaskInstanceData[] {
    const { masterTask, startDate, endDate } = options
    const instances: TaskInstanceData[] = []

    switch (masterTask.frequency) {
      case 'once_off_sticky':
        instances.push(...this.generateOnceOffSticky(masterTask, startDate))
        break

      case 'every_day':
        instances.push(...this.generateEveryDay(masterTask, startDate, endDate))
        break

      case 'weekly':
        instances.push(...this.generateWeekly(masterTask, startDate, endDate))
        break

      case 'specific_weekdays':
        instances.push(...this.generateSpecificWeekdays(masterTask, startDate, endDate))
        break

      case 'start_every_month':
        instances.push(...this.generateStartEveryMonth(masterTask, startDate, endDate))
        break

      case 'start_certain_months':
        instances.push(...this.generateStartCertainMonths(masterTask, startDate, endDate))
        break

      case 'every_month':
        instances.push(...this.generateEveryMonth(masterTask, startDate, endDate))
        break

      case 'certain_months':
        instances.push(...this.generateCertainMonths(masterTask, startDate, endDate))
        break

      case 'end_every_month':
        instances.push(...this.generateEndEveryMonth(masterTask, startDate, endDate))
        break

      case 'end_certain_months':
        instances.push(...this.generateEndCertainMonths(masterTask, startDate, endDate))
        break

      default:
        console.warn(`Unknown frequency: ${masterTask.frequency}`)
    }

    return instances
  }

  /**
   * Once-off sticky: Creates one instance that persists until done
   */
  private generateOnceOffSticky(masterTask: MasterTask, startDate: Date): TaskInstanceData[] {
    const instanceDate = this.formatDate(startDate)
    return [{
      master_task_id: masterTask.id,
      instance_date: instanceDate,
      due_date: instanceDate,
      due_time: masterTask.default_due_time || '17:00',
      status: 'not_due'
    }]
  }

  /**
   * Every Day: Mon-Sat, skip public holidays, no substitution
   */
  private generateEveryDay(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayOfWeek = current.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
      const dateStr = this.formatDate(current)

      // Mon-Sat only (1-6), skip Sundays and public holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 6 && !this.isPublicHoliday(dateStr)) {
        instances.push({
          master_task_id: masterTask.id,
          instance_date: dateStr,
          due_date: dateStr,
          due_time: masterTask.default_due_time || '17:00',
          status: 'not_due'
        })
      }

      current.setDate(current.getDate() + 1)
    }

    return instances
  }

  /**
   * Weekly (Monday): If Monday is PH, push forward (Mon→Tue→Wed)
   */
  private generateWeekly(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    
    // Find first Monday on or after startDate
    let current = new Date(startDate)
    while (current.getDay() !== 1) { // 1 = Monday
      current.setDate(current.getDate() + 1)
    }

    while (current <= endDate) {
      const mondayDate = this.formatDate(current)
      let instanceDate = new Date(current)

      // If Monday is a public holiday, push forward
      while (this.isPublicHoliday(this.formatDate(instanceDate)) && instanceDate.getDay() <= 3) {
        instanceDate.setDate(instanceDate.getDate() + 1)
      }

      // Only create instance if we haven't pushed past Wednesday
      if (instanceDate.getDay() <= 3) {
        instances.push({
          master_task_id: masterTask.id,
          instance_date: this.formatDate(instanceDate),
          due_date: this.formatDate(instanceDate),
          due_time: masterTask.default_due_time || '17:00',
          status: 'not_due'
        })
      }

      // Move to next Monday
      current.setDate(current.getDate() + 7)
    }

    return instances
  }

  /**
   * Specific Weekdays: Tue-Sat shift earlier if possible, Mon always pushes forward
   */
  private generateSpecificWeekdays(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const targetWeekdays = masterTask.weekdays || []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayOfWeek = current.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
      const dateStr = this.formatDate(current)

      if (targetWeekdays.includes(dayOfWeek)) {
        let instanceDate = new Date(current)

        if (this.isPublicHoliday(dateStr)) {
          if (dayOfWeek === 1) {
            // Monday: push forward
            while (this.isPublicHoliday(this.formatDate(instanceDate)) && instanceDate.getDay() <= 6) {
              instanceDate.setDate(instanceDate.getDate() + 1)
            }
          } else {
            // Tue-Sat: shift earlier in week if possible
            let shifted = false
            for (let i = dayOfWeek - 1; i >= 1; i--) {
              const testDate = new Date(current)
              testDate.setDate(testDate.getDate() - (dayOfWeek - i))
              if (!this.isPublicHoliday(this.formatDate(testDate))) {
                instanceDate = testDate
                shifted = true
                break
              }
            }
            
            // If couldn't shift earlier, push forward
            if (!shifted) {
              while (this.isPublicHoliday(this.formatDate(instanceDate)) && instanceDate.getDay() <= 6) {
                instanceDate.setDate(instanceDate.getDate() + 1)
              }
            }
          }
        }

        // Only create if still in a workday
        if (instanceDate.getDay() >= 1 && instanceDate.getDay() <= 6) {
          instances.push({
            master_task_id: masterTask.id,
            instance_date: this.formatDate(instanceDate),
            due_date: this.formatDate(instanceDate),
            due_time: masterTask.default_due_time || '17:00',
            status: 'not_due'
          })
        }
      }

      current.setDate(current.getDate() + 1)
    }

    return instances
  }

  /**
   * Start of Every Month: Due = +5 full workdays (exclude weekends/PHs)
   */
  private generateStartEveryMonth(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      const instanceDate = this.formatDate(current)
      const dueDate = this.addWorkdays(current, 5)

      instances.push({
        master_task_id: masterTask.id,
        instance_date: instanceDate,
        due_date: this.formatDate(dueDate),
        due_time: masterTask.default_due_time || '17:00',
        status: 'not_due'
      })

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  /**
   * Start of Certain Months: Same as start of every month but filtered by months array
   */
  private generateStartCertainMonths(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const targetMonths = masterTask.months || []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      if (targetMonths.includes(current.getMonth() + 1)) { // months are 1-indexed in DB
        const instanceDate = this.formatDate(current)
        const dueDate = this.addWorkdays(current, 5)

        instances.push({
          master_task_id: masterTask.id,
          instance_date: instanceDate,
          due_date: this.formatDate(dueDate),
          due_time: masterTask.default_due_time || '17:00',
          status: 'not_due'
        })
      }

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  /**
   * Every Month: Due = last Saturday of month (move earlier if Saturday is PH)
   */
  private generateEveryMonth(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      const instanceDate = this.formatDate(current)
      const lastSaturday = this.getLastSaturday(current)
      let dueDate = lastSaturday

      // If last Saturday is PH, move to previous Saturday
      while (this.isPublicHoliday(this.formatDate(dueDate))) {
        dueDate.setDate(dueDate.getDate() - 7)
      }

      instances.push({
        master_task_id: masterTask.id,
        instance_date: instanceDate,
        due_date: this.formatDate(dueDate),
        due_time: masterTask.default_due_time || '17:00',
        status: 'not_due'
      })

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  /**
   * Certain Months: Same as every month but filtered by months array
   */
  private generateCertainMonths(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const targetMonths = masterTask.months || []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      if (targetMonths.includes(current.getMonth() + 1)) {
        const instanceDate = this.formatDate(current)
        const lastSaturday = this.getLastSaturday(current)
        let dueDate = lastSaturday

        // If last Saturday is PH, move to previous Saturday
        while (this.isPublicHoliday(this.formatDate(dueDate))) {
          dueDate.setDate(dueDate.getDate() - 7)
        }

        instances.push({
          master_task_id: masterTask.id,
          instance_date: instanceDate,
          due_date: this.formatDate(dueDate),
          due_time: masterTask.default_due_time || '17:00',
          status: 'not_due'
        })
      }

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  /**
   * End of Every Month: Last or second-last Monday depending on workdays
   */
  private generateEndEveryMonth(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      const lastMonday = this.getLastMonday(current)
      let instanceDate = lastMonday

      // Adjust for public holidays - move to previous Monday if needed
      while (this.isPublicHoliday(this.formatDate(instanceDate))) {
        instanceDate.setDate(instanceDate.getDate() - 7)
      }

      instances.push({
        master_task_id: masterTask.id,
        instance_date: this.formatDate(instanceDate),
        due_date: this.formatDate(instanceDate),
        due_time: masterTask.default_due_time || '17:00',
        status: 'not_due'
      })

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  /**
   * End of Certain Months: Same as end of every month but filtered
   */
  private generateEndCertainMonths(masterTask: MasterTask, startDate: Date, endDate: Date): TaskInstanceData[] {
    const instances: TaskInstanceData[] = []
    const targetMonths = masterTask.months || []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (current <= endDate) {
      if (targetMonths.includes(current.getMonth() + 1)) {
        const lastMonday = this.getLastMonday(current)
        let instanceDate = lastMonday

        // Adjust for public holidays
        while (this.isPublicHoliday(this.formatDate(instanceDate))) {
          instanceDate.setDate(instanceDate.getDate() - 7)
        }

        instances.push({
          master_task_id: masterTask.id,
          instance_date: instanceDate,
          due_date: this.formatDate(instanceDate),
          due_time: masterTask.default_due_time || '17:00',
          status: 'not_due'
        })
      }

      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
      current.setDate(1)
    }

    return instances
  }

  // Utility methods

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private isPublicHoliday(dateStr: string): boolean {
    return this.publicHolidays.has(dateStr)
  }

  private addWorkdays(startDate: Date, workdays: number): Date {
    const result = new Date(startDate)
    let added = 0

    while (added < workdays) {
      result.setDate(result.getDate() + 1)
      const dayOfWeek = result.getDay()
      
      // Skip weekends and public holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 6 && !this.isPublicHoliday(this.formatDate(result))) {
        added++
      }
    }

    return result
  }

  private getLastSaturday(month: Date): Date {
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const dayOfWeek = lastDay.getDay()
    const daysToSubtract = dayOfWeek === 6 ? 0 : (dayOfWeek + 1) % 7
    lastDay.setDate(lastDay.getDate() - daysToSubtract)
    return lastDay
  }

  private getLastMonday(month: Date): Date {
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const dayOfWeek = lastDay.getDay()
    const daysToSubtract = dayOfWeek === 1 ? 0 : (dayOfWeek + 6) % 7
    lastDay.setDate(lastDay.getDate() - daysToSubtract)
    return lastDay
  }
}

/**
 * Factory function to create recurrence engine with current public holidays
 */
export async function createRecurrenceEngine(): Promise<RecurrenceEngine> {
  const { data: holidays, error } = await supabase
    .from('public_holidays')
    .select('*')

  if (error) {
    console.error('Error fetching public holidays:', error)
    return new RecurrenceEngine([])
  }

  return new RecurrenceEngine(holidays || [])
}