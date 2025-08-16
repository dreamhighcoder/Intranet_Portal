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
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  Users
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as XLSX from 'xlsx'

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
        category?: string
        positions: {
          name: string
        }
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
        category?: string
        positions: {
          name: string
        }
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
  completed: '#4CAF50',
  pending: '#2196F3',
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
  
  // Filters
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [selectedPosition, setSelectedPosition] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [activeReportType, setActiveReportType] = useState<string>("overview")

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

  useEffect(() => {
    if (user && isAdmin) {
      loadReports()
    }
  }, [dateRange, selectedPosition, selectedCategory, activeReportType])

  const loadPositions = async () => {
    try {
      const positionsData = await positionsApi.getAll()
      // Filter out administrator positions
      const filteredPositions = positionsData.filter(position => {
        const isAdminPosition = position.role === 'admin' || 
                               position.name.toLowerCase().includes('admin') || 
                               position.displayName?.toLowerCase().includes('admin')
        return !isAdminPosition
      })
      setPositions(filteredPositions)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      const startDate = dateRange.from.toISOString().split('T')[0]
      const endDate = dateRange.to.toISOString().split('T')[0]
      
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
        setReportData({
          [activeReportType.replace('-', '')]: results[0]
        })
      }
      
    } catch (error) {
      console.error('Error loading reports:', error)
      toastError("Error", "Failed to load report data")
    } finally {
      setLoading(false)
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
          ['Task Title', 'Category', 'Position', 'Due Date'],
          ...reportData.missedTasks.missedTasks.map(task => [
            task.master_tasks.title,
            task.master_tasks.category || 'N/A',
            task.master_tasks.positions.name,
            task.due_date
          ])
        ]
        const missedSheet = XLSX.utils.aoa_to_sheet(missedData)
        XLSX.utils.book_append_sheet(workbook, missedSheet, 'Missed Tasks')
      }
      
      // Export outstanding tasks data
      if (reportData.outstandingTasks?.outstandingTasks) {
        const outstandingData = [
          ['Task Title', 'Status', 'Category', 'Position', 'Due Date'],
          ...reportData.outstandingTasks.outstandingTasks.map(task => [
            task.master_tasks.title,
            task.status,
            task.master_tasks.category || 'N/A',
            task.master_tasks.positions.name,
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
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: COLORS[status as keyof typeof COLORS] || COLORS.primary
    }))

    // Prepare bar chart data for missed tasks by position
    const positionData = Object.entries(reportData.missedByPosition.positionStats || {}).map(([position, count]) => ({
      position,
      missed: count
    }))

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Task Status Distribution */}
        <Card>
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        <Card>
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
                <Tooltip />
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
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Outstanding Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.outstandingTasks.outstandingTasks.slice(0, 10).map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.master_tasks.title}</TableCell>
                  <TableCell>{task.master_tasks.positions.name}</TableCell>
                  <TableCell>{task.master_tasks.category || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={
                      task.status === 'overdue' 
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    }>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Reports & Analytics</h1>
          <p className="text-[var(--color-text-secondary)]">
            Comprehensive reporting and analytics for pharmacy task management
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
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
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
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
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Position Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {TASK_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="flex space-x-2">
                <Button
                  variant={activeReportType === "overview" ? "default" : "outline"}
                  onClick={() => setActiveReportType("overview")}
                >
                  Overview
                </Button>
                <Button
                  variant={activeReportType === "completion-rate" ? "default" : "outline"}
                  onClick={() => setActiveReportType("completion-rate")}
                >
                  Completion Rate
                </Button>
                <Button
                  variant={activeReportType === "missed-tasks" ? "default" : "outline"}
                  onClick={() => setActiveReportType("missed-tasks")}
                >
                  Missed Tasks
                </Button>
              </div>
              
              <Button onClick={exportToExcel} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {reportData.completionRate && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.totalTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.completedTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Completion Rate</p>
                    <p className="text-lg font-semibold">{reportData.completionRate.completionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="w-4 h-4 text-orange-600" />
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
                    <TableHead>Task</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.missedTasks.missedTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.master_tasks.title}</TableCell>
                      <TableCell>{task.master_tasks.positions.name}</TableCell>
                      <TableCell>{task.master_tasks.category || 'N/A'}</TableCell>
                      <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
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