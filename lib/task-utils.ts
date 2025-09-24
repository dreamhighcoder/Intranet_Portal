import type { TaskInstance, TaskWithDetails, TaskStatus } from "./types"
import { taskInstancesApi } from "./api-client"
import { 
  getAustralianNow, 
  getAustralianToday, 
  formatAustralianDate,
  parseAustralianDate,
  createAustralianDateTime,
  isAustralianTimePast
} from "./timezone-utils"

// Get tasks with full details for a specific date
export async function getTasksForDate(date: string): Promise<TaskWithDetails[]> {
  try {
    const tasks = await taskInstancesApi.getAll({ date })
    return tasks.map(task => ({
      id: task.id,
      instance_date: task.instance_date,
      due_date: task.due_date,
      due_time: task.due_time,
      status: task.status,
      completed_at: task.completed_at,
      completed_by: task.completed_by,
      locked: task.locked,
      acknowledged: task.acknowledged,
      resolved: task.resolved,
      created_at: task.created_at,
      updated_at: task.updated_at,
      master_task: task.master_task,
      position: task.master_task.position
    } as TaskWithDetails))
  } catch (error) {
    console.error('Error fetching tasks for date:', error)
    return []
  }
}

// Get tasks with filters
export async function getTasks(filters: {
  date?: string;
  dateRange?: string;
  position_id?: string;
  status?: string;
  category?: string;
}): Promise<TaskWithDetails[]> {
  try {
    const tasks = await taskInstancesApi.getAll(filters)
    return tasks.map(task => ({
      id: task.id,
      instance_date: task.instance_date,
      due_date: task.due_date,
      due_time: task.due_time,
      status: task.status,
      completed_at: task.completed_at,
      completed_by: task.completed_by,
      locked: task.locked,
      acknowledged: task.acknowledged,
      resolved: task.resolved,
      created_at: task.created_at,
      updated_at: task.updated_at,
      master_task: task.master_task,
      position: task.master_task.position
    } as TaskWithDetails))
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
}

// Get tasks grouped by position for a specific date
export async function getTasksByPosition(date: string): Promise<Record<string, TaskWithDetails[]>> {
  const tasks = await getTasksForDate(date)
  const grouped: Record<string, TaskWithDetails[]> = {}

  tasks.forEach((task) => {
    // Group by position ID to align with access control and filtering by position_id
    const positionId = task.position.id
    if (!grouped[positionId]) {
      grouped[positionId] = []
    }
    grouped[positionId].push(task)
  })

  return grouped
}

// Calculate task status based on current time and due time (using Australian timezone)
export function calculateTaskStatus(task: TaskInstance): TaskStatus {
  const australianNow = getAustralianNow()
  const australianToday = getAustralianToday()
  const currentTime = australianNow.toTimeString().slice(0, 5) // HH:MM format

  if (task.status === "done") return "done"

  if (task.due_date > australianToday) return "not_due"

  if (task.due_date === australianToday) {
    if (currentTime < task.due_time) return "not_due"
    if (currentTime >= task.due_time) return "due_today"
  }

  if (task.due_date < australianToday) {
    // Check if it was missed (not completed by end of due date) using Australian timezone
    const endOfDueDate = createAustralianDateTime(task.due_date, "23:59")
    if (australianNow > endOfDueDate) {
      return "missed"
    }
    return "overdue"
  }

  return "not_due"
}

// Format a Date to Australian YYYY-MM-DD (using Australian timezone)
export function formatLocalDate(date: Date): string {
  return formatAustralianDate(date)
}

// Parse a YYYY-MM-DD string into an Australian Date object (no timezone shift)
export function parseLocalDate(dateString: string): Date {
  return parseAustralianDate(dateString)
}

// Format date for display (using Australian timezone) - DD-MM-YYYY format
export function formatDate(dateString: string): string {
  const date = parseAustralianDate(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${day}-${month}-${year}`
}

// Get date navigation (previous/next day) using Australian timezone
export function getDateNavigation(currentDate: string) {
  const date = parseAustralianDate(currentDate)
  const prevDate = new Date(date)
  prevDate.setDate(date.getDate() - 1)
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + 1)

  return {
    previous: formatAustralianDate(prevDate),
    next: formatAustralianDate(nextDate),
    today: getAustralianToday(),
  }
}

// Get task counts for a date
export async function getTaskCounts(date: string) {
  const tasks = await getTasksForDate(date)
  const counts = {
    total: tasks.length,
    not_due: 0,
    due_today: 0,
    overdue: 0,
    missed: 0,
    done: 0,
  }

  tasks.forEach((task) => {
    const status = calculateTaskStatus(task)
    counts[status]++
  })

  return counts
}

// Real function to complete a task with audit trail
export async function completeTask(taskId: string, userId?: string): Promise<boolean> {
  try {
    const completionTime = getAustralianNow().toISOString()
    
    // Complete the task
    const response = await fetch(`/api/task-instances/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'complete',
        userId: userId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Error completing task:', error)
      return false
    }

    // Log the completion in audit trail
    try {
      await fetch('/api/audit/task-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_instance_id: taskId,
          action: 'completed',
          completion_time: completionTime,
          notes: 'Task marked as completed'
        })
      })
    } catch (auditError) {
      console.warn('Failed to log completion audit:', auditError)
      // Don't fail the main operation if audit logging fails
    }

    return true
  } catch (error) {
    console.error('Error completing task:', error)
    return false
  }
}

// Real function to undo task completion with audit trail
export async function undoTask(taskId: string, userId?: string): Promise<boolean> {
  try {
    const undoTime = getAustralianNow().toISOString()
    
    // Undo the task
    const response = await fetch(`/api/task-instances/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'undo',
        userId: userId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Error undoing task:', error)
      return false
    }

    // Log the undo in audit trail
    try {
      await fetch('/api/audit/task-completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_instance_id: taskId,
          action: 'uncompleted',
          completion_time: undoTime,
          notes: 'Task completion undone'
        })
      })
    } catch (auditError) {
      console.warn('Failed to log undo audit:', auditError)
      // Don't fail the main operation if audit logging fails
    }

    return true
  } catch (error) {
    console.error('Error undoing task:', error)
    return false
  }
}

// Function to toggle task completion (for backward compatibility)
export async function toggleTaskCompletion(taskId: string, userId?: string): Promise<boolean> {
  try {
    // First get the current task status
    const task = await taskInstancesApi.getById(taskId)
    
    if (task.status === 'done') {
      return await undoTask(taskId, userId)
    } else {
      return await completeTask(taskId, userId)
    }
  } catch (error) {
    console.error('Error toggling task completion:', error)
    return false
  }
}

// Function to acknowledge a missed/overdue task
export async function acknowledgeTask(taskId: string, userId?: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/task-instances/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'acknowledge',
        userId: userId
      })
    })

    return response.ok
  } catch (error) {
    console.error('Error acknowledging task:', error)
    return false
  }
}

// Function to resolve a task issue
export async function resolveTask(taskId: string, userId?: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/task-instances/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'resolve',
        userId: userId
      })
    })

    return response.ok
  } catch (error) {
    console.error('Error resolving task:', error)
    return false
  }
}
