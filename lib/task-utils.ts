import type { TaskInstance, TaskWithDetails, TaskStatus } from "./types"
import { taskInstancesApi } from "./api"

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

// Calculate task status based on current time and due time
export function calculateTaskStatus(task: TaskInstance): TaskStatus {
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

  if (task.status === "done") return "done"

  if (task.due_date > today) return "not_due"

  if (task.due_date === today) {
    if (currentTime < task.due_time) return "not_due"
    if (currentTime >= task.due_time) return "due_today"
  }

  if (task.due_date < today) {
    // Check if it was missed (not completed by end of due date)
    const endOfDueDate = new Date(`${task.due_date}T23:59:59`)
    if (now > endOfDueDate && task.status !== "done") {
      return "missed"
    }
    return "overdue"
  }

  return "not_due"
}

// Format date for display
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Get date navigation (previous/next day)
export function getDateNavigation(currentDate: string) {
  const date = new Date(currentDate)
  const prevDate = new Date(date)
  prevDate.setDate(date.getDate() - 1)
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + 1)

  return {
    previous: prevDate.toISOString().split("T")[0],
    next: nextDate.toISOString().split("T")[0],
    today: new Date().toISOString().split("T")[0],
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

// Real function to complete a task
export async function completeTask(taskId: string, userId?: string): Promise<boolean> {
  try {
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

    return true
  } catch (error) {
    console.error('Error completing task:', error)
    return false
  }
}

// Real function to undo task completion
export async function undoTask(taskId: string, userId?: string): Promise<boolean> {
  try {
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
