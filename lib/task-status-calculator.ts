/**
 * Shared Task Status Calculator
 * Used by both the main checklist page and homepage counts API
 * to ensure consistent status calculation across the application
 */

import { 
  getAustralianNow, 
  getAustralianToday, 
  createAustralianDateTime, 
  parseAustralianDate 
} from './timezone-utils'

export interface TaskStatusInput {
  date: string // Task instance date (YYYY-MM-DD)
  master_task?: {
    due_time?: string // HH:mm:ss or HH:mm format
    created_at?: string
    publish_delay?: string
    start_date?: string
    end_date?: string
  }
  detailed_status?: string // Backend provided status
  is_completed_for_position?: boolean
  status?: string
  lock_date?: string
  lock_time?: string
}

export type TaskStatus = 
  | 'completed'
  | 'not_due_yet' 
  | 'due_today'
  | 'overdue'
  | 'missed'
  | 'not_visible'
  | 'pending'

/**
 * Calculate the dynamic status of a task based on current time and task properties
 * This is the single source of truth for task status calculation
 */
export function calculateTaskStatus(task: TaskStatusInput, currentDate?: string): TaskStatus {
  try {
    // Completed takes precedence
    if (task.is_completed_for_position || task.status === 'completed') {
      return 'completed'
    }

    // For time-sensitive status calculation, we need to check if this task is due today
    // and override backend status if necessary for proper time comparison
    const now = getAustralianNow()
    const todayStr = currentDate || getAustralianToday()
    const today = parseAustralianDate(todayStr)
    const instanceDate = parseAustralianDate(task.date)
    const viewDate = parseAustralianDate(todayStr)
    
    // Check if this task is due today (task.date equals today)
    const isTaskDueToday = instanceDate.getTime() === today.getTime()
    
    // If task is due today, we need to do time-based status calculation
    if (isTaskDueToday) {
      const dueTimeStr = task?.master_task?.due_time || '17:00'
      // Handle time format - convert "HH:mm:ss" to "HH:mm" if needed
      const timeFormatted = dueTimeStr.includes(':') ? dueTimeStr.substring(0, 5) : dueTimeStr
      const dueDateTime = createAustralianDateTime(todayStr, timeFormatted)
      
      // Check if we have lock time information
      const lockDate = task.lock_date ? parseAustralianDate(task.lock_date) : null
      const lockTime = task.lock_time
      
      // Check lock time first (missed status)
      if (lockDate && lockTime && lockDate.getTime() === today.getTime()) {
        const lockDateTime = createAustralianDateTime(todayStr, lockTime)
        if (now >= lockDateTime) return 'missed'
      }
      
      // Time-based status for tasks due today
      if (now >= dueDateTime) {
        return 'overdue'
      } else {
        return 'due_today'
      }
    }

    // Use backend's detailed status if available (for non-today tasks or as fallback)
    if (task.detailed_status) {
      switch (task.detailed_status) {
        case 'completed':
          return 'completed'
        case 'not_due_yet':
          return 'not_due_yet'
        case 'due_today':
          return 'due_today'
        case 'overdue':
          return 'overdue'
        case 'missed':
          return 'missed'
        default:
          return 'pending'
      }
    }

    // Fallback: Calculate status using frontend logic
    const isViewingToday = viewDate.getTime() === today.getTime()

    // Check visibility window (never show before creation/publish/start; hide after end)
    let visibilityStart: Date | null = null
    let visibilityEnd: Date | null = null
    
    try {
      const createdAtIso = task?.master_task?.created_at
      const publishDelay = task?.master_task?.publish_delay // YYYY-MM-DD
      const startDate = task?.master_task?.start_date // YYYY-MM-DD
      const endDate = task?.master_task?.end_date // YYYY-MM-DD

      const dates: Date[] = []
      if (createdAtIso) {
        const createdAtAU = parseAustralianDate(createdAtIso.split('T')[0])
        dates.push(createdAtAU)
      }
      if (publishDelay) dates.push(parseAustralianDate(publishDelay))
      if (startDate) dates.push(parseAustralianDate(startDate))
      if (dates.length > 0) visibilityStart = new Date(Math.max(...dates.map(d => d.getTime())))
      if (endDate) visibilityEnd = parseAustralianDate(endDate)
    } catch { }

    if (visibilityStart && viewDate < visibilityStart) return 'not_visible'
    if (visibilityEnd && viewDate > visibilityEnd) return 'not_visible'

    // Default status calculation
    if (instanceDate > today) {
      return 'not_due_yet'
    } else if (instanceDate.getTime() === today.getTime()) {
      return 'due_today'
    } else {
      return 'overdue'
    }

  } catch (error) {
    console.error('Error calculating task status:', error)
    return 'pending'
  }
}

/**
 * Simplified status calculation for counts API
 * Returns basic status categories for counting purposes
 */
export function calculateTaskStatusForCounts(
  task: TaskStatusInput, 
  currentDate?: string
): 'completed' | 'due_today' | 'overdue' | 'missed' | 'not_due_yet' {
  const status = calculateTaskStatus(task, currentDate)
  
  // Map complex statuses to simple count categories
  switch (status) {
    case 'completed':
      return 'completed'
    case 'due_today':
      return 'due_today'
    case 'overdue':
      return 'overdue'
    case 'missed':
      return 'missed'
    case 'not_due_yet':
    case 'not_visible':
    case 'pending':
    default:
      return 'not_due_yet'
  }
}