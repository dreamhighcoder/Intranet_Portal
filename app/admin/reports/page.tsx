"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { authenticatedGet, positionsApi } from "@/lib/api-client"
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { TASK_CATEGORIES } from "@/lib/constants"
import { formatAustralianDate } from "@/lib/timezone-utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import {
  CalendarIcon,
  Download,
  TrendingUp,
  Clock,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  Users,
  Loader2
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as XLSX from 'xlsx'

// Helper functions for formatting and styling
const formatResponsibility = (responsibility: string) => {
  // Convert kebab-case or snake_case to proper display format
  return responsibility
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bDaa\b/g, 'DAA') // Special case for DAA
}

const formatCategory = (category: string) => {
  // Convert kebab-case to proper display format
  return category
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bFos\b/g, 'FOS') // Special case for FOS
}

const formatStatus = (status: string) => {
  // Convert snake_case to proper display format and add icons for specific statuses
  const formatted = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
  
  // Add icons for specific statuses to match checklist page
  switch (status) {
    case 'missed':
      return '❌ Missed'
    case 'done':
      return '✓ Completed'
    case 'overdue':
      return '⚠️ Overdue'
    case 'due_today':
      return '⏰ Due Today'
    case 'not_due':
      return '📅 Not Due Yet'
    default:
      return formatted
  }
}

// Helper to get responsibility badge color (consistent hash-based coloring)
const getResponsibilityBadgeColor = (responsibility: string) => {
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-orange-100 text-orange-800 border-orange-200'
  ]
  // Simple hash function to consistently assign colors
  let hash = 0
  for (let i = 0; i < responsibility.length; i++) {
    hash = ((hash << 5) - hash + responsibility.charCodeAt(i)) & 0xffffffff
  }
  return colors[Math.abs(hash) % colors.length]
}

// Helper to get category badge color
const getCategoryBadgeColor = (category: string) => {
  const colorMap: Record<string, string> = {
    'stock-control': 'bg-blue-50 text-blue-700 border-blue-100',
    'compliance': 'bg-red-50 text-red-700 border-red-100',
    'cleaning': 'bg-green-50 text-green-700 border-green-100',
    'pharmacy-services': 'bg-purple-50 text-purple-700 border-purple-100',
    'fos-operations': 'bg-amber-50 text-amber-700 border-amber-100',
    'dispensary-operations': 'bg-teal-50 text-teal-700 border-teal-100',
    'general-pharmacy-operations': 'bg-cyan-50 text-cyan-700 border-cyan-100',
    'business-management': 'bg-indigo-50 text-indigo-700 border-indigo-100'
  }
  return colorMap[category] || 'bg-gray-50 text-gray-700 border-gray-100'
}

// Helper to get status badge color
const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'done':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'missed':
      return 'bg-gray-800 text-white border-gray-600'
    case 'due_today':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'not_due':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

// Helper to render truncated badges with "+(n)" format
const renderTruncatedBadges = (
  items: string[],
  maxVisible: number,
  type: 'responsibility' | 'category',
  variant: 'outline' | 'secondary' = 'outline'
) => {
  if (!items || items.length === 0) {
    return <span className="text-gray-500 text-sm">N/A</span>
  }

  const visibleItems = items.slice(0, maxVisible)
  const remainingCount = items.length - maxVisible

  const getDisplayName = (item: string) => {
    return type === 'responsibility' ? formatResponsibility(item) : formatCategory(item)
  }

  const getBadgeColor = (item: string) => {
    return type === 'responsibility' ? getResponsibilityBadgeColor(item) : getCategoryBadgeColor(item)
  }

  return (
    <div className="flex flex-wrap gap-1 w-full">
      {visibleItems.map((item, index) => {
        const displayName = getDisplayName(item)
        const badgeClass = getBadgeColor(item)

        return (
          <Badge
            key={index}
            variant={variant}
            className={`text-xs truncate ${badgeClass}`}
            title={displayName}
          >
            {displayName}
          </Badge>
        )
      })}
      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className="text-xs bg-gray-100"
          title={`${remainingCount} more: ${items.slice(maxVisible).map(item => getDisplayName(item)).join(', ')}`}
        >
          + {remainingCount}
        </Badge>
      )}
    </div>
  )
}

interface Position {
  id: string
  name: string
}

interface ReportData {
  completionRate?: {
    totalTasks: number
    completedTasks: number
    onTimeCompletions: number
    completionRate: number
    onTimeRate: number
  }
  averageCompletionTime?: {
    averageCompletionTimeHours: number
    totalCompletedTasks: number
  }
  missedTasks?: {
    totalMissedTasks: number
    missedTasks: Array<{
      id: string
      due_date: string
      master_tasks: {
        title: string
        description?: string
        categories?: string[]
        responsibility?: string[]
      }
    }>
  }
  missedByPosition?: {
    totalMissedTasks: number
    positionStats: Record<string, number>
  }
  outstandingTasks?: {
    totalOutstandingTasks: number
    outstandingTasks: Array<{
      id: string
      status: string
      due_date: string
      master_tasks: {
        title: string
        description?: string
        categories?: string[]
        responsibility?: string[]
      }
    }>
  }
  taskSummary?: {
    totalTasks: number
    statusCounts: Record<string, number>
    tasks: Array<any>
  }
}

const COLORS = {
  done: '#4CAF50',
  completed: '#4CAF50',
  pending: '#2196F3',
  not_due: '#2196F3',
  due_today: '#2196F3',
  overdue: '#FF9800',
  missed: '#F44336',
  primary: '#1976D2'
}

export default function ReportsPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const router = useRouter()

  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData>({})
  const [loadingButton, setLoadingButton] = useState<string | null>(null)

  // Filters
  const [dateRange, setDateRange] = useState({
    // Initialize using AU calendar days to avoid client TZ skew
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [selectedPosition, setSelectedPosition] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [activeReportType, setActiveReportType] = useState<string>("overview")
  const [fromDateOpen, setFromDateOpen] = useState(false)
  const [toDateOpen, setToDateOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push("/")
    }
  }, [user, authLoading, isAdmin, router])

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      loadPositions()
      loadReports()
    }
  }, [authLoading, user, isAdmin])

  // Reset loading button state when loading completes
  useEffect(() => {
    if (!loading) {
      setLoadingButton(null)
    }
  }, [loading])

  // Remove automatic loading when filters change - now controlled by manual button click

  const handleReportTypeChange = (reportType: string) => {
    setLoadingButton(reportType)
    setActiveReportType(reportType)
    // Always trigger data loading when report type is changed
    if (user && isAdmin) {
      loadReports()
    }
  }

  const loadPositions = async () => {
    try {
      const positionsData = await positionsApi.getAll()
      // Filter out only exact 'Administrator'
      const filteredPositions = positionsData.filter((position: Position) => position.name !== 'Administrator')
      setPositions(filteredPositions)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }

  const loadReports = async () => {
    // Only show full page loading on initial load
    if (!reportData.completionRate && !reportData.missedTasks) {
      setLoading(true)
    }
    
    try {
      // Use AU timezone-based formatting to avoid UTC skew in Netlify/prod
      const startDate = formatAustralianDate(dateRange.from)
      const endDate = formatAustralianDate(dateRange.to)

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })

      if (selectedPosition !== "all") {
        params.append('position_id', selectedPosition)
      }

      if (selectedCategory !== "all") {
        params.append('category', selectedCategory)
      }

      // Load multiple report types based on active report
      const reportPromises: Promise<any>[] = []

      if (activeReportType === "overview") {
        reportPromises.push(
          authenticatedGet(`/api/reports?type=completion-rate&${params.toString()}`),
          authenticatedGet(`/api/reports?type=task-summary&${params.toString()}`),
          authenticatedGet(`/api/reports?type=missed-by-position&${params.toString()}`),
          authenticatedGet(`/api/reports?type=outstanding-tasks&${params.toString()}`)
        )
      } else {
        reportPromises.push(
          authenticatedGet(`/api/reports?type=${activeReportType}&${params.toString()}`)
        )
      }

      const results = await Promise.all(reportPromises)

      if (activeReportType === "overview") {

        setReportData({
          completionRate: results[0],
          taskSummary: results[1],
          missedByPosition: results[2],
          outstandingTasks: results[3]
        })
      } else {
        // Map the single result to the correct key in reportData
        const keyMap: Record<string, keyof ReportData> = {
          'completion-rate': 'completionRate',
          'average-completion-time': 'averageCompletionTime',
          'missed-tasks': 'missedTasks',
          'missed-by-position': 'missedByPosition',
          'outstanding-tasks': 'outstandingTasks',
          'task-summary': 'taskSummary',
        }
        const mappedKey = keyMap[activeReportType]
        if (mappedKey) {
          setReportData({ [mappedKey]: results[0] } as ReportData)
        } else {
          setReportData({})
        }
      }

    } catch (error) {
      console.error('Error loading reports:', error)
      toastError("Error", "Failed to load report data")
    } finally {
      setLoading(false)
      setLoadingButton(null)
    }
  }

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new()

      // Export completion rate data
      if (reportData.completionRate) {
        const completionData = [
          ['Metric', 'Value'],
          ['Total Tasks', reportData.completionRate.totalTasks],
          ['Completed Tasks', reportData.completionRate.completedTasks],
          ['On-Time Completions', reportData.completionRate.onTimeCompletions],
          ['Completion Rate (%)', reportData.completionRate.completionRate],
          ['On-Time Rate (%)', reportData.completionRate.onTimeRate]
        ]
        const completionSheet = XLSX.utils.aoa_to_sheet(completionData)
        XLSX.utils.book_append_sheet(workbook, completionSheet, 'Completion Rate')
      }

      // Export missed tasks data
      if (reportData.missedTasks?.missedTasks) {
        const missedData = [
          ['Task Title', 'Category', 'Responsibility', 'Due Date'],
          ...reportData.missedTasks.missedTasks.map(task => [
            task.master_tasks.title,
            task.master_tasks.categories?.join(', ') || 'N/A',
            task.master_tasks.responsibility?.join(', ') || 'N/A',
            task.due_date
          ])
        ]
        const missedSheet = XLSX.utils.aoa_to_sheet(missedData)
        XLSX.utils.book_append_sheet(workbook, missedSheet, 'Missed Tasks')
      }

      // Export outstanding tasks data
      if (reportData.outstandingTasks?.outstandingTasks) {
        const outstandingData = [
          ['Task Title', 'Status', 'Category', 'Responsibility', 'Due Date'],
          ...reportData.outstandingTasks.outstandingTasks.map(task => [
            task.master_tasks.title,
            task.status,
            task.master_tasks.categories?.join(', ') || 'N/A',
            task.master_tasks.responsibility?.join(', ') || 'N/A',
            task.due_date
          ])
        ]
        const outstandingSheet = XLSX.utils.aoa_to_sheet(outstandingData)
        XLSX.utils.book_append_sheet(workbook, outstandingSheet, 'Outstanding Tasks')
      }

      // Generate and download file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `pharmacy_reports_${new Date().toISOString().split('T')[0]}.xlsx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toastSuccess("Export Successful", "Reports exported to Excel successfully")
    } catch (error) {
      console.error('Error exporting reports:', error)
      toastError("Export Failed", "Failed to export reports")
    }
  }

  const renderOverviewCharts = () => {
    if (!reportData.taskSummary || !reportData.missedByPosition) return null

    // Prepare pie chart data for task status
    const statusData = Object.entries(reportData.taskSummary.statusCounts || {}).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
      color: COLORS[status as keyof typeof COLORS] || COLORS.primary
    }))

    // Abbreviation mapping for roles when labels don't fit
    const ABBR_MAP: Record<string, string> = {
      'pharmacy-assistant-s': 'PA',
      'pharmacy-assistant': 'PA',
      'dispensary-technician-s': 'DT',
      'dispensary-technician': 'DT',
      'daa-packer-s': 'DP',
      'daa-packer': 'DP',
      'pharmacist-primary': 'PH1',
      'pharmacist-supporting': 'PH2',
      'operational-managerial': 'OM',
    }

    // Normalize position name to kebab-case for lookup
    const toKebab = (name: string) =>
      name
        .toLowerCase()
        .replace(/\//g, ' ')
        .replace(/\(|\)|,/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s/g, '-')

    const abbreviatePosition = (name: string) => {
      const key = toKebab(name)
      return ABBR_MAP[key] || name
    }

    // Build bar chart data ensuring ALL positions are shown, defaulting to 0
    const statsMap = reportData.missedByPosition.positionStats || {}
    const positionData = positions.map((p) => ({
      position: abbreviatePosition(p.name), // label (may be abbreviated)
      fullPosition: p.name,                 // original name
      missed: statsMap[p.name] || 0,
    }))

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Task Status Distribution */}
        <Card className="bg-white border border-[var(--color-border)]">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChartIcon className="w-5 h-5" />
              <span>Task Status Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Missed Tasks by Position */}
        <Card className="bg-white border border-[var(--color-border)]">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Missed Tasks by Position</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={positionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as { fullPosition?: string; position: string; missed: number }
                    return (
                      <div className="bg-white p-2 border rounded shadow text-sm">
                        <div className="font-medium">{item.fullPosition || label}</div>
                        <div>Missed: {item.missed}</div>
                      </div>
                    )
                  }
                  return null
                }} />
                <Bar dataKey="missed" fill={COLORS.missed} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderOutstandingTasksTable = () => {
    if (!reportData.outstandingTasks?.outstandingTasks) return null

    return (
      <Card className="bg-white border border-[var(--color-border)] mt-6 gap-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Outstanding Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table Layout */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Task</TableHead>
                  <TableHead className="w-[20%]">Responsibility</TableHead>
                  <TableHead className="w-[20%]">Category</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="w-[10%]">Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.outstandingTasks.outstandingTasks.slice(0, 10).map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="py-3">
                      <div className="max-w-full">
                        <div className="font-medium truncate">{task.master_tasks.title}</div>
                        {task.master_tasks.description && (
                          <div className="text-sm text-gray-600 truncate mt-1">
                            {task.master_tasks.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="max-w-full overflow-hidden">
                        {renderTruncatedBadges(task.master_tasks.responsibility || [], 2, 'responsibility')}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="max-w-full overflow-hidden">
                        {renderTruncatedBadges(task.master_tasks.categories || [], 2, 'category')}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusBadgeColor(task.status)}`}
                      >
                        {formatStatus(task.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm">{new Date(task.due_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="lg:hidden space-y-4">
            {reportData.outstandingTasks.outstandingTasks.slice(0, 10).map((task) => (
              <Card key={task.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Title and Description */}
                    <div>
                      <h3 className="font-medium text-base">{task.master_tasks.title}</h3>
                      {task.master_tasks.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.master_tasks.description}</p>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500 font-medium">Responsibility:</span>
                        <div className="mt-1">
                          {renderTruncatedBadges(task.master_tasks.responsibility || [], 3, 'responsibility')}
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-500 font-medium">Category:</span>
                        <div className="mt-1">
                          {renderTruncatedBadges(task.master_tasks.categories || [], 3, 'category')}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-gray-500 font-medium">Status:</span>
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusBadgeColor(task.status)}`}
                            >
                              {formatStatus(task.status)}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-500 font-medium">Due Date:</span>
                          <div className="mt-1 text-sm font-medium">
                            {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {reportData.outstandingTasks.outstandingTasks.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">
              Showing 10 of {reportData.outstandingTasks.outstandingTasks.length} outstanding tasks
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        <div className="pharmacy-gradient rounded-lg p-4 sm:p-6 text-white mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Reports & Analytics</h1>
          <p className="text-white/90 text-sm sm:text-base">
            Comprehensive reporting and analytics for pharmacy task management
          </p>
        </div>

        {/* Filters */}
        <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 gap-4 mb-6">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.from.toLocaleDateString()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => {
                        if (date) {
                          setDateRange(prev => ({ ...prev, from: date }))
                          setFromDateOpen(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.to.toLocaleDateString()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => {
                        if (date) {
                          setDateRange(prev => ({ ...prev, to: date }))
                          setToDateOpen(false)
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Position Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {positions.map(position => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {TASK_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3 gap-3">
                  {/* Overview Button */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button
                      variant={activeReportType === "overview" ? "default" : "outline"}
                      onClick={() => handleReportTypeChange("overview")}
                      className={`w-full ${activeReportType === "overview" ? "text-white" : ""}`}
                      disabled={loadingButton === "overview"}
                    >
                      {loadingButton === "overview" ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Overview</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Missed Tasks Button */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button
                      variant={activeReportType === "missed-tasks" ? "default" : "outline"}
                      onClick={() => handleReportTypeChange("missed-tasks")}
                      className={`w-full ${activeReportType === "missed-tasks" ? "text-white" : ""}`}
                      disabled={loadingButton === "missed-tasks"}
                    >
                      {loadingButton === "missed-tasks" ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          <span>Missed Tasks</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button onClick={exportToExcel} variant="outline" className="w-full">
                      <Download className="w-4 h-4" />
                      Export Excel
                    </Button>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* KPI Cards */}
        {reportData.completionRate && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.totalTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.completedTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completion Rate</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.completionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-[var(--color-border)] py-4 flex flex-col sm:flex-row gap-4">
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">On-Time Rate</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.onTimeRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts and Tables */}
        {activeReportType === "overview" && renderOverviewCharts()}
        {activeReportType === "overview" && renderOutstandingTasksTable()}

        {/* Specific Report Views */}
        {activeReportType === "missed-tasks" && reportData.missedTasks && (
          <Card>
            <CardHeader>
              <CardTitle>Missed Tasks Report</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg mb-4">Total Missed Tasks: {reportData.missedTasks.totalMissedTasks}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Task</TableHead>
                    <TableHead className="w-[25%]">Responsibility</TableHead>
                    <TableHead className="w-[25%]">Category</TableHead>
                    <TableHead className="w-[10%]">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.missedTasks.missedTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="py-3">
                        <div className="max-w-full">
                          <div className="font-medium truncate">{task.master_tasks.title}</div>
                          {task.master_tasks.description && (
                            <div className="text-sm text-gray-600 truncate mt-1">
                              {task.master_tasks.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="max-w-full overflow-hidden">
                          {renderTruncatedBadges(task.master_tasks.responsibility || [], 2, 'responsibility')}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="max-w-full overflow-hidden">
                          {renderTruncatedBadges(task.master_tasks.categories || [], 2, 'category')}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">{new Date(task.due_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}