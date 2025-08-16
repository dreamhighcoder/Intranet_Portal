/**
 * Status Manager for Task Instances
 * Handles automatic status updates based on time and business rules
 */

import { supabase } from './supabase'
import type { TaskInstance, MasterTask } from './supabase'

export interface StatusUpdateResult {
  success: boolean
  updated: number
  errors: number
  message: string
  details: {
    toDueToday: number
    toOverdue: number
    toMissed: number
    locked: number
  }
}

/**
 * Status Manager class for handling task status transitions
 */
export class StatusManager {
  
  /**
   * Update all task statuses based on current time
   */
  async updateAllStatuses(): Promise<StatusUpdateResult> {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

    const result: StatusUpdateResult = {
      success: true,
      updated: 0,
      errors: 0,
      message: '',
      details: {
        toDueToday: 0,
        toOverdue: 0,
        toMissed: 0,
        locked: 0
      }
    }

    try {
      // 1. Update not_due to due_today
      const dueTodayResult = await this.updateNotDueToDueToday(today, currentTime)
      result.details.toDueToday = dueTodayResult.updated
      result.updated += dueTodayResult.updated

      // 2. Update due_today to overdue
      const overdueResult = await this.updateDueTodayToOverdue(today, currentTime)
      result.details.toOverdue = overdueResult.updated
      result.updated += overdueResult.updated

      // 3. Update overdue to missed and lock
      const missedResult = await this.updateOverdueToMissed(today)
      result.details.toMissed = missedResult.updated
      result.details.locked = missedResult.locked
      result.updated += missedResult.updated

      result.message = `Updated ${result.updated} task statuses: ${result.details.toDueToday} to due_today, ${result.details.toOverdue} to overdue, ${result.details.toMissed} to missed`

    } catch (error) {
      console.error('Error updating statuses:', error)
      result.success = false
      result.errors = 1
      result.message = `Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return result
  }

  /**
   * Update tasks from not_due to due_today when their due time arrives
   */
  private async updateNotDueToDueToday(today: string, currentTime: string): Promise<{ updated: number }> {
    const { data, error } = await supabase
      .from('task_instances')
      .update({ 
        status: 'due_today',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'not_due')
      .eq('due_date', today)
      .lte('due_time', currentTime)
      .select('id')

    if (error) {
      console.error('Error updating not_due to due_today:', error)
      throw error
    }

    return { updated: data?.length || 0 }
  }

  /**
   * Update tasks from due_today to overdue based on frequency-specific cutoffs
   */
  private async updateDueTodayToOverdue(today: string, currentTime: string): Promise<{ updated: number }> {
    // Get due_today tasks with their master task info for cutoff rules
    const { data: dueTodayTasks, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        id,
        due_date,
        due_time,
        master_tasks!inner (
          frequency,
          allow_edit_when_locked
        )
      `)
      .eq('status', 'due_today')

    if (fetchError) {
      console.error('Error fetching due_today tasks:', fetchError)
      throw fetchError
    }

    if (!dueTodayTasks || dueTodayTasks.length === 0) {
      return { updated: 0 }
    }

    const tasksToUpdate: string[] = []

    for (const task of dueTodayTasks) {
      const frequency = task.master_tasks.frequency
      
      // Determine if task should be overdue based on frequency-specific rules
      if (this.shouldBeOverdue(task, today, currentTime, frequency)) {
        tasksToUpdate.push(task.id)
      }
    }

    if (tasksToUpdate.length === 0) {
      return { updated: 0 }
    }

    // Update tasks to overdue
    const { data, error } = await supabase
      .from('task_instances')
      .update({ 
        status: 'overdue',
        updated_at: new Date().toISOString()
      })
      .in('id', tasksToUpdate)
      .select('id')

    if (error) {
      console.error('Error updating due_today to overdue:', error)
      throw error
    }

    return { updated: data?.length || 0 }
  }

