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
import { Input } from '@/components/ui/input'
import { Check, X, Eye, LogOut, Settings, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { toastError, toastSuccess } from '@/hooks/use-toast'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { authenticatedGet, authenticatedPost } from '@/lib/api-client'
import TaskDetailModal from '@/components/checklist/TaskDetailModal'

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
    frequencies: string[] // Using frequencies from database
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

// Responsibility badge colors - bright and distinct colors for better visibility
const RESPONSIBILITY_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-red-100 text-red-800 border-red-200'
]

// Timing badge colors - bright and distinct colors for different timing values
const TIMING_COLORS = {
  'opening': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'closing': 'bg-rose-100 text-rose-800 border-rose-200',
  'anytime_during_day': 'bg-blue-100 text-blue-800 border-blue-200',
  'specific_time': 'bg-purple-100 text-purple-800 border-purple-200',
  'morning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'afternoon': 'bg-orange-100 text-orange-800 border-orange-200',
  'evening': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'before_opening': 'bg-teal-100 text-teal-800 border-teal-200',
  'after_closing': 'bg-pink-100 text-pink-800 border-pink-200',
  'during_business_hours': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'end_of_day': 'bg-amber-100 text-amber-800 border-amber-200',
  'start_of_day': 'bg-lime-100 text-lime-800 border-lime-200',
  'lunch_time': 'bg-violet-100 text-violet-800 border-violet-200'
}

