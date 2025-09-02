/**
 * Task Database Adapter
 * Pharmacy Intranet Portal - Database Integration Layer
 * 
 * This adapter bridges the gap between the current database schema
 * and the Task Recurrence & Status Engine interface requirements.
 * It handles data transformation and provides a clean interface.
 */

import { supabase } from './db'
import type { MasterTask, TaskInstance } from './new-recurrence-engine'
import { NewFrequencyType, TaskStatus } from './new-recurrence-engine'
import { australianNowUtcISOString } from './timezone-utils'

// ========================================
// DATABASE SCHEMA INTERFACES
// ========================================

/**
 * Database master_tasks table structure
 */
interface DatabaseMasterTask {
  id: string
  title: string
  description?: string
  position_id?: string
  frequency?: string // Legacy single frequency
  frequencies?: string[] // New multi-frequency array
  weekdays?: number[]
  months?: number[]
  timing?: string
  default_due_time?: string
  due_time?: string
  category?: string
  publish_status: 'active' | 'draft' | 'inactive'
  publish_delay_date?: string
  publish_delay?: string // Alternative name
  publish_at?: string // Alternative name
  sticky_once_off?: boolean
  allow_edit_when_locked?: boolean
  start_date?: string
  end_date?: string
  due_date?: string // For once-off tasks
  created_at: string
  updated_at: string
}

/**
 * Database task_instances table structure
 */
interface DatabaseTaskInstance {
  id: string
  master_task_id: string
  instance_date: string
  date?: string // Alternative column name
  due_date: string
  due_time?: string
  status: string
  is_published?: boolean
  completed_at?: string
  completed_by?: string
  locked: boolean
  acknowledged?: boolean
  resolved?: boolean
  is_carry_instance?: boolean
  original_appearance_date?: string
  due_date_override?: string
  due_time_override?: string
  created_at: string
  updated_at: string
}

// ========================================
// FREQUENCY MAPPING
// ========================================

/**
 * Map legacy frequency values to new NewFrequencyType enum
 */
const LEGACY_FREQUENCY_MAP: Record<string, NewFrequencyType[]> = {
  'once_off_sticky': [NewFrequencyType.ONCE_OFF],
  'every_day': [NewFrequencyType.EVERY_DAY],
  'weekly': [NewFrequencyType.ONCE_WEEKLY],
  'specific_weekdays': [], // Will be mapped based on weekdays array
  'start_every_month': [NewFrequencyType.START_OF_EVERY_MONTH],
  'start_certain_months': [], // Will be mapped based on months array
  'every_month': [NewFrequencyType.ONCE_MONTHLY],
  'certain_months': [NewFrequencyType.ONCE_MONTHLY], // Fallback
  'end_every_month': [NewFrequencyType.END_OF_EVERY_MONTH],
  'end_certain_months': [] // Will be mapped based on months array
}

/**
 * Map weekday numbers to NewFrequencyType
 */
const WEEKDAY_FREQUENCY_MAP: Record<number, NewFrequencyType> = {
  1: NewFrequencyType.MONDAY,
  2: NewFrequencyType.TUESDAY,
  3: NewFrequencyType.WEDNESDAY,
  4: NewFrequencyType.THURSDAY,
  5: NewFrequencyType.FRIDAY,
  6: NewFrequencyType.SATURDAY
}

/**
 * Map month numbers to start-of-month NewFrequencyType
 */
const START_MONTH_FREQUENCY_MAP: Record<number, NewFrequencyType> = {
  1: NewFrequencyType.START_OF_MONTH_JAN,
  2: NewFrequencyType.START_OF_MONTH_FEB,
  3: NewFrequencyType.START_OF_MONTH_MAR,
  4: NewFrequencyType.START_OF_MONTH_APR,
  5: NewFrequencyType.START_OF_MONTH_MAY,
  6: NewFrequencyType.START_OF_MONTH_JUN,
  7: NewFrequencyType.START_OF_MONTH_JUL,
  8: NewFrequencyType.START_OF_MONTH_AUG,
  9: NewFrequencyType.START_OF_MONTH_SEP,
  10: NewFrequencyType.START_OF_MONTH_OCT,
  11: NewFrequencyType.START_OF_MONTH_NOV,
  12: NewFrequencyType.START_OF_MONTH_DEC
}

/**
 * Map month numbers to end-of-month NewFrequencyType
 */