  /**
   * Update overdue tasks to missed and apply locking based on business rules
   */
  private async updateOverdueToMissed(today: string): Promise<{ updated: number; locked: number }> {
    // Get overdue tasks that should be moved to missed
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        id,
        due_date,
        master_tasks!inner (
          frequency,
          allow_edit_when_locked,
          sticky_once_off
        )
      `)
      .eq('status', 'overdue')
      .lt('due_date', today) // Past due date

    if (fetchError) {
      console.error('Error fetching overdue tasks:', fetchError)
      throw fetchError
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return { updated: 0, locked: 0 }
    }

    const tasksToUpdate: { id: string; shouldLock: boolean }[] = []

    for (const task of overdueTasks) {
      const shouldLock = this.shouldLockTask(task.master_tasks)
      tasksToUpdate.push({ id: task.id, shouldLock })
    }

    if (tasksToUpdate.length === 0) {
      return { updated: 0, locked: 0 }
    }

    // Update all to missed first
    const { data, error } = await supabase
      .from('task_instances')
      .update({ 
        status: 'missed',
        updated_at: new Date().toISOString()
      })
      .in('id', tasksToUpdate.map(t => t.id))
      .select('id')

    if (error) {
      console.error('Error updating overdue to missed:', error)
      throw error
    }

    // Then lock the ones that should be locked
    const tasksToLock = tasksToUpdate.filter(t => t.shouldLock).map(t => t.id)
    let locked = 0

    if (tasksToLock.length > 0) {
      const { data: lockData, error: lockError } = await supabase
        .from('task_instances')
        .update({ 
          locked: true,
          updated_at: new Date().toISOString()
        })
        .in('id', tasksToLock)
        .select('id')

      if (lockError) {
        console.error('Error locking missed tasks:', lockError)
      } else {
        locked = lockData?.length || 0
      }
    }

    return { updated: data?.length || 0, locked }
  }

  /**
   * Determine if a due_today task should be moved to overdue
   */
  private shouldBeOverdue(
    task: any,
    today: string,
    currentTime: string,
    frequency: string
  ): boolean {
    const dueDate = task.due_date
    const dueTime = task.due_time

    // If task is from a previous date, it's definitely overdue
    if (dueDate < today) {
      return true
    }

    // If task is for today, check time-based cutoffs
    if (dueDate === today) {
      switch (frequency) {
        case 'every_day':
        case 'weekly':
          // Due date 23:59
          return currentTime >= '23:59'

        case 'specific_weekdays':
          // Saturday 23:59 (adjusted for PH)
          const dayOfWeek = new Date(today).getDay()
          return dayOfWeek === 6 && currentTime >= '23:59' // Saturday

        case 'start_every_month':
        case 'start_certain_months':
        case 'every_month':
        case 'certain_months':
        case 'end_every_month':
        case 'end_certain_months':
          // Last Saturday 23:59 (adjusted for PH)
          return this.isLastSaturday(today) && currentTime >= '23:59'

        case 'once_off_sticky':
          // Never auto-overdue for sticky tasks
          return false

        default:
          // Default to due time + 1 hour grace period
          const gracePeriodTime = this.addHours(dueTime, 1)
          return currentTime >= gracePeriodTime
      }
    }

    return false
  }

  /**
   * Determine if a task should be locked when moved to missed
   */
  private shouldLockTask(masterTask: any): boolean {
    // Don't lock if allow_edit_when_locked is true
    if (masterTask.allow_edit_when_locked) {
      return false
    }

    // Don't lock once-off sticky tasks
    if (masterTask.sticky_once_off) {
      return false
    }

    // Lock all other missed tasks
    return true
  }

  /**
   * Check if a date is the last Saturday of its month
   */
  private isLastSaturday(dateStr: string): boolean {
    const date = new Date(dateStr)
    const dayOfWeek = date.getDay()
    
    if (dayOfWeek !== 6) return false // Not Saturday
    
    // Check if adding 7 days goes to next month
    const nextWeek = new Date(date)
    nextWeek.setDate(date.getDate() + 7)
    
    return nextWeek.getMonth() !== date.getMonth()
  }

  /**
   * Add hours to a time string (HH:MM format)
   */
  private addHours(timeStr: string, hours: number): string {
    const [hour, minute] = timeStr.split(':').map(Number)
    const totalMinutes = hour * 60 + minute + hours * 60
    const newHour = Math.floor(totalMinutes / 60) % 24
    const newMinute = totalMinutes % 60
    
    return `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`
  }

  /**
   * Force update a specific task instance status (for manual overrides)
   */
  async updateTaskStatus(
    taskInstanceId: string,
    newStatus: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done',
    userId?: string
  ): Promise<boolean> {
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Add completion info for done status
    if (newStatus === 'done') {
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = userId || null
    } else if (newStatus !== 'done') {
      // Clear completion info for non-done statuses
      updateData.completed_at = null
      updateData.completed_by = null
    }

    const { error } = await supabase
      .from('task_instances')
      .update(updateData)
      .eq('id', taskInstanceId)

    if (error) {
      console.error('Error updating task status:', error)
      return false
    }

    // Add audit log entry
    await this.addAuditEntry(taskInstanceId, `status_changed_to_${newStatus}`, userId)

    return true
  }

  /**
   * Add audit log entry
   */
  private async addAuditEntry(
    taskInstanceId: string,
    action: string,
    userId?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('audit_log')
      .insert({
        task_instance_id: taskInstanceId,
        action,
        actor: userId || null,
        meta: { timestamp: new Date().toISOString() },
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error adding audit entry:', error)
    }
  }

  /**
   * Get status update statistics
   */
  async getStatusStats(): Promise<{
    statusCounts: Record<string, number>
    lockedCount: number
    overdueCount: number
    missedCount: number
  }> {
    const { data: statusData } = await supabase
      .from('task_instances')
      .select('status, locked')

    const statusCounts: Record<string, number> = {}
    let lockedCount = 0
    let overdueCount = 0
    let missedCount = 0

    statusData?.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
      if (item.locked) lockedCount++
      if (item.status === 'overdue') overdueCount++
      if (item.status === 'missed') missedCount++
    })

    return {
      statusCounts,
      lockedCount,
      overdueCount,
      missedCount
    }
  }
}

/**
 * Convenience function to update all statuses
 */
export async function updateTaskStatuses(): Promise<StatusUpdateResult> {
  const statusManager = new StatusManager()
  return await statusManager.updateAllStatuses()
}

/**
 * Convenience function to update a specific task status
 */
export async function updateSpecificTaskStatus(
  taskInstanceId: string,
  newStatus: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done',
  userId?: string
): Promise<boolean> {
  const statusManager = new StatusManager()
  return await statusManager.updateTaskStatus(taskInstanceId, newStatus, userId)
}

/**
 * Status update job - call this from a cron job every 15-30 minutes
 */
export async function runStatusUpdateJob(): Promise<StatusUpdateResult> {
  const result = await updateTaskStatuses()
  return result
}