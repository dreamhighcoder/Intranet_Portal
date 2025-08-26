'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { DateNavigator } from '@/components/date-navigator'
import { TaskFilters } from '@/components/task-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Check, X, Eye, LogOut, Settings, ChevronRight, Search, Clock, ChevronUp, ChevronDown } from 'lucide-react'
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
  if (!responsibility) return ''
  const key = responsibility.trim().toLowerCase()

  // Explicit mappings for known formats
  const SPECIAL_MAP: Record<string, string> = {
    'pharmacist-primary': 'Pharmacist (Primary)',
    'pharmacist-supporting': 'Pharmacist (Supporting)',
    'pharmacy-assistant-s': 'Pharmacy Assistant/s',
    'dispensary-technician-s': 'Dispensary Technician/s',
    'daa-packer-s': 'DAA Packer/s',
    'operational-managerial': 'Operational/Managerial',
  }
  if (SPECIAL_MAP[key]) return SPECIAL_MAP[key]

  // Helper to title-case with acronym handling
  const toTitle = (w: string) => {
    if (w.toLowerCase() === 'daa') return 'DAA'
    return w.charAt(0).toUpperCase() + w.slice(1)
  }

  // Pharmacist variants with parentheses
  const pharmacistMatch = key.match(/^pharmacist-(primary|supporting)$/)
  if (pharmacistMatch) {
    return `Pharmacist (${toTitle(pharmacistMatch[1])})`
  }

  // Plural marker: trailing "-s" -> "/s"
  if (key.endsWith('-s')) {
    const base = key.slice(0, -2).split('-').map(toTitle).join(' ')
    return `${base}/s`
  }

  // Default: kebab-case to spaced Title Case
  return key
    .split('-')
    .map(toTitle)
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

