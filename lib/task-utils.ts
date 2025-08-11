import type { TaskInstance, TaskWithDetails, TaskStatus } from "./types"
import { mockTaskInstances, mockMasterTasks, mockPositions } from "./mock-data"

// Get tasks with full details for a specific date
export function getTasksForDate(date: string): TaskWithDetails[] {
  const tasksForDate = mockTaskInstances.filter((task) => task.due_date === date)

  return tasksForDate.map((task) => ({
    ...task,
    master_task: mockMasterTasks.find((mt) => mt.id === task.master_task_id)!,
    position: mockPositions.find((p) => p.id === task.position_id)!,
  }))
}

// Get tasks grouped by position for a specific date
export function getTasksByPosition(date: string): Record<string, TaskWithDetails[]> {
  const tasks = getTasksForDate(date)
  const grouped: Record<string, TaskWithDetails[]> = {}

  tasks.forEach((task) => {
    const positionName = task.position.name
    if (!grouped[positionName]) {
      grouped[positionName] = []
    }
    grouped[positionName].push(task)
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
export function getTaskCounts(date: string) {
  const tasks = getTasksForDate(date)
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

// Mock function to toggle task completion
export function toggleTaskCompletion(taskId: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // In real implementation, this would update the database
      const task = mockTaskInstances.find((t) => t.id === taskId)
      if (task) {
        if (task.status === "done") {
          task.status = "due_today"
          task.completed_at = undefined
          task.completed_by = undefined
        } else {
          task.status = "done"
          task.completed_at = new Date().toISOString()
          task.completed_by = "Current User"
        }
      }
      resolve(true)
    }, 500)
  })
}