const getResponsibilityColor = (responsibility: string) => {
  // Create a consistent hash-based color assignment for each responsibility
  let hash = 0
  for (let i = 0; i < responsibility.length; i++) {
    const char = responsibility.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % RESPONSIBILITY_COLORS.length
  return RESPONSIBILITY_COLORS[index]
}

const getTimingColor = (timing: string) => {
  return TIMING_COLORS[timing as keyof typeof TIMING_COLORS] || 'bg-gray-100 text-gray-800 border-gray-200'
}

const formatResponsibility = (responsibility: string) => {
  return responsibility
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const renderBadgesWithTruncation = (
  items: string[],
  maxVisible: number = 2,
  type: 'responsibility' | 'category' = 'responsibility',
  colorFn?: (value: string) => string
) => {
  if (items.length <= maxVisible) {
    return items.map((item, index) => {
      if (type === 'responsibility') {
        const colorClass = colorFn ? colorFn(item) : getResponsibilityColor(item)
        return (
          <Badge key={index} className={`text-xs ${colorClass}`}>
            {formatResponsibility(item)}
          </Badge>
        )
      } else {
        const config = getCategoryConfig(item)
        return (
          <Badge key={index} className={`text-xs ${config.color}`}>
            {config.label}
          </Badge>
        )
      }
    })
  }

  const visibleItems = items.slice(0, maxVisible)
  const hiddenCount = items.length - maxVisible

  return (
    <>
      {visibleItems.map((item, index) => {
        if (type === 'responsibility') {
          const colorClass = colorFn ? colorFn(item) : getResponsibilityColor(item)
          return (
            <Badge key={index} className={`text-xs ${colorClass}`}>
              {formatResponsibility(item)}
            </Badge>
          )
        } else {
          const config = getCategoryConfig(item)
          return (
            <Badge key={index} className={`text-xs ${config.color}`}>
              {config.label}
            </Badge>
          )
        }
      })}
      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
        +{hiddenCount}
      </Badge>
    </>
  )
}

export default function RoleChecklistPage() {
  const { user, isLoading, signOut, isAdmin } = usePositionAuth()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const rawRole = params.role as string
  const userRole = isAdmin ? 'admin' : 'viewer'

  // Validate and decode role parameter
  if (!rawRole || typeof rawRole !== 'string') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Role</h1>
          <p className="text-gray-600">The role parameter is missing or invalid.</p>
        </div>
      </div>
    )
  }

  // Decode URL-encoded role parameter and validate
  let role: string
  try {
    role = decodeURIComponent(rawRole)
    // Additional validation to ensure it's a valid role format
    if (role.includes('[') || role.includes(']') || role.includes('%')) {
      throw new Error('Invalid role format')
    }
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Role Format</h1>
          <p className="text-gray-600">The role parameter contains invalid characters.</p>
        </div>
      </div>
    )
  }

  const [currentDate, setCurrentDate] = useState(() => {
    // Use URL date if present, otherwise default to local today (avoid UTC off-by-one)
    const urlDate = searchParams.get("date")
    if (urlDate) return urlDate
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedResponsibility, setSelectedResponsibility] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
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
  const [selectedTask, setSelectedTask] = useState<ChecklistTask | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set())

  // Handle auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  // Get unique responsibilities from tasks for admin filter
  const uniqueResponsibilities = useMemo(() => {
    if (!isAdmin) return []
    
    const responsibilities = new Set<string>()
    tasks.forEach(task => {
      ;(task.master_task.responsibility || []).forEach(resp => responsibilities.add(resp))
    })
    return Array.from(responsibilities).sort()
  }, [tasks, isAdmin])

  // Load tasks when date, refresh key, role, or responsibility changes
  useEffect(() => {
    const loadTasks = async () => {
      if (isLoading || !user || !role) {
        return
      }
      
      // Additional check to ensure user is properly authenticated
      if (!user.isAuthenticated) {
        console.log('User not authenticated, skipping task load')
        return
      }
      
      setLoading(true)
      try {
        // Normalize role to ensure it's in the kebab-case format
        const normalizedRole = toKebabCase(role);
        
        // Build query parameters
        const params = new URLSearchParams({
          role: normalizedRole,
          date: currentDate
        })
        
        // Add admin mode for admins (but don't filter by responsibility on server-side)
        if (isAdmin) {
          params.append('admin_mode', 'true')
          // Note: We'll filter by responsibility on the client-side to keep all responsibilities available in the dropdown
        }
        
        console.log('Fetching tasks with params:', params.toString())
        
        const data = await authenticatedGet(`/api/checklist?${params.toString()}`)
        
        console.log('Raw API response:', data)
        console.log('Response type:', typeof data)
        console.log('Response keys:', data ? Object.keys(data) : 'null')
        
        if (!data || !data.success) {
          console.error('API reported failure:', data?.error)
          console.error('Full response object:', JSON.stringify(data, null, 2))
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
        
        // More specific error handling
        if (error instanceof Error) {
          if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
            toastError("Loading Error", "Failed to load page resources. Please refresh the page.")
          } else if (error.message.includes('Network')) {
            toastError("Network Error", "Please check your internet connection and try again.")
          } else {
            toastError("Error", `Failed to load tasks: ${error.message}`)
          }
        } else {
          toastError("Error", "Failed to load tasks. Please try again.")
        }
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [currentDate, refreshKey, isLoading, user, role, isAdmin])

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
    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) return

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed', completed_at: new Date().toISOString() }
          : task
      )
    )

    try {
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'complete'
      })

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to complete task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Completed", "Task has been marked as complete.")
    } catch (error) {
      console.error('Error completing task:', error)
      // Revert optimistic update on error
      setRefreshKey((prev) => prev + 1)
      toastError("Error", error instanceof Error ? error.message : "Failed to complete task. Please try again.")
    } finally {
      // Remove from processing set
      setProcessingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) return

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'pending', completed_at: undefined, completed_by: undefined }
          : task
      )
    )

    try {
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'undo'
      })

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to undo task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Reopened", "Task has been reopened.")
    } catch (error) {
      console.error('Error undoing task:', error)
      // Revert optimistic update on error
      setRefreshKey((prev) => prev + 1)
      toastError("Error", error instanceof Error ? error.message : "Failed to undo task. Please try again.")
    } finally {
      // Remove from processing set
      setProcessingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleFinish = () => {
    signOut()
    router.push("/")
  }

  const handleViewDetails = (task: ChecklistTask) => {
    setSelectedTask(task)
    setIsDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedTask(null)
  }

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter - search by description only
      if (searchTerm && !task.master_task.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Responsibility filter (for admin mode)
      if (isAdmin && selectedResponsibility !== "all") {
        if (!task.master_task.responsibility.includes(selectedResponsibility)) {
          return false
        }
      }

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
  }, [tasks, searchTerm, selectedResponsibility, selectedCategory, selectedStatus, currentDate, isAdmin])

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

  // Show loading if auth is still loading OR local loading OR user is not authenticated
  const shouldShowLoading = isLoading || loading || (!user || !user.isAuthenticated)
  
  if (shouldShowLoading && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Loading user profile...
          </p>
        </div>
      </div>
    )
  }
  
  if (shouldShowLoading && loading && user && user.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Loading checklist...
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
          ✓ Done
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
                {isAdmin ? "Daily Checklist Overview" : `${role.charAt(0).toUpperCase() + role.slice(1)} Checklist`} —{" "}
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
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search Field - Takes 2 columns */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tasks (description)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Responsibility Filter - Only for Admins */}
              {isAdmin && (
                <div className="flex justify-start w-full">
                  <Select value={selectedResponsibility} onValueChange={setSelectedResponsibility}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Responsibilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Responsibilities</SelectItem>
                      {uniqueResponsibilities.map(responsibility => (
                        <SelectItem key={responsibility} value={responsibility}>
                          {formatResponsibility(responsibility)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex justify-start w-full">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
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
              <div className="flex justify-start w-full">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Statuses" />
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
        </div>

        {/* Task List */}
        <Card className="card-surface mb-6">
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto px-4">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={isAdmin ? "w-[20%] py-3" : "w-[25%] py-3"}>Title & Description</TableHead>
                        {isAdmin && <TableHead className="w-[15%] py-3">Responsibility</TableHead>}
                        <TableHead className="w-[15%] py-3">Category</TableHead>
                        <TableHead className="w-[15%] py-3">Timing</TableHead>
                        <TableHead className="w-[10%] py-3">Due Time</TableHead>
                        <TableHead className="w-[10%] py-3">Status</TableHead>
                        <TableHead className={isAdmin ? "w-[10%] py-3 text-center" : "w-[30%] py-3 text-center"}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={`${task.id}-${refreshKey}`}>
                          <TableCell className="py-3">
                            <div className="max-w-full">
                              <div className="font-medium truncate">{task.master_task.title}</div>
                              {task.master_task.description && (
                                <div className="text-sm text-gray-600 truncate">
                                  {task.master_task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="py-3">
                              <div className="max-w-full overflow-hidden">
                                <div className="flex flex-wrap gap-1">
                                  {renderBadgesWithTruncation(task.master_task.responsibility, 2, 'responsibility')}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="py-3">
                            <div className="max-w-full overflow-hidden">
                              <div className="flex flex-wrap gap-1">
                                {renderBadgesWithTruncation(task.master_task.categories, 2, 'category')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge className={`capitalize ${getTimingColor(task.master_task.timing)}`}>
                              {task.master_task.timing.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            {task.master_task.due_time ? (
                              <span className="text-sm font-medium">{task.master_task.due_time}</span>
                            ) : (
                              <span className="text-sm text-gray-500">No due time</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">{getStatusBadge(task)}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center space-x-2">
                              {task.status === "completed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTaskUndo(task.id)}
                                  disabled={processingTasks.has(task.id)}
                                  className="border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400 font-medium disabled:opacity-50"
                                >
                                  {processingTasks.has(task.id) ? (
                                    <span className="flex items-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-1"></div>
                                      Processing...
                                    </span>
                                  ) : (
                                    <span>✓ Done</span>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={processingTasks.has(task.id)}
                                  className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50"
                                >
                                  {processingTasks.has(task.id) ? (
                                    <span className="flex items-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                      Processing...
                                    </span>
                                  ) : (
                                    <span>Done ?</span>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewDetails(task)}
                                title="View Details"
                                className="hover:bg-gray-100"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="ml-1">Details</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card Layout */}
                <div className="lg:hidden space-y-4 p-4">
                  {filteredTasks.map((task) => (
                    <Card key={`${task.id}-${refreshKey}`} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Title and Description */}
                          <div>
                            <h3 className="font-medium text-base truncate">{task.master_task.title}</h3>
                            {task.master_task.description && (
                              <p className="text-sm text-gray-600 mt-1 truncate">{task.master_task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="space-y-3 text-sm">
                            {isAdmin && (
                              <div>
                                <span className="text-gray-500">Responsibility:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {renderBadgesWithTruncation(task.master_task.responsibility, 3, 'responsibility')}
                                </div>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Categories:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {renderBadgesWithTruncation(task.master_task.categories, 3, 'category')}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Timing:</span>
                              <div className="mt-1">
                                <Badge className={`capitalize text-xs ${getTimingColor(task.master_task.timing)}`}>
                                  {task.master_task.timing.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Due Time:</span>
                              <div className="mt-1 font-medium">
                                {task.master_task.due_time ? (
                                  <span>{task.master_task.due_time}</span>
                                ) : (
                                  <span className="text-gray-400">No due time</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex flex-col space-y-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                {getStatusBadge(task)}
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              {task.status === "completed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTaskUndo(task.id)}
                                  disabled={processingTasks.has(task.id)}
                                  className="flex-1 border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400 font-medium disabled:opacity-50"
                                >
                                  {processingTasks.has(task.id) ? (
                                    <span className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-1"></div>
                                      Processing...
                                    </span>
                                  ) : (
                                    <span>✓ Done</span>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleTaskComplete(task.id)}
                                  disabled={processingTasks.has(task.id)}
                                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50"
                                >
                                  {processingTasks.has(task.id) ? (
                                    <span className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                      Processing...
                                    </span>
                                  ) : (
                                    <span>Done ?</span>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDetails(task)}
                                title="View Details"
                                className="hover:bg-gray-100"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="ml-1">Details</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Finish Button - Auto-logout when all tasks completed (only for non-admin users) */}
        {!isAdmin && allTasksCompleted && (
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

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        task={selectedTask}
        onTaskUpdate={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}
