/**
 * Status Manager for Checklist Instances
 * Pharmacy Intranet Portal - Status Lifecycle Management
 * 
 * This module provides functionality to:
 * - Update instance statuses based on due times and cutoffs
 * - Handle overdue logic (overdue at due_time)
 * - Handle missed logic (missed at 23:59 or Saturday cutoff for week/month rules)
 * - Provide status transition history and audit trails
 * - Support bulk status updates for date ranges
 */

import { supabase } from './db'
import type { 
  InstanceRow,
  ChecklistInstanceStatus 
} from './db'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Status transition rules
 */
export interface StatusTransitionRule {
  fromStatus: ChecklistInstanceStatus
  toStatus: ChecklistInstanceStatus
  condition: 'time_based' | 'date_based' | 'manual' | 'auto'
  description: string
}

/**
 * Status update options
 */
export interface StatusUpdateOptions {
  date?: string // ISO date string (YYYY-MM-DD), defaults to today
  forceUpdate?: boolean // Force update even if status shouldn't change
  dryRun?: boolean // Show what would be updated without making changes
  testMode?: boolean // Test mode - don't actually update database
  maxInstances?: number // Maximum instances to process
  logLevel?: 'silent' | 'info' | 'debug'
}

/**
 * Status update result for a single instance
 */
export interface InstanceStatusUpdateResult {
  instanceId: string
  masterTaskId: string
  date: string
  oldStatus: ChecklistInstanceStatus
  newStatus: ChecklistInstanceStatus
  updated: boolean
  reason: string
  error?: string
}

/**
 * Overall status update result
 */
export interface StatusUpdateResult {
  date: string
  totalInstances: number
  instancesUpdated: number
  instancesSkipped: number
  errors: number
  results: InstanceStatusUpdateResult[]
  executionTime: number
  testMode: boolean
  dryRun: boolean
}

/**
 * Bulk status update options
 */
export interface BulkStatusUpdateOptions {
  startDate: string
  endDate: string
  testMode?: boolean
  dryRun?: boolean
  maxInstancesPerDay?: number
  logLevel?: 'silent' | 'info' | 'debug'
}

/**
 * Bulk status update result
 */
export interface BulkStatusUpdateResult {
  startDate: string
  endDate: string
  totalDays: number
  successfulDays: number
  failedDays: number
  totalInstancesUpdated: number
  totalErrors: number
  dailyResults: Array<{
    date: string
    result: StatusUpdateResult
  }>
  executionTime: number
}

// ========================================
// STATUS TRANSITION RULES
// ========================================

/**
 * Default status transition rules
 */
export const DEFAULT_STATUS_TRANSITIONS: StatusTransitionRule[] = [
  {
    fromStatus: 'pending',
    toStatus: 'overdue',
    condition: 'time_based',
    description: 'Task becomes overdue at due_time'
  },
  {
    fromStatus: 'overdue',
    toStatus: 'missed',
    condition: 'date_based',
    description: 'Overdue task becomes missed at 23:59 or Saturday cutoff'
  },
  {
    fromStatus: 'pending',
    toStatus: 'missed',
    condition: 'date_based',
    description: 'Pending task becomes missed at 23:59 or Saturday cutoff'
  },
  {
    fromStatus: 'in_progress',
    toStatus: 'overdue',
    condition: 'time_based',
    description: 'In-progress task becomes overdue at due_time'
  },
  {
    fromStatus: 'in_progress',
    toStatus: 'missed',
    condition: 'date_based',
    description: 'In-progress task becomes missed at 23:59 or Saturday cutoff'
  }
]

// ========================================
// STATUS MANAGER CLASS
// ========================================

/**
 * Main status manager class
 * Handles status transitions and lifecycle management
 */
export class StatusManager {
  private transitionRules: StatusTransitionRule[]
  private logLevel: 'silent' | 'info' | 'debug'

  constructor(
    transitionRules: StatusTransitionRule[] = DEFAULT_STATUS_TRANSITIONS,
    logLevel: 'silent' | 'info' | 'debug' = 'info'
  ) {
    this.transitionRules = transitionRules
    this.logLevel = logLevel
  }