const END_MONTH_FREQUENCY_MAP: Record<number, NewFrequencyType> = {
  1: NewFrequencyType.END_OF_MONTH_JAN,
  2: NewFrequencyType.END_OF_MONTH_FEB,
  3: NewFrequencyType.END_OF_MONTH_MAR,
  4: NewFrequencyType.END_OF_MONTH_APR,
  5: NewFrequencyType.END_OF_MONTH_MAY,
  6: NewFrequencyType.END_OF_MONTH_JUN,
  7: NewFrequencyType.END_OF_MONTH_JUL,
  8: NewFrequencyType.END_OF_MONTH_AUG,
  9: NewFrequencyType.END_OF_MONTH_SEP,
  10: NewFrequencyType.END_OF_MONTH_OCT,
  11: NewFrequencyType.END_OF_MONTH_NOV,
  12: NewFrequencyType.END_OF_MONTH_DEC
}

/**
 * Map database status values to TaskStatus enum
 */
const STATUS_MAP: Record<string, TaskStatus> = {
  'not_due': TaskStatus.PENDING,
  'due_today': TaskStatus.PENDING,
  'pending': TaskStatus.PENDING,
  'in_progress': TaskStatus.IN_PROGRESS,
  'overdue': TaskStatus.OVERDUE,
  'missed': TaskStatus.MISSED,
  'done': TaskStatus.DONE,
  'completed': TaskStatus.DONE
}

/**
 * Reverse map TaskStatus to database status values
 */
const REVERSE_STATUS_MAP: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: 'pending',
  [TaskStatus.IN_PROGRESS]: 'in_progress',
  [TaskStatus.OVERDUE]: 'overdue',
  [TaskStatus.MISSED]: 'missed',
  [TaskStatus.DONE]: 'done'
}

// ========================================
// ADAPTER CLASS
// ========================================

export class TaskDatabaseAdapter {
  
  /**
   * Load active master tasks from database and convert to engine format
   */
  async loadActiveMasterTasks(): Promise<MasterTask[]> {
    const { data: dbTasks, error } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('publish_status', 'active')
      .order('title')

    if (error) {
      throw new Error(`Failed to load master tasks: ${error.message}`)
    }

    return (dbTasks || []).map(task => this.convertDatabaseTaskToEngine(task))
  }

  /**
   * Load task instances for a specific date
   */
  async loadTaskInstancesForDate(date: string): Promise<TaskInstance[]> {
    const { data: dbInstances, error } = await supabase
      .from('task_instances')
      .select('*')
      .eq('instance_date', date)
      .order('created_at')

    if (error) {
      throw new Error(`Failed to load task instances: ${error.message}`)
    }

    return (dbInstances || []).map(instance => this.convertDatabaseInstanceToEngine(instance))
  }

  /**
   * Save new task instances to database
   */
  async saveTaskInstances(instances: TaskInstance[]): Promise<void> {
    if (instances.length === 0) return

    const dbInstances = instances.map(instance => this.convertEngineInstanceToDatabase(instance))

    const { error } = await supabase
      .from('task_instances')
      .insert(dbInstances)

    if (error) {
      throw new Error(`Failed to save task instances: ${error.message}`)
    }
  }

  /**
   * Update task instance statuses in database
   */
  async updateTaskInstanceStatuses(updates: Array<{
    id: string
    status: TaskStatus
    locked: boolean
  }>): Promise<void> {
    if (updates.length === 0) return

    // Update instances one by one to ensure proper status mapping
    for (const update of updates) {
      const { error } = await supabase
        .from('task_instances')
        .update({
          status: REVERSE_STATUS_MAP[update.status],
          locked: update.locked,
          updated_at: australianNowUtcISOString()
        })
        .eq('id', update.id)

      if (error) {
        console.error(`Failed to update instance ${update.id}:`, error)
      }
    }
  }

  /**
   * Check if instances already exist for a date
   */
  async instancesExistForDate(date: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('task_instances')
      .select('id')
      .eq('instance_date', date)
      .limit(1)

    if (error) {
      throw new Error(`Failed to check existing instances: ${error.message}`)
    }

    return (data || []).length > 0
  }

  /**
   * Delete existing instances for a date (for force regeneration)
   */
  async deleteInstancesForDate(date: string): Promise<void> {
    const { error } = await supabase
      .from('task_instances')
      .delete()
      .eq('instance_date', date)

    if (error) {
      throw new Error(`Failed to delete existing instances: ${error.message}`)
    }
  }

  // ========================================
  // CONVERSION METHODS
  // ========================================