// Helper function to format frequency for display
const formatFrequency = (frequency: string | null | undefined) => {
  if (!frequency) {
    return 'Not set'
  }
  return frequency.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Helper function to get frequency badge color
const getFrequencyBadgeColor = (frequency: string | null | undefined) => {
  if (!frequency) {
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const colorMap: Record<string, string> = {
    'once_off': 'bg-purple-100 text-purple-800 border-purple-200',
    'once_off_sticky': 'bg-purple-100 text-purple-800 border-purple-200',
    'every_day': 'bg-blue-100 text-blue-800 border-blue-200',
    'weekly': 'bg-green-100 text-green-800 border-green-200',
    'specific_weekdays': 'bg-green-100 text-green-800 border-green-200',
    'monday': 'bg-green-100 text-green-800 border-green-200',
    'tuesday': 'bg-green-100 text-green-800 border-green-200',
    'wednesday': 'bg-green-100 text-green-800 border-green-200',
    'thursday': 'bg-green-100 text-green-800 border-green-200',
    'friday': 'bg-green-100 text-green-800 border-green-200',
    'saturday': 'bg-green-100 text-green-800 border-green-200',
    'once_weekly': 'bg-green-100 text-green-800 border-green-200',
    'start_every_month': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_every_month': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_certain_months': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jan': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_feb': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_mar': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_apr': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_may': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jun': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jul': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_aug': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_sep': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_oct': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_nov': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_dec': 'bg-amber-100 text-amber-800 border-amber-200',
    'every_month': 'bg-orange-100 text-orange-800 border-orange-200',
    'certain_months': 'bg-orange-100 text-orange-800 border-orange-200',
    'once_monthly': 'bg-orange-100 text-orange-800 border-orange-200',
    'end_every_month': 'bg-red-100 text-red-800 border-red-200',
    'end_of_every_month': 'bg-red-100 text-red-800 border-red-200',
    'end_certain_months': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jan': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_feb': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_mar': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_apr': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_may': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jun': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jul': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_aug': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_sep': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_oct': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_nov': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_dec': 'bg-red-100 text-red-800 border-red-200'
  }
  return colorMap[frequency] || 'bg-indigo-100 text-indigo-800 border-indigo-200'
}

// Helper function to render frequency with additional details
const renderFrequencyWithDetails = (task: ChecklistTask) => {
  // Use frequencies array
  const frequencies = task.master_task.frequencies || []

  if (frequencies.length === 0) {
    return <span className="text-gray-400 text-xs">No frequency set</span>
  }

  return (
    <div className="space-y-2">
      {/* Frequencies */}
      <div className="flex flex-wrap gap-1">
        {frequencies.slice(0, 2).map((freq, index) => (
          <Badge
            key={index}
            className={`text-xs ${getFrequencyBadgeColor(freq)}`}
          >
            {formatFrequency(freq)}
          </Badge>
        ))}
        {frequencies.length > 2 && (
          <Badge
            variant="outline"
            className="text-xs bg-gray-100"
            title={`${frequencies.length - 2} more: ${frequencies.slice(2).map(f => formatFrequency(f)).join(', ')}`}
          >
            +{frequencies.length - 2}
          </Badge>
        )}
      </div>

      {/* Timing */}
      {task.master_task.timing && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">
            {task.master_task.timing.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      )}
    </div>
  )
}

// Sortable Header Component
const SortableHeader = ({
  field,
  children,
  sortField,
  sortDirection,
  onSort,
  className = ""
}: {
  field: string
  children: React.ReactNode
  sortField: string
  sortDirection: 'asc' | 'desc'
  onSort: (field: string) => void
  className?: string
}) => {
  const isActive = sortField === field
  const isCentered = className.includes('text-center')

  return (
    <TableHead
      className={`cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center ${isCentered ? 'justify-center' : 'justify-left'}`}>
        <span>{children}</span>
        <div className={`flex flex-col ${isCentered ? 'ml-1' : 'ml-1'}`}>
          <ChevronUp
            className={`h-3 w-3 ${isActive && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
          />
          <ChevronDown
            className={`h-3 w-3 -mt-1 ${isActive && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
          />
        </div>
      </div>
    </TableHead>
  )
}

// Pagination Component
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1"
      >
        Prev
      </Button>

      {getVisiblePages().map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <span className="px-3 py-1 text-gray-500">...</span>
          ) : (
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 min-w-[40px] ${currentPage === page ? "bg-blue-500 text-white" : ""
                }`}
            >
              {page}
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1"
      >
        Next
      </Button>
    </div>
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



  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const tasksPerPage = 50

  // Sorting state
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

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
      ; (task.master_task.responsibility || []).forEach(resp => responsibilities.add(resp))
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
          console.warn('API reported failure:', data?.error)
          console.warn('Full response object:', JSON.stringify(data, null, 2))
          // Avoid throwing to prevent Next.js unhandled error; show toast and keep UI usable
          setTasks([])
          const message = data?.error || 'Failed to fetch tasks'
          toastError('Error', message)
          return
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

  // Bulk action functions
  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks)
    if (checked) {
      newSelected.add(taskId)
    } else {
      newSelected.delete(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(paginatedTasks.map(task => task.id)))
    } else {
      setSelectedTasks(new Set())
    }
  }

  const handleBulkDelete = () => {
    if (selectedTasks.size === 0) {
      toastError('No Selection', 'Please select tasks to delete')
      return
    }
    setBulkDeleteConfirmModal(true)
  }

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirmModal(false)
    setBulkActionLoading(true)

    try {
      const selectedTaskIds = Array.from(selectedTasks)

      // Delete all selected tasks using the DELETE endpoint
      const deletePromises = selectedTaskIds.map(async (id) => {
        const response = await fetch(`/api/task-instances/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to delete task ${id}`)
        }

        return response.json()
      })

      await Promise.all(deletePromises)

      // Remove from UI
      setTasks(tasks.filter(t => !selectedTasks.has(t.id)))
      setSelectedTasks(new Set())

      toastSuccess('Bulk Delete Complete', `Successfully deleted ${selectedTaskIds.length} task(s)`)

      // Refresh to ensure consistency
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toastError('Bulk Delete Failed', `Failed to delete tasks: ${errorMessage}`)
      // Refresh data to ensure consistency
      setRefreshKey((prev) => prev + 1)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Apply filters and sorting to tasks
  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
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

    // Apply sorting
    if (!sortField) return filtered

    return filtered.sort((a, b) => {
      let aValue: any = ''
      let bValue: any = ''

      switch (sortField) {
        case 'title':
          aValue = a.master_task.description?.toLowerCase() || ''
          bValue = b.master_task.description?.toLowerCase() || ''
          break
        case 'responsibility':
          aValue = a.master_task.responsibility?.[0] || ''
          bValue = b.master_task.responsibility?.[0] || ''
          break
        case 'category':
          aValue = a.master_task.categories?.[0] || ''
          bValue = b.master_task.categories?.[0] || ''
          break
        case 'frequency':
          aValue = a.master_task.frequencies?.[0] || ''
          bValue = b.master_task.frequencies?.[0] || ''
          break
        case 'due_time':
          aValue = a.master_task.due_time || '17:00'
          bValue = b.master_task.due_time || '17:00'
          break
        case 'status':
          aValue = a.status || ''
          bValue = b.status || ''
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [tasks, searchTerm, selectedResponsibility, selectedCategory, selectedStatus, currentDate, isAdmin, sortField, sortDirection])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedTasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedResponsibility, selectedCategory, selectedStatus, currentDate])

  // Get unique categories for filter (use full catalog when empty)
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>()
    tasks.forEach(task => {
      ; (task.master_task.categories || []).forEach(cat => categories.add(cat))
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

  const allTasksCompleted = filteredAndSortedTasks.length > 0 && filteredAndSortedTasks.every((task) => task.status === "completed")

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 pharmacy-gradient rounded-lg p-6">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center space-x-4 mb-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                  {isAdmin ? "Daily Checklist Overview" : `${role.charAt(0).toUpperCase() + role.slice(1)} Checklist`} —{" "}
                  {new Date(currentDate).toLocaleDateString("en-AU", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h1>
              </div>

              <p className="text-white/90">
                {filteredAndSortedTasks.length} tasks • {filteredAndSortedTasks.filter((t) => t.status === "completed").length} completed
                {totalPages > 1 && (
                  <span className="ml-2">
                    • Page {currentPage} of {totalPages}
                  </span>
                )}
              </p>
            </div>

            {/* Checklist Management Button for Administrators */}
            {userRole === 'admin' && (
              <div className="min-w-0">
                <Button
                  asChild
                  variant="outline"
                  className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50 max-w-full"
                >
                  <Link href="/admin/master-tasks" className="flex items-center space-x-2 truncate">
                    <Settings className="w-4 h-4" />
                    <span className="truncate">Master Tasks Management</span>
                  </Link>
                </Button>
              </div>
            )}
          </div>
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
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg lg:text-xl mb-1">
                Tasks ({Math.min(currentPage * tasksPerPage, filteredAndSortedTasks.length)} of {filteredAndSortedTasks.length})
                {totalPages > 1 && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    - Page {currentPage} of {totalPages}
                  </span>
                )}
              </CardTitle>


            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAndSortedTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden xl:block overflow-x-auto px-4">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>

                        <SortableHeader
                          field="title"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className={isAdmin ? "w-[23%] py-3 bg-gray-50" : "w-[30%] py-3 bg-gray-50"}
                        >
                          Title & Description
                        </SortableHeader>
                        {isAdmin && (
                          <SortableHeader
                            field="responsibility"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[16%] py-3 bg-gray-50"
                          >
                            Responsibility
                          </SortableHeader>
                        )}
                        <SortableHeader
                          field="category"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[19%] py-3 bg-gray-50"
                        >
                          Category
                        </SortableHeader>
                        <SortableHeader
                          field="frequency"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[15%] py-3 bg-gray-50"
                        >
                          Frequencies & Timing
                        </SortableHeader>
                        <SortableHeader
                          field="due_time"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[7%] py-3 bg-gray-50 text-left"
                        >
                          Due Time
                        </SortableHeader>
                        <SortableHeader
                          field="status"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[10%] py-3 bg-gray-50"
                        >
                          Status
                        </SortableHeader>
                        <TableHead className="w-[10%] py-3 bg-gray-50">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTasks.map((task) => (
                        <TableRow key={`${task.id}-${refreshKey}`}>

                          <TableCell className="py-3">
                            <div className="max-w-full">
                              {task.master_task.title && task.master_task.title.trim() && (
                                <div className="font-medium truncate">{task.master_task.title}</div>
                              )}
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
                            {renderFrequencyWithDetails(task)}
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
                                <span className="ml-1"></span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card Layout */}
                <div className="xl:hidden space-y-4 p-4">
                  {paginatedTasks.map((task) => (
                    <Card key={`${task.id}-${refreshKey}`} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Title and Description */}
                          <div>
                            {task.master_task.title && task.master_task.title.trim() && (
                              <h3 className="font-medium text-base truncate">{task.master_task.title}</h3>
                            )}
                            {task.master_task.description && (
                              <p className="text-sm text-gray-600 mt-1 truncate">{task.master_task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="space-y-3 text-sm grid sm:grid-cols-2 gap-2">
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

                          </div>

                          <div className="space-y-3 text-sm grid sm:grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Frequencies & Timing:</span>
                              <div className="mt-1">
                                {renderFrequencyWithDetails(task)}
                              </div>
                            </div>
                            <div className="flex grid grid-cols-2 gap-2">
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
                              <div className="items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <div className="mt-1">
                                  {getStatusBadge(task)}
                                </div>
                              </div>
                            </div>
                          </div>


                          {/* Actions */}
                          <div className="flex space-x-2 grid grid-cols-2 gap-2">
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
                                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50"
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
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {filteredAndSortedTasks.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                )}
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
