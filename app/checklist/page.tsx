"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { DateNavigator } from "@/components/date-navigator"
import { TaskFilters } from "@/components/task-filters"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getTasksByPosition, getTaskCounts, calculateTaskStatus, completeTask, undoTask } from "@/lib/task-utils"
import { positionsApi } from "@/lib/api-client"
import { Check, X, Eye, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { toastError, toastSuccess } from "@/hooks/use-toast"

export default function ChecklistPage() {
  const { user: oldUser, isLoading: oldIsLoading, logout } = useAuth()
  const { user: positionUser, isLoading: positionIsLoading, signOut, isAdmin } = usePositionAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Use position-based auth as primary, fallback to old auth for backward compatibility
  const user = positionUser || oldUser
  const isLoading = positionIsLoading && oldIsLoading
  const userRole = positionUser ? (positionUser.role === 'admin' ? 'admin' : 'viewer') : oldUser?.profile?.role

  const [currentDate, setCurrentDate] = useState(() => {
    return searchParams.get("date") || new Date().toISOString().split("T")[0]
  })

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedPosition, setSelectedPosition] = useState("all")
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasks, setTasks] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [taskCounts, setTaskCounts] = useState({
    total: 0,
    done: 0,
    due_today: 0,
    overdue: 0,
    missed: 0
  })

  // Create stable references to prevent infinite re-renders
  const userId = useMemo(() => {
    if (positionUser) return positionUser.id
    return oldUser?.id
  }, [positionUser?.id, oldUser?.id])
  
  const userPositionId = useMemo(() => {
    if (positionUser) return positionUser.id
    return oldUser?.profile?.position_id
  }, [positionUser?.id, oldUser?.profile?.position_id])
  
  // Get position parameter from URL
  const urlPositionId = useMemo(() => searchParams.get("position"), [searchParams])
  
  // Determine which position to show tasks for
  const viewingPositionId = useMemo(() => {
    // If URL has a position parameter, use it (admins can view any position, users can only view if it matches their position)
    if (urlPositionId) {
      if (userRole === 'admin' || urlPositionId === userPositionId) {
        return urlPositionId
      }
    }
    // Otherwise, use user's own position for non-admin users
    return userRole === 'admin' ? null : userPositionId
  }, [urlPositionId, userRole, userPositionId])
  
  // Get the position name for display
  const viewingPositionName = useMemo(() => {
    if (!viewingPositionId) return null
    const position = positions.find(p => p.id === viewingPositionId)
    return position?.name
  }, [viewingPositionId, positions])

  // Apply filters to tasks with memoization to prevent unnecessary re-computations
  // This must be before any conditional returns to follow Rules of Hooks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Position filter (only for admin users when NOT viewing a specific position)
      if (userRole === 'admin' && !viewingPositionId && selectedPosition !== "all" && task.master_task.position_id !== selectedPosition) {
        return false
      }

      // Category filter
      if (selectedCategory !== "all" && task.master_task.category !== selectedCategory) {
        return false
      }

      // Status filter
      if (selectedStatus !== "all") {
        const taskStatus = calculateTaskStatus(task)
        if (taskStatus !== selectedStatus) {
          return false
        }
      }

      return true
    })
  }, [tasks, selectedPosition, selectedCategory, selectedStatus, userRole, viewingPositionId])

  // Handle auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  // Load positions data
  useEffect(() => {
    const loadPositions = async () => {
      try {
        const positionsData = await positionsApi.getAll()
        setPositions(positionsData || [])
      } catch (error) {
        console.error('Error loading positions:', error)
        setPositions([])
      }
    }

    if (!isLoading && user) {
      loadPositions()
    }
  }, [isLoading, user])

  // Load tasks when date, refresh key, user, or viewing position changes
  useEffect(() => {
    const loadTasks = async () => {
      // Only proceed if auth is complete and user is fully loaded
      if (isLoading) {
        return
      }

      // If no user, don't load tasks
      if (!user) {
        setLoading(false)
        setTasks([])
        return
      }

      // If user exists but profile is not loaded, don't load tasks yet
      if (!user.profile) {
        setLoading(false)
        setTasks([])
        return
      }
      
      setLoading(true)
      try {
        if (viewingPositionId) {
          // Load tasks for specific position
          const [tasksByPosition, counts] = await Promise.all([
            getTasksByPosition(currentDate),
            getTaskCounts(currentDate)
          ])
          
          const positionTasks = tasksByPosition[viewingPositionId] || []
          setTasks(positionTasks)
          setTaskCounts(counts)
        } else if (userRole === 'admin') {
          // Admin users can see all tasks when no specific position is selected
          const [tasksByPosition, counts] = await Promise.all([
            getTasksByPosition(currentDate),
            getTaskCounts(currentDate)
          ])
          
          const allTasks = Object.values(tasksByPosition).flat()
          setTasks(allTasks)
          setTaskCounts(counts)
        } else {
          // Fallback: Regular users with no position should see empty list
          setTasks([])
          setTaskCounts({
            total: 0,
            done: 0,
            due_today: 0,
            overdue: 0,
            missed: 0
          })
        }
      } catch (error) {
        console.error('Error loading tasks:', error)
        setTasks([])
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [currentDate, refreshKey, isLoading, userId, userRole, userPositionId, viewingPositionId])

  useEffect(() => {
    const dateParam = searchParams.get("date")
    if (dateParam && dateParam !== currentDate) {
      setCurrentDate(dateParam)
    }
  }, [searchParams, currentDate])

  const handleDateChange = (date: string) => {
    setCurrentDate(date)
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", date)
    router.push(`/checklist?${params.toString()}`)
  }

  const handleTaskComplete = async (taskId: string) => {
    try {
      const success = await completeTask(taskId, userId)
      if (success) {
        setRefreshKey((prev) => prev + 1)
        toastSuccess("Task Completed", "Task has been marked as complete.")
      } else {
        toastError("Error", "Failed to complete task. Please try again.")
      }
    } catch (error) {
      console.error('Error completing task:', error)
      toastError("Error", "Failed to complete task. Please try again.")
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    try {
      const success = await undoTask(taskId, userId)
      if (success) {
        setRefreshKey((prev) => prev + 1)
        toastSuccess("Task Reopened", "Task has been reopened.")
      } else {
        toastError("Error", "Failed to undo task. Please try again.")
      }
    } catch (error) {
      console.error('Error undoing task:', error)
      toastError("Error", "Failed to undo task. Please try again.")
    }
  }

  const handleFinish = () => {
    if (positionUser) {
      signOut()
    } else {
      logout()
    }
    router.push("/")
  }

  // Show loading if auth is still loading OR if we have a user but no profile yet OR local loading
  const isAuthLoading = isLoading || (oldUser && !oldUser.profile)
  const shouldShowLoading = isAuthLoading || loading
  
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {isAuthLoading ? 'Loading user profile...' : 'Loading checklist...'}
          </p>
        </div>
      </div>
    )
  }

  // Only show access denied after auth is complete and no user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">Please log in to access your checklist.</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      not_due: {
        label: "Not Due",
        className: "bg-[var(--status-todo-bg)] text-[var(--status-todo-text)]",
        icon: null,
      },
      due_today: {
        label: "Due Today",
        className: "bg-[var(--status-due-today-bg)] text-[var(--status-due-today-text)]",
        icon: "⏰",
      },
      overdue: {
        label: "Overdue",
        className: "bg-[var(--status-overdue-bg)] text-[var(--status-overdue-text)]",
        icon: "⚠️",
      },
      missed: {
        label: "Missed",
        className: "bg-[var(--status-missed-bg)] text-[var(--status-missed-text)]",
        icon: "❌",
      },
      done: {
        label: "Done",
        className: "bg-[var(--status-done-bg)] text-[var(--status-done-text)]",
        icon: "✅",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_due

    return (
      <Badge className={config.className} aria-label={config.label}>
        {config.icon && <span className="mr-1">{config.icon}</span>}
        {config.label}
      </Badge>
    )
  }

  const allTasksCompleted = filteredTasks.length > 0 && filteredTasks.every((task) => task.status === "done")

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
              Checklist — {viewingPositionName ? viewingPositionName : (userRole === 'admin' ? 'All Positions' : (positionUser?.position?.displayName || oldUser?.position?.name || "Your Position"))} —{" "}
              {new Date(currentDate).toLocaleDateString("en-AU", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
            {/* Checklist Management Button for Administrators */}
            {userRole === 'admin' && (
              <Button
                asChild
                variant="outline"
                className="bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-secondary)]"
              >
                <Link href="/admin/master-tasks" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Checklist Management</span>
                </Link>
              </Button>
            )}
          </div>
          <p className="text-[var(--color-text-secondary)]">
            {filteredTasks.length} tasks • {filteredTasks.filter((t) => t.status === "done").length} completed
          </p>
          {viewingPositionName ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Viewing: {viewingPositionName} checklist
              {userRole === 'admin' && " (as Administrator)"}
              {userRole !== 'admin' && urlPositionId === userPositionId && " (your position)"}
            </p>
          ) : userRole === 'admin' ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Viewing as Administrator - All positions shown
            </p>
          ) : userPositionId && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Position: {positionUser?.position?.displayName || oldUser?.position?.name || 'Unknown Position'}
            </p>
          )}
        </div>

        {/* Date Navigator */}
        <div className="mb-6">
          <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <TaskFilters
            selectedPosition={selectedPosition}
            selectedCategory={selectedCategory}
            selectedStatus={selectedStatus}
            onPositionChange={setSelectedPosition}
            onCategoryChange={setSelectedCategory}
            onStatusChange={setSelectedStatus}
            hidePositionFilter={userRole !== "admin" || !!viewingPositionId}
          />
        </div>

        {/* Task List - List Layout */}
        <Card className="card-surface mb-6">
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Title</TableHead>
                    <TableHead>Category</TableHead>
                    {userRole === 'admin' && !viewingPositionId && <TableHead>Position</TableHead>}
                    <TableHead>Frequency</TableHead>
                    <TableHead>Due Date/Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const taskStatus = calculateTaskStatus(task)
                    return (
                      <TableRow key={`${task.id}-${refreshKey}`}>
                        <TableCell>
                          <div className="font-medium">{task.master_task.title}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.master_task.category}</Badge>
                        </TableCell>
                        {userRole === 'admin' && !viewingPositionId && (
                          <TableCell>
                            <Badge variant="secondary">{task.master_task.position?.name || 'No Position'}</Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-[var(--color-text-secondary)]">
                          {task.master_task.frequency}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{task.due_date}</div>
                            <div className="text-[var(--color-text-secondary)]">{task.due_time}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(taskStatus)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {task.status === "done" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTaskUndo(task.id)}
                                disabled={task.locked && !task.master_task?.allow_edit_when_locked}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Undo
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleTaskComplete(task.id)}
                                disabled={task.locked && !task.master_task?.allow_edit_when_locked}
                                className="bg-[var(--color-primary)] text-[var(--color-primary-on)]"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Mark Done
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                // Mock task detail view
                                console.log("View task details:", task.id)
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Finish Button - Auto-logout when all tasks completed */}
        {allTasksCompleted && (
          <div className="text-center mb-6">
            <Card className="card-surface inline-block">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-green-600 mb-2">All Tasks Completed! 🎉</h3>
                <p className="text-[var(--color-text-secondary)] mb-4">
                  Great job! You've completed all your tasks for today.
                </p>
                <Button onClick={handleFinish} className="bg-green-600 hover:bg-green-700 text-white">
                  <LogOut className="w-4 h-4 mr-2" />
                  Finish & Logout
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Footer */}
        <div className="p-4 bg-white rounded-lg border border-[var(--color-border)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              Summary for {new Date(currentDate).toLocaleDateString("en-AU")}
            </span>
            <div className="flex items-center space-x-4">
              <span className="text-[var(--status-done-bg)]">
                {filteredTasks.filter((t) => t.status === "done").length} Done
              </span>
              <span className="text-[var(--status-due-today-bg)]">
                {filteredTasks.filter((t) => calculateTaskStatus(t) === "due_today").length} Due Today
              </span>
              <span className="text-[var(--status-overdue-bg)]">
                {filteredTasks.filter((t) => calculateTaskStatus(t) === "overdue").length} Overdue
              </span>
              <span className="text-[var(--status-missed-bg)]">
                {filteredTasks.filter((t) => calculateTaskStatus(t) === "missed").length} Missed
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
