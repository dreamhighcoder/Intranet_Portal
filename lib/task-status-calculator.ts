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
  due_date?: string // The actual due date for the instance (e.g., Saturday for weekly)
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
    // 1) Hard precedence: completion
    // For position-specific completion, only check is_completed_for_position
    // The main task status (completed/done) is set when ANY position completes it,
    // but we need position-specific completion status for shared tasks
    if (task.is_completed_for_position) return 'completed'

    const now = getAustralianNow()
    const todayStr = currentDate || getAustralianToday()
    const today = parseAustralianDate(todayStr)

    // Helper: normalize HH:mm[:ss] to HH:mm
    const normalizeTime = (t?: string): string | null => {
      if (!t) return null
      return t.includes(':') ? t.substring(0, 5) : t
    }

    const dueDateStr = task.due_date || null
    const dueTimeStr = normalizeTime(task?.master_task?.due_time) || '17:00'
    const lockDateStr = task.lock_date || null
    const lockTimeStr = normalizeTime(task.lock_time || undefined)

    // 2) Lock deadline → Missed
    if (lockDateStr && lockTimeStr) {
      const lockDate = parseAustralianDate(lockDateStr)
      const lockDateTime = createAustralianDateTime(lockDateStr, lockTimeStr)
      if (now >= lockDateTime) return 'missed'
    }

    // 3) If backend provided a detailed_status, prefer it as baseline,
    //    but refine using due/lock when we have explicit dates/times.
    if (task.detailed_status) {
      // If explicit due_date exists, compute precise state for today/relative to due
      if (dueDateStr) {
        const dueDate = parseAustralianDate(dueDateStr)

        if (today.getTime() < dueDate.getTime()) {
          return 'not_due_yet'
        }

        if (today.getTime() === dueDate.getTime()) {
          const dueDateTime = createAustralianDateTime(dueDateStr, dueTimeStr)
          return now < dueDateTime ? 'due_today' : 'overdue'
        }

        // today > dueDate
        return 'overdue'
      }

      // No explicit due_date → trust backend detailed_status
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
          break
      }
    }

    // 4) No detailed_status or could not determine from it → use explicit due/lock if provided
    if (dueDateStr) {
      const dueDate = parseAustralianDate(dueDateStr)

      if (today.getTime() < dueDate.getTime()) {
        return 'not_due_yet'
      }

      if (today.getTime() === dueDate.getTime()) {
        const dueDateTime = createAustralianDateTime(dueDateStr, dueTimeStr)

        // If we also have lock window today, check Missed after lock
        if (lockDateStr) {
          const lockDate = parseAustralianDate(lockDateStr)
          if (lockDate.getTime() === today.getTime() && lockTimeStr) {
            const lockDateTime = createAustralianDateTime(lockDateStr, lockTimeStr)
            if (now >= lockDateTime) return 'missed'
          }
        }

        return now < dueDateTime ? 'due_today' : 'overdue'
      }

      // today > dueDate
      // If lock deadline exists in the future, it's still overdue until lock time passes
      return 'overdue'
    }

    // 5) Fallback visibility and instance-based heuristics (no due_date provided)
    //    Do NOT assume instance date == due date (prevents false "due_today").
    //    Only enforce visibility window.
    const viewDate = parseAustralianDate(todayStr)
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
    } catch {}

    if (visibilityStart && viewDate < visibilityStart) return 'not_visible'
    if (visibilityEnd && viewDate > visibilityEnd) return 'not_visible'

    // Without explicit due_date info, be conservative: rely on backend or mark as pending
    return 'pending'
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