  /**
   * Convert database master task to engine format
   */
  private convertDatabaseTaskToEngine(dbTask: DatabaseMasterTask): MasterTask {
    // Responsibility and categories can be array columns per latest schema.
    // Fallback to legacy single fields when arrays are missing.
    const anyTask: any = dbTask as any
    const responsibility: string[] = Array.isArray(anyTask.responsibility)
      ? anyTask.responsibility
      : []

    const categories: string[] = Array.isArray(anyTask.categories)
      ? anyTask.categories
      : (dbTask.category ? [dbTask.category] : [])

    return {
      id: dbTask.id,
      title: dbTask.title,
      description: dbTask.description,
      active: dbTask.publish_status === 'active',
      frequencies: this.mapFrequencies(dbTask),
      timing: this.mapTiming(dbTask),
      publish_at: dbTask.publish_delay_date || dbTask.publish_delay || dbTask.publish_at,
      due_date: dbTask.due_date,
      start_date: dbTask.start_date,
      end_date: dbTask.end_date,
      responsibility,
      categories
    }
  }

  /**
   * Convert database task instance to engine format
   */
  private convertDatabaseInstanceToEngine(dbInstance: DatabaseTaskInstance): TaskInstance {
    return {
      id: dbInstance.id,
      master_task_id: dbInstance.master_task_id,
      date: dbInstance.instance_date || dbInstance.date || '',
      due_date: dbInstance.due_date,
      due_time: dbInstance.due_time || '09:00',
      status: STATUS_MAP[dbInstance.status] || TaskStatus.PENDING,
      locked: dbInstance.locked,
      created_at: dbInstance.created_at,
      updated_at: dbInstance.updated_at,
      due_date_override: dbInstance.due_date_override,
      due_time_override: dbInstance.due_time_override,
      is_carry_instance: dbInstance.is_carry_instance || false,
      original_appearance_date: dbInstance.original_appearance_date
    }
  }

  /**
   * Convert engine task instance to database format
   */
  private convertEngineInstanceToDatabase(instance: TaskInstance): any {
    return {
      id: instance.id,
      master_task_id: instance.master_task_id,
      instance_date: instance.date,
      due_date: instance.due_date,
      due_time: instance.due_time,
      status: REVERSE_STATUS_MAP[instance.status],
      locked: instance.locked,
      is_carry_instance: instance.is_carry_instance,
      original_appearance_date: instance.original_appearance_date,
      due_date_override: instance.due_date_override,
      due_time_override: instance.due_time_override,
      created_at: instance.created_at,
      updated_at: instance.updated_at
    }
  }

  /**
   * Map database frequency data to NewFrequencyType array
   */
  private mapFrequencies(dbTask: DatabaseMasterTask): NewFrequencyType[] {
    // If new frequencies array exists, use it directly
    if (dbTask.frequencies && dbTask.frequencies.length > 0) {
      return dbTask.frequencies.map(f => f as NewFrequencyType)
    }

    // Otherwise, map from legacy frequency + weekdays/months
    if (!dbTask.frequency) {
      return [NewFrequencyType.EVERY_DAY] // Default fallback
    }

    let frequencies: NewFrequencyType[] = []

    // Handle legacy frequency mapping
    const baseFrequencies = LEGACY_FREQUENCY_MAP[dbTask.frequency] || []
    frequencies.push(...baseFrequencies)

    // Handle specific weekdays
    if (dbTask.frequency === 'specific_weekdays' && dbTask.weekdays) {
      for (const weekday of dbTask.weekdays) {
        const freq = WEEKDAY_FREQUENCY_MAP[weekday]
        if (freq) frequencies.push(freq)
      }
    }

    // Handle start of certain months
    if (dbTask.frequency === 'start_certain_months' && dbTask.months) {
      for (const month of dbTask.months) {
        const freq = START_MONTH_FREQUENCY_MAP[month]
        if (freq) frequencies.push(freq)
      }
    }

    // Handle end of certain months
    if (dbTask.frequency === 'end_certain_months' && dbTask.months) {
      for (const month of dbTask.months) {
        const freq = END_MONTH_FREQUENCY_MAP[month]
        if (freq) frequencies.push(freq)
      }
    }

    return frequencies.length > 0 ? frequencies : [NewFrequencyType.EVERY_DAY]
  }

  /**
   * Map database timing to engine format
   */
  private mapTiming(dbTask: DatabaseMasterTask): string {
    // Use due_time if available, otherwise default_due_time, otherwise timing-based default
    if (dbTask.due_time) {
      return dbTask.due_time
    }
    
    if (dbTask.default_due_time) {
      return dbTask.default_due_time
    }

    // Map timing categories to default times
    switch (dbTask.timing) {
      case 'opening': return '09:30'
      case 'anytime_during_day': return '16:30'
      case 'before_order_cut_off': return '16:55'
      case 'closing': return '17:00'
      default: return '09:30'
    }
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const taskDatabaseAdapter = new TaskDatabaseAdapter()