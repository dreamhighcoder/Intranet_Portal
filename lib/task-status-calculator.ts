/**
 * Shared Task Status Calculator
 * Used by both the main checklist page and homepage counts API
 * to ensure consistent status calculation across the application
 */

import { 
  getAustralianNow, 
  getAustralianToday, 
  createAustralianDateTime, 
  parseAustralianDate,
  formatAustralianDate
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
    frequencies?: string[] // Task frequencies for carry-over period calculation
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

// Shared UI holiday set for PH-aware business day checks
let UI_HOLIDAY_SET = new Set<string>()

// Function to set holidays from external source
export function setHolidays(holidays: Set<string>) {
  UI_HOLIDAY_SET = holidays
}

// Helper function to check if a date is a business day
const isBusinessDay = (d: Date): boolean => {
  const day = d.getDay()
  // Sunday is 0, Saturday is 6
  if (day === 0) return false // Sunday is not a business day
  // Treat Monday-Saturday as working days unless it is a public holiday
  const dateStr = formatAustralianDate(d)
  return !UI_HOLIDAY_SET.has(dateStr)
}

// Helper functions for date calculations
const getWeekMonday = (d: Date): Date => {
  const result = new Date(d)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  return result
}

const getWeekSaturday = (d: Date): Date => {
  const result = new Date(d)
  const day = result.getDay()
  const diff = 6 - (day === 0 ? 7 : day)
  result.setDate(result.getDate() + diff)
  return result
}

const getLastSaturdayOfMonth = (d: Date): Date => {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const day = lastDay.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? 1 : (7 - day + 6) % 7
  const lastSaturday = new Date(lastDay)
  lastSaturday.setDate(lastDay.getDate() - diff)
  return lastSaturday
}

/**
 * Calculate the carry-over period for a task based on its frequency
 * Returns the lock date and time after which completion badges should not be shown
 */
const getFrequencyCarryOverPeriod = (
  task: TaskStatusInput, 
  instanceDate: Date
): { lockDate: Date | null; lockTime: string | null } => {
  const frequencies = task.master_task?.frequencies || []
  
  // If no frequencies, use the provided lock_date/lock_time
  if (frequencies.length === 0) {
    if (task.lock_date && task.lock_time) {
      return {
        lockDate: parseAustralianDate(task.lock_date),
        lockTime: task.lock_time
      }
    }
    return { lockDate: null, lockTime: null }
  }

  // For tasks with multiple frequencies, use the most restrictive (earliest) lock time
  let earliestLockDate: Date | null = null
  let lockTime = '23:59' // Default lock time

  for (const frequency of frequencies) {
    const cutoffs = getFrequencyLockCutoffs(frequency, instanceDate)
    if (cutoffs.lockDate) {
      if (!earliestLockDate || cutoffs.lockDate < earliestLockDate) {
        earliestLockDate = cutoffs.lockDate
        lockTime = cutoffs.lockTime || '23:59'
      }
    }
  }

  return { lockDate: earliestLockDate, lockTime }
}

/**
 * Get lock cutoffs for a specific frequency
 */
const getFrequencyLockCutoffs = (
  frequency: string, 
  instanceDate: Date
): { lockDate: Date | null; lockTime: string | null } => {
  
  switch (frequency) {
    case 'once_off':
    case 'once_off_sticky': {
      // Once-off tasks never auto-lock (keep appearing indefinitely until Done)
      return { lockDate: null, lockTime: null }
    }

    case 'every_day': {
      // Every day tasks lock at 23:59 on the same day
      return {
        lockDate: instanceDate,
        lockTime: '23:59'
      }
    }

    case 'once_weekly': {
      // Weekly tasks lock at 23:59 on Saturday of the same week
      const weekSat = getWeekSaturday(instanceDate)
      
      // Adjust for business days
      let lockDate = new Date(weekSat)
      const weekMon = getWeekMonday(instanceDate)
      while (!isBusinessDay(lockDate) && lockDate >= weekMon) {
        lockDate.setDate(lockDate.getDate() - 1)
      }

      return {
        lockDate,
        lockTime: '23:59'
      }
    }

    case 'monday':
    case 'tuesday':
    case 'wednesday':
    case 'thursday':
    case 'friday':
    case 'saturday': {
      // Specific weekday tasks lock at 23:59 on Saturday of that week
      const weekMon = getWeekMonday(instanceDate)
      const weekSat = getWeekSaturday(instanceDate)
      
      // Lock date: Saturday of the same week (or earlier if Saturday is holiday)
      let lockDate = new Date(weekSat)
      while (!isBusinessDay(lockDate) && lockDate >= weekMon) {
        lockDate.setDate(lockDate.getDate() - 1)
      }

      return {
        lockDate,
        lockTime: '23:59'
      }
    }

    case 'start_of_every_month':
    case 'start_every_month':
    case 'start_of_month':
    case 'start_certain_months':
    case 'every_month':
    case 'certain_months':
    case 'once_monthly':
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
    case 'end_of_every_month':
    case 'end_of_month':
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
    case 'end_of_month_dec': {
      // Monthly tasks lock at 23:59 on the last Saturday of the month
      let lockDate = getLastSaturdayOfMonth(instanceDate)
      
      // Adjust for business days
      const monthStart = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
      while (!isBusinessDay(lockDate) && lockDate >= monthStart) {
        lockDate.setDate(lockDate.getDate() - 1)
      }

      return {
        lockDate,
        lockTime: '23:59'
      }
    }

    default:
      // Unknown frequency, use conservative approach
      return { lockDate: instanceDate, lockTime: '23:59' }
  }
}

/**
 * Calculate the dynamic status of a task based on current time and task properties
 * This is the single source of truth for task status calculation
 */
export function calculateTaskStatus(task: TaskStatusInput, currentDate?: string): TaskStatus {
  try {
    const now = getAustralianNow()
    const todayStr = currentDate || getAustralianToday()
    const today = parseAustralianDate(todayStr)
    const instanceDate = parseAustralianDate(task.date)

    // 1) Check completion status with frequency-based carry-over logic
    // For position-specific completion, only check is_completed_for_position
    // The main task status (completed/done) is set when ANY position completes it,
    // but we need position-specific completion status for shared tasks
    if (task.is_completed_for_position) {
      // Check if we're still within the carry-over period for this frequency
      const carryOverPeriod = getFrequencyCarryOverPeriod(task, instanceDate)
      
      if (carryOverPeriod.lockDate && carryOverPeriod.lockTime) {
        // For date selector scenarios, we need to check if the viewing date is within the carry-over period
        // The carry-over period ends at the lock time on the lock date
        
        // If viewing date is after the lock date, definitely missed
        if (today > carryOverPeriod.lockDate) {
          return 'missed' // Task was completed but carry-over period has ended
        }
        
        // If viewing date is exactly the lock date, check the time
        if (today.getTime() === carryOverPeriod.lockDate.getTime()) {
          // When viewing the exact lock date, we need to consider the current time
          // If it's past the lock time on that date, show as missed
          const lockDateTime = createAustralianDateTime(
            formatAustralianDate(carryOverPeriod.lockDate), 
            carryOverPeriod.lockTime
          )
          
          // Always check current time against lock time - carryover period ends regardless of viewing context
          if (now > lockDateTime) {
            return 'missed' // Task was completed but carry-over period has ended
          }
        }
      }
      
      // Still within carry-over period, show as completed
      return 'completed'
    }

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
          const isViewingToday = todayStr === getAustralianToday()
          if (!isViewingToday) {
            // Viewing a future (or past) date: before the due time on that date, show Not Due Yet
            return now < dueDateTime ? 'not_due_yet' : 'overdue'
          }
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

        const isViewingToday = todayStr === getAustralianToday()
        if (!isViewingToday) {
          // Viewing a future (or past) date: before the due time on that date, show Not Due Yet
          return now < dueDateTime ? 'not_due_yet' : 'overdue'
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