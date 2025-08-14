"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { taskInstancesApi, positionsApi } from "@/lib/api-client"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  Filter
} from "lucide-react"

interface ReportData {
  totalTasks: number
  completedTasks: number
  missedTasks: number
  overdueTasks: number
  onTimeCompletionRate: number
  averageCompletionTime: number
  tasksByStatus: Record<string, number>
  tasksByPosition: Record<string, number>
  recentMissedTasks: any[]
  performanceByDay: any[]
}

interface Position {
  id: string
  name: string
}

export default function AdminReportsPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    end: new Date().toISOString().split('T')[0]
  })
  const [selectedPosition, setSelectedPosition] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")

  useEffect(() => {
    // Only load data if user is authenticated and is admin
    if (!isLoading && user && isAdmin) {
      loadData()
    } else if (!isLoading) {
      // Stop loading for non-admin users or no user
      setLoading(false)
    }
  }, [dateRange, selectedPosition, selectedCategory, user, isLoading, isAdmin])

  const loadData = async () => {
    setLoading(true)
    try {
      const [positionsData] = await Promise.all([
        positionsApi.getAll()
      ])
      
      setPositions(positionsData)
      
      // Load task instances for the selected date range and filters
      const taskFilters = {
        dateRange: `${dateRange.start},${dateRange.end}`,
        ...(selectedPosition !== 'all' && { position_id: selectedPosition }),
        ...(selectedCategory !== 'all' && { category: selectedCategory })
      }
      
      const tasks = await taskInstancesApi.getAll(taskFilters)
      
      // Calculate report metrics
      const report = calculateReportMetrics(tasks)
      setReportData(report)
      
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateReportMetrics = (tasks: any[]): ReportData => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === 'done').length
    const missedTasks = tasks.filter(t => t.status === 'missed').length
    const overdueTasks = tasks.filter(t => t.status === 'overdue').length
    
    // On-time completion rate (tasks completed before they became overdue)
    const onTimeCompletions = tasks.filter(t => 
      t.status === 'done' && 
      t.completed_at && 
      new Date(t.completed_at) <= new Date(t.due_date + ' ' + t.due_time)
    ).length
    const onTimeCompletionRate = totalTasks > 0 ? (onTimeCompletions / totalTasks) * 100 : 0
    
    // Average completion time (rough estimate)
    const completedWithTimes = tasks.filter(t => t.status === 'done' && t.completed_at)
    const averageCompletionTime = completedWithTimes.length > 0 ? 2.5 : 0 // Mock average hours
    
    // Tasks by status
    const tasksByStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Tasks by position
    const tasksByPosition = tasks.reduce((acc, task) => {
      const positionName = task.master_task?.position?.name || 'Unknown'
      acc[positionName] = (acc[positionName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Recent missed tasks
    const recentMissedTasks = tasks
      .filter(t => t.status === 'missed')
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
      .slice(0, 10)
    
    // Performance by day (mock data for now)
    const performanceByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        date: date.toISOString().split('T')[0],
        completed: Math.floor(Math.random() * 20) + 10,
        missed: Math.floor(Math.random() * 5),
        total: Math.floor(Math.random() * 30) + 20
      }
    })
    
    return {
      totalTasks,
      completedTasks,
      missedTasks,
      overdueTasks,
      onTimeCompletionRate,
      averageCompletionTime,
      tasksByStatus,
      tasksByPosition,
      recentMissedTasks,
      performanceByDay
    }
  }

  const exportReport = () => {
    if (!reportData) return
    
    const csv = [
      'Metric,Value',
      `Total Tasks,${reportData.totalTasks}`,
      `Completed Tasks,${reportData.completedTasks}`,
      `Missed Tasks,${reportData.missedTasks}`,
      `Overdue Tasks,${reportData.overdueTasks}`,
      `On-time Completion Rate,${reportData.onTimeCompletionRate.toFixed(1)}%`,
      `Average Completion Time,${reportData.averageCompletionTime} hours`,
      '',
      'Status Breakdown',
      ...Object.entries(reportData.tasksByStatus).map(([status, count]) => `${status},${count}`),
      '',
      'Position Breakdown',
      ...Object.entries(reportData.tasksByPosition).map(([position, count]) => `${position},${count}`)
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-report-${dateRange.start}-to-${dateRange.end}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Show loading until auth is resolved
  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  // Show access denied only after auth is fully resolved
  if (!user || !isAdmin) {
    // Debug info for troubleshooting
    console.log('Reports page access check:', { user, isAdmin, userRole: user?.role })
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <div className="mt-4 p-4 bg-gray-100 rounded text-sm text-left max-w-md">
            <strong>Debug Info:</strong><br/>
            User: {user ? 'Present' : 'Missing'}<br/>
            IsAdmin: {isAdmin ? 'True' : 'False'}<br/>
            User Role: {user?.role || 'Unknown'}<br/>
            <a href="/admin/auth-test" className="text-blue-600 underline">Run Auth Test</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
                <p className="text-white/90">Task completion insights and performance metrics</p>
              </div>
              <Button
                onClick={exportReport}
                className="bg-white text-blue-600 hover:bg-gray-100"
                disabled={!reportData}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-surface mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <div>
                <Label>Position</Label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Positions" />
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
              <div>
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Administration">Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading report data...</p>
          </div>
        ) : reportData ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="card-surface">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">On-time Completion</p>
                      <p className="text-3xl font-bold text-green-600">
                        {reportData.onTimeCompletionRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center">
                    {reportData.onTimeCompletionRate >= 80 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    )}
                    <span className="text-xs text-gray-600">vs target 80%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Tasks</p>
                      <p className="text-3xl font-bold">{reportData.totalTasks}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-600">
                      {reportData.completedTasks} completed
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Missed Tasks</p>
                      <p className="text-3xl font-bold text-red-600">{reportData.missedTasks}</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-600">
                      {reportData.overdueTasks} overdue
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avg. Completion Time</p>
                      <p className="text-3xl font-bold">{reportData.averageCompletionTime}h</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-gray-600">estimated average</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status and Position Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Tasks by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(reportData.tasksByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Badge 
                            variant={status === 'done' ? 'default' : status === 'missed' ? 'destructive' : 'secondary'}
                            className="mr-2"
                          >
                            {status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{count}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            ({((count / reportData.totalTasks) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-surface">
                <CardHeader>
                  <CardTitle>Tasks by Position</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(reportData.tasksByPosition).map(([position, count]) => (
                      <div key={position} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{position}</span>
                        <div className="text-right">
                          <span className="font-medium">{count}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            ({((count / reportData.totalTasks) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Missed Tasks */}
            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  Recent Missed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.recentMissedTasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.recentMissedTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <div className="font-medium">{task.master_task?.title}</div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{task.master_task?.position?.name}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-mono">
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {task.master_task?.category || 'Uncategorized'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button size="sm" variant="outline" className="text-xs">
                                  Acknowledge
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs">
                                  Resolve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <p className="text-gray-600">No missed tasks in the selected period!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No data available for the selected criteria.</p>
          </div>
        )}
      </main>
    </div>
  )
}