  /**
   * Update statuses for a specific date
   * 
   * @param options - Status update options
   * @returns Promise<StatusUpdateResult>
   */
  async updateStatusesForDate(options: StatusUpdateOptions = {}): Promise<StatusUpdateResult> {
    const startTime = Date.now()
    const { 
      date = new Date().toISOString().split('T')[0],
      forceUpdate = false,
      dryRun = false,
      testMode = false,
      maxInstances
    } = options

    this.log('info', `Starting status update for date: ${date}`)
    this.log('info', `Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}, Force: ${forceUpdate}`)

    try {
      // Step 1: Get all instances for the date
      const { data: instances, error: fetchError } = await supabase
        .from('checklist_instances')
        .select(`
          *,
          master_tasks (
            id,
            title,
            due_time,
            timing,
            frequency_rules
          )
        `)
        .eq('date', date)
        .order('created_at', { ascending: true })

      if (fetchError) {
        throw new Error(`Failed to fetch instances: ${fetchError.message}`)
      }

      if (!instances || instances.length === 0) {
        this.log('info', 'No instances found for this date')
        return this.createEmptyStatusResult(date, testMode, dryRun, startTime)
      }

      // Apply max instances limit if specified
      const instancesToProcess = maxInstances ? instances.slice(0, maxInstances) : instances
      this.log('info', `Processing ${instancesToProcess.length} instances`)

      // Step 2: Process each instance
      const results: InstanceStatusUpdateResult[] = []
      let instancesUpdated = 0
      let instancesSkipped = 0
      let errors = 0

      for (const instance of instancesToProcess) {
        try {
          const result = await this.processSingleInstance(instance, date, forceUpdate, dryRun, testMode)
          results.push(result)

          if (result.updated) {
            instancesUpdated++
          } else if (result.oldStatus === result.newStatus) {
            instancesSkipped++
          }

          if (result.error) {
            errors++
          }
        } catch (error) {
          const errorResult: InstanceStatusUpdateResult = {
            instanceId: instance.id,
            masterTaskId: instance.master_task_id,
            date: instance.date,
            oldStatus: instance.status,
            newStatus: instance.status,
            updated: false,
            reason: 'Error processing instance',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
          results.push(errorResult)
          errors++
        }
      }

      const executionTime = Date.now() - startTime

      const finalResult: StatusUpdateResult = {
        date,
        totalInstances: instancesToProcess.length,
        instancesUpdated,
        instancesSkipped,
        errors,
        results,
        executionTime,
        testMode,
        dryRun
      }

      this.log('info', `Status update completed in ${executionTime}ms`)
      this.log('info', `Results: ${instancesUpdated} updated, ${instancesSkipped} skipped, ${errors} errors`)

      return finalResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.log('info', `Status update failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      return {
        date,
        totalInstances: 0,
        instancesUpdated: 0,
        instancesSkipped: 0,
        errors: 1,
        results: [{
          instanceId: 'error',
          masterTaskId: 'error',
          date,
          oldStatus: 'pending',
          newStatus: 'pending',
          updated: false,
          reason: 'Status update error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        executionTime,
        testMode,
        dryRun
      }
    }
  }

  /**
   * Update statuses for a date range
   * 
   * @param options - Bulk status update options
   * @returns Promise<BulkStatusUpdateResult>
   */
  async updateStatusesForDateRange(options: BulkStatusUpdateOptions): Promise<BulkStatusUpdateResult> {
    const startTime = Date.now()
    const { startDate, endDate, testMode = false, dryRun = false, maxInstancesPerDay } = options

    this.log('info', `Starting bulk status update from ${startDate} to ${endDate}`)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const dailyResults: Array<{ date: string; result: StatusUpdateResult }> = []
    let successfulDays = 0
    let failedDays = 0
    let totalInstancesUpdated = 0
    let totalErrors = 0

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start)
      currentDate.setDate(start.getDate() + i)
      const dateString = currentDate.toISOString().split('T')[0]

      try {
        const result = await this.updateStatusesForDate({
          date: dateString,
          dryRun,
          testMode,
          maxInstances: maxInstancesPerDay,
          logLevel: this.logLevel
        })

        dailyResults.push({ date: dateString, result })
        totalInstancesUpdated += result.instancesUpdated
        totalErrors += result.errors

        if (result.errors === 0) {
          successfulDays++
        } else {
          failedDays++
        }

        this.log('info', `Completed ${dateString}: ${result.instancesUpdated} updated, ${result.errors} errors`)
      } catch (error) {
        failedDays++
        totalErrors++
        this.log('info', `Failed to update statuses for ${dateString}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        dailyResults.push({
          date: dateString,
          result: {
            date: dateString,
            totalInstances: 0,
            instancesUpdated: 0,
            instancesSkipped: 0,
            errors: 1,
            results: [{
              instanceId: 'error',
              masterTaskId: 'error',
              date: dateString,
              oldStatus: 'pending',
              newStatus: 'pending',
              updated: false,
              reason: 'Status update error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }],
            executionTime: 0,
            testMode,
            dryRun
          }
        })
      }
    }

    const executionTime = Date.now() - startTime

    const bulkResult: BulkStatusUpdateResult = {
      startDate,
      endDate,
      totalDays,
      successfulDays,
      failedDays,
      totalInstancesUpdated,
      totalErrors,
      dailyResults,
      executionTime
    }

    this.log('info', `Bulk status update completed in ${executionTime}ms`)
    this.log('info', `Summary: ${successfulDays}/${totalDays} days successful, ${totalInstancesUpdated} total updates, ${totalErrors} total errors`)

    return bulkResult
  }

  /**
   * Process a single instance to determine status updates
   */
  private async processSingleInstance(
    instance: any, // Instance with master_tasks relation
    date: string,
    forceUpdate: boolean,
    dryRun: boolean,
    testMode: boolean
  ): Promise<InstanceStatusUpdateResult> {
    try {
      const currentStatus = instance.status
      const masterTask = instance.master_tasks
      
      if (!masterTask) {
        return {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: currentStatus,
          newStatus: currentStatus,
          updated: false,
          reason: 'No master task information available'
        }
      }

      // Determine what the status should be
      const targetStatus = this.calculateTargetStatus(instance, masterTask, date)
      
      if (currentStatus === targetStatus && !forceUpdate) {
        return {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          updated: false,
          reason: 'Status already correct'
        }
      }

      // Check if status transition is allowed
      const canTransition = this.canTransitionStatus(currentStatus, targetStatus)
      if (!canTransition && !forceUpdate) {
        return {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          updated: false,
          reason: `Status transition not allowed: ${currentStatus} -> ${targetStatus}`
        }
      }

      // Update the status
      if (dryRun) {
        return {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          updated: false,
          reason: 'Dry run mode - would update status'
        }
      }

      if (testMode) {
        return {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          updated: false,
          reason: 'Test mode - would update status'
        }
      }

      // Actually update the status
      const { error: updateError } = await supabase
        .from('checklist_instances')
        .update({ 
          status: targetStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)

      if (updateError) {
        throw new Error(`Failed to update status: ${updateError.message}`)
      }

      return {
        instanceId: instance.id,
        masterTaskId: instance.master_task_id,
        date: instance.date,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        updated: true,
        reason: `Status updated from ${currentStatus} to ${targetStatus}`
      }

    } catch (error) {
      return {
        instanceId: instance.id,
        masterTaskId: instance.master_task_id,
        date: instance.date,
        oldStatus: instance.status,
        newStatus: instance.status,
        updated: false,
        reason: 'Error processing instance',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Calculate what the target status should be for an instance
   */
  private calculateTargetStatus(instance: any, masterTask: any, date: string): ChecklistInstanceStatus {
    const currentStatus = instance.status
    const dueTime = masterTask.due_time
    const timing = masterTask.timing
    const frequencyRules = masterTask.frequency_rules

    // If already completed, don't change
    if (currentStatus === 'completed') {
      return 'completed'
    }

    const now = new Date()
    const instanceDate = new Date(date)
    const isToday = this.isSameDate(now, instanceDate)
    const isPastDate = instanceDate < now

    // Handle overdue logic
    if (isToday && dueTime && currentStatus !== 'completed') {
      const dueDateTime = new Date(`${date}T${dueTime}`)
      if (now > dueDateTime) {
        return 'overdue'
      }
    }

    // Handle missed logic
    if (isPastDate && currentStatus !== 'completed') {
      const cutoffTime = this.calculateCutoffTime(instanceDate, frequencyRules)
      if (now > cutoffTime) {
        return 'missed'
      }
    }

    // If past due time on a past date, mark as missed
    if (isPastDate && dueTime && currentStatus !== 'completed') {
      const dueDateTime = new Date(`${date}T${dueTime}`)
      if (now > dueDateTime) {
        return 'missed'
      }
    }

    // Default: keep current status
    return currentStatus
  }

  /**
   * Calculate the cutoff time for missed status
   * Week/month rules have Saturday cutoff, others use 23:59
   */
  private calculateCutoffTime(instanceDate: Date, frequencyRules: any): Date {
    const cutoffDate = new Date(instanceDate)
    
    // Check if this is a week/month frequency rule
    const isWeekMonthRule = frequencyRules && (
      frequencyRules.type === 'weekly' ||
      frequencyRules.type === 'specific_weekdays' ||
      frequencyRules.type === 'start_of_month' ||
      frequencyRules.type === 'end_of_month' ||
      frequencyRules.type === 'every_month'
    )

    if (isWeekMonthRule) {
      // For week/month rules, cutoff is Saturday 23:59
      const dayOfWeek = cutoffDate.getDay()
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
      cutoffDate.setDate(cutoffDate.getDate() + daysUntilSaturday)
      cutoffDate.setHours(23, 59, 59, 999)
    } else {
      // For daily rules, cutoff is same day 23:59
      cutoffDate.setHours(23, 59, 59, 999)
    }

    return cutoffDate
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  /**
   * Check if a status transition is allowed
   */
  private canTransitionStatus(fromStatus: ChecklistInstanceStatus, toStatus: ChecklistInstanceStatus): boolean {
    // Find applicable transition rule
    const rule = this.transitionRules.find(r => 
      r.fromStatus === fromStatus && r.toStatus === toStatus
    )

    return !!rule
  }

  /**
   * Create an empty result for cases with no instances
   */
  private createEmptyStatusResult(
    date: string,
    testMode: boolean,
    dryRun: boolean,
    startTime: number
  ): StatusUpdateResult {
    const executionTime = Date.now() - startTime
    
    return {
      date,
      totalInstances: 0,
      instancesUpdated: 0,
      instancesSkipped: 0,
      errors: 0,
      results: [],
      executionTime,
      testMode,
      dryRun
    }
  }

  /**
   * Log messages based on log level
   */
  private log(level: 'silent' | 'info' | 'debug', message: string): void {
    if (this.logLevel === 'silent') return
    
    if (level === 'debug' && this.logLevel !== 'debug') return
    
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
  }

  /**
   * Set the log level
   */
  setLogLevel(level: 'silent' | 'info' | 'debug'): void {
    this.logLevel = level
  }

  /**
   * Get the current transition rules
   */
  getTransitionRules(): StatusTransitionRule[] {
    return [...this.transitionRules]
  }

  /**
   * Add a new transition rule
   */
  addTransitionRule(rule: StatusTransitionRule): void {
    this.transitionRules.push(rule)
  }

  /**
   * Remove a transition rule
   */
  removeTransitionRule(fromStatus: ChecklistInstanceStatus, toStatus: ChecklistInstanceStatus): void {
    this.transitionRules = this.transitionRules.filter(r => 
      !(r.fromStatus === fromStatus && r.toStatus === toStatus)
    )
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Create a status manager with default configuration
 */
export function createStatusManager(
  transitionRules: StatusTransitionRule[] = DEFAULT_STATUS_TRANSITIONS,
  logLevel: 'silent' | 'info' | 'debug' = 'info'
): StatusManager {
  return new StatusManager(transitionRules, logLevel)
}

/**
 * Create a status manager with test mode enabled
 */
export function createTestStatusManager(
  transitionRules: StatusTransitionRule[] = DEFAULT_STATUS_TRANSITIONS
): StatusManager {
  return new StatusManager(transitionRules, 'debug')
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Update statuses for today
 */
export async function updateStatusesForToday(
  options: Partial<StatusUpdateOptions> = {}
): Promise<StatusUpdateResult> {
  const manager = createStatusManager()
  return manager.updateStatusesForDate({
    date: new Date().toISOString().split('T')[0],
    ...options
  })
}

/**
 * Update statuses for yesterday
 */
export async function updateStatusesForYesterday(
  options: Partial<StatusUpdateOptions> = {}
): Promise<StatusUpdateResult> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateString = yesterday.toISOString().split('T')[0]
  
  const manager = createStatusManager()
  return manager.updateStatusesForDate({
    date: dateString,
    ...options
  })
}

// ========================================
// EXPORTS
// ========================================

export type {
  StatusTransitionRule,
  StatusUpdateOptions,
  StatusUpdateResult,
  InstanceStatusUpdateResult,
  BulkStatusUpdateOptions,
  BulkStatusUpdateResult
}