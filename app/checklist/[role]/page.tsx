'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { DateNavigator } from '@/components/date-navigator'
import { TaskFilters } from '@/components/task-filters'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, Eye, LogOut, Settings, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toastError, toastSuccess } from '@/hooks/use-toast'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { authenticatedGet } from '@/lib/api-client'

interface ChecklistTask {
  id: string
  master_task_id: string
  date: string
  role: string
  status: string
  completed_by?: string
  completed_at?: string
  payload: Record<string, any>
  notes?: string
  created_at: string
  updated_at: string
  master_task: {
    id: string
    title: string
    description?: string
    timing: string
    due_time?: string
    responsibility: string[]
    categories: string[]
    frequency_rules: Record<string, any>
  }
}

// Category display names and colors
const CATEGORY_CONFIG = {
  'stock-control': { label: 'Stock Control', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'compliance': { label: 'Compliance', color: 'bg-red-100 text-red-800 border-red-200' },
  'cleaning': { label: 'Cleaning', color: 'bg-green-100 text-green-800 border-green-200' },
  'pharmacy-services': { label: 'Pharmacy Services', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'fos-operations': { label: 'FOS Operations', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'dispensary-operations': { label: 'Dispensary Operations', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'general-pharmacy-operations': { label: 'General Pharmacy Operations', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'business-management': { label: 'Business Management', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'general': { label: 'General', color: 'bg-gray-100 text-gray-800 border-gray-200' }
}

const getCategoryConfig = (category: string) => {
  return CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || {
    label: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export default function RoleChecklistPage() {
  const { user, isLoading, signOut, isAdmin } = usePositionAuth()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const role = params.role as string
  const userRole = isAdmin ? 'admin' : 'viewer'

  const [currentDate, setCurrentDate] = useState(() => {
    return searchParams.get("date") || new Date().toISOString().split("T")[0]
  })

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasks, setTasks] = useState<ChecklistTask[]>([])
  const [loading, setLoading] = useState(true)
  const [taskCounts, setTaskCounts] = useState({
    total: 0,
    done: 0,
    due_today: 0,
    overdue: 0,
    missed: 0
  })

  // Handle auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  // Load tasks when date, refresh key, or role changes
  useEffect(() => {
    const loadTasks = async () => {
      if (isLoading || !user || !role) {
        return
      }
      
      setLoading(true)
      try {
        // Normalize role to ensure it's in the kebab-case format
        const normalizedRole = toKebabCase(role);
        
        console.log('Fetching tasks for role:', normalizedRole, 'and date:', currentDate)
        
        const data = await authenticatedGet(`/api/checklist?role=${normalizedRole}&date=${currentDate}`)
        
        if (!data || !data.success) {
          console.error('API reported failure:', data?.error)
          throw new Error(data?.error || 'Failed to fetch tasks')
        }
        
        console.log('Tasks received:', data.data?.length || 0)
        setTasks(data.data || [])
        
        // Calculate task counts
        const counts = {
          total: data.data.length,
          done: data.data.filter((t: ChecklistTask) => t.status === 'completed').length,
          due_today: 0,
          overdue: 0,
          missed: 0
        }
        
        const now = new Date()
        const today = currentDate
        
        data.data.forEach((task: ChecklistTask) => {
          if (task.status !== 'completed') {
            counts.due_today++
            
            // Check if overdue
            if (task.master_task?.due_time) {
              const dueTime = new Date(`${today}T${task.master_task.due_time}`)
              if (now > dueTime) {
                counts.overdue++
              }
            }
          }
        })
        
        setTaskCounts(counts)
      } catch (error) {
        console.error('Error loading tasks:', error)
        setTasks([])
        toastError("Error", "Failed to load tasks. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [currentDate, refreshKey, isLoading, user, role])

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
    router.push(`/checklist/${role}?${params.toString()}`)
  }

  const handleTaskComplete = async (taskId: string) => {
    try {
      const response = await fetch('/api/checklist/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          action: 'complete'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete task')
      }

      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Completed", "Task has been marked as complete.")
    } catch (error) {
      console.error('Error completing task:', error)
      toastError("Error", error instanceof Error ? error.message : "Failed to complete task. Please try again.")
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    try {
      const response = await fetch('/api/checklist/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          action: 'undo'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to undo task')
      }

      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Reopened", "Task has been reopened.")
    } catch (error) {
      console.error('Error undoing task:', error)
      toastError("Error", error instanceof Error ? error.message : "Failed to undo task. Please try again.")
    }
  }

  const handleFinish = () => {
    signOut()
    router.push("/")
  }

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Category filter
      if (selectedCategory !== "all" && !task.master_task.categories.includes(selectedCategory)) {
        return false
      }

      // Status filter
      if (selectedStatus !== "all") {
        if (selectedStatus === "overdue") {
          if (task.status === "completed") return false
          if (task.master_task?.due_time) {
            const dueTime = new Date(`${currentDate}T${task.master_task.due_time}`)
            const now = new Date()
            return now > dueTime
          }
          return false
        }
        
        if (selectedStatus === "due_today") {
          return task.status !== "completed"
        }
        
        if (selectedStatus === "completed") {
          return task.status === "completed"
        }
      }

      return true
    })
  }, [tasks, selectedCategory, selectedStatus, currentDate])

  // Get unique categories for filter (use full catalog when empty)
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>()
    tasks.forEach(task => {
      ;(task.master_task.categories || []).forEach(cat => categories.add(cat))
    })
    const list = Array.from(categories)
    if (list.length === 0) {
      // Fallback to full category list from constants if no tasks or no categories loaded
      return [
        'stock-control',
        'compliance',
        'cleaning',
        'pharmacy-services',
        'fos-operations',
        'dispensary-operations',
        'general-pharmacy-operations',
        'business-management',
      ]
    }
    return list.sort()
  }, [tasks])

  // Show loading if auth is still loading OR local loading
  const shouldShowLoading = isLoading || loading
  
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {isLoading ? 'Loading user profile...' : 'Loading checklist...'}
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

  const getStatusBadge = (task: ChecklistTask) => {
    if (task.status === "completed") {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          ✅ Done
        </Badge>
      )
    }

    // Check if overdue
    if (task.master_task?.due_time) {
      const dueTime = new Date(`${currentDate}T${task.master_task.due_time}`)
      const now = new Date()
      if (now > dueTime) {
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            ⚠️ Overdue
          </Badge>
        )
      }
    }

    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        ⏰ Due Today
      </Badge>
    )
  }

  const allTasksCompleted = filteredTasks.length > 0 && filteredTasks.every((task) => task.status === "completed")

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                {role.charAt(0).toUpperCase() + role.slice(1)} Checklist —{" "}
                {new Date(currentDate).toLocaleDateString("en-AU", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h1>
            </div>
            
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
            {filteredTasks.length} tasks • {filteredTasks.filter((t) => t.status === "completed").length} completed
          </p>
        </div>

        {/* Date Navigator */}
        <div className="mb-6">
          <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(category => {
                    const config = getCategoryConfig(category)
                    return (
                      <SelectItem key={category} value={category}>
                        {config.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="due_today">Due Today</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Task List */}
        <Card className="card-surface mb-6">
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%] px-6">Task Title</TableHead>
                      <TableHead className="w-[15%] px-4">Category</TableHead>
                      <TableHead className="w-[12%] px-4">Timing</TableHead>
                      <TableHead className="w-[10%] px-4">Due Time</TableHead>
                      <TableHead className="w-[12%] px-4">Status</TableHead>
                      <TableHead className="w-[16%] px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={`${task.id}-${refreshKey}`}>
                        <TableCell className="px-6">
                          <div className="font-medium">{task.master_task.title}</div>
                          {task.master_task.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {task.master_task.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex flex-wrap gap-1">
                            {task.master_task.categories.map((category, index) => {
                              const config = getCategoryConfig(category)
                              return (
                                <Badge key={index} className={`text-xs ${config.color}`}>
                                  {config.label}
                                </Badge>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="secondary" className="capitalize">
                            {task.master_task.timing.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          {task.master_task.due_time ? (
                            <span className="text-sm font-medium">{task.master_task.due_time}</span>
                          ) : (
                            <span className="text-sm text-gray-500">No due time</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4">{getStatusBadge(task)}</TableCell>
                        <TableCell className="px-6">
                          <div className="flex items-center space-x-2">
                            {task.status === "completed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTaskUndo(task.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Undo
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleTaskComplete(task.id)}
                                className="bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Done
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                toastError("Feature Not Available", "Task details view is not yet implemented.")
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                  <LogOut className="h-4 w-4 mr-2" />
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
              <span className="text-green-600">
                {taskCounts.done} Done
              </span>
              <span className="text-orange-600">
                {taskCounts.due_today} Due Today
              </span>
              <span className="text-red-600">
                {taskCounts.overdue} Overdue
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
