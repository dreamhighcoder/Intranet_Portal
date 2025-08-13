"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { DateNavigator } from "@/components/date-navigator"
import { TaskFilters } from "@/components/task-filters"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getTasksByPosition, getTaskCounts, calculateTaskStatus, completeTask, undoTask } from "@/lib/task-utils"
import { Check, X, Eye, LogOut } from "lucide-react"

export default function ChecklistPage() {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentDate, setCurrentDate] = useState(() => {
    return searchParams.get("date") || new Date().toISOString().split("T")[0]
  })

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedPosition, setSelectedPosition] = useState("all")
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [taskCounts, setTaskCounts] = useState({
    total: 0,
    done: 0,
    due_today: 0,
    overdue: 0,
    missed: 0
  })

  // Create stable references to prevent infinite re-renders
  const userRole = useMemo(() => user?.profile?.role, [user?.profile?.role])
  const userId = useMemo(() => user?.id, [user?.id])
  const userPositionId = useMemo(() => user?.profile?.position_id, [user?.profile?.position_id])

  // Apply filters to tasks with memoization to prevent unnecessary re-computations
  // This must be before any conditional returns to follow Rules of Hooks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Position filter (only for admin users)
      if (userRole === 'admin' && selectedPosition !== "all" && task.master_task.position_id !== selectedPosition) {
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
  }, [tasks, selectedPosition, selectedCategory, selectedStatus, userRole])

  // Handle auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  // Load tasks when date, refresh key, or user changes
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
      
      // For non-admin users, require position_id
      if (userRole !== 'admin' && !userPositionId) {
        setLoading(false)
        setTasks([])
        return
      }
      
      setLoading(true)
      try {
        if (userRole === 'admin') {
          // Admin users can see all tasks
          const [tasksByPosition, counts] = await Promise.all([
            getTasksByPosition(currentDate),
            getTaskCounts(currentDate)
          ])
          
          // Show all tasks for admin
          const allTasks = Object.values(tasksByPosition).flat()
          setTasks(allTasks)
          setTaskCounts(counts)
        } else {
          // Regular users see only their position's tasks
          const [tasksByPosition, counts] = await Promise.all([
            getTasksByPosition(currentDate),
            getTaskCounts(currentDate)
          ])
          
          const userPositionTasks = userPositionId ? tasksByPosition[userPositionId] || [] : []
          setTasks(userPositionTasks)
          setTaskCounts(counts)
        }
      } catch (error) {
        console.error('Error loading tasks:', error)
        setTasks([])
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [currentDate, refreshKey, isLoading, userId, userRole, userPositionId])

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
      } else {
        alert('Failed to complete task. Please try again.')
      }
    } catch (error) {
      console.error('Error completing task:', error)
      alert('Failed to complete task. Please try again.')
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    try {
      const success = await undoTask(taskId, userId)
      if (success) {
        setRefreshKey((prev) => prev + 1)
      } else {
        alert('Failed to undo task. Please try again.')
      }
    } catch (error) {
      console.error('Error undoing task:', error)
      alert('Failed to undo task. Please try again.')
    }
  }

  const handleFinish = () => {
    logout()
    router.push("/login")
  }

  // Show loading if auth is still loading OR if we have a user but no profile yet OR local loading
  const isAuthLoading = isLoading || (user && !user.profile)
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

  // Only show access denied after auth is complete and user has no profile  
  if (!user || !user.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">Unable to load your user profile. Please contact an administrator.</p>
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
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Checklist — {userRole === 'admin' ? 'All Positions' : (user?.position?.name || "Your Position")} —{" "}
            {new Date(currentDate).toLocaleDateString("en-AU", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {filteredTasks.length} tasks • {filteredTasks.filter((t) => t.status === "done").length} completed
          </p>
          {userRole === 'admin' ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Viewing as Administrator - All positions shown
            </p>
          ) : userPositionId && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Position: {user?.position?.name || 'Unknown Position'}
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
            hidePositionFilter={userRole !== "admin"}
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
                    {userRole === 'admin' && <TableHead>Position</TableHead>}
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
                        {userRole === 'admin' && (
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
