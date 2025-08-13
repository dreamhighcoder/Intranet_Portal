"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { Navigation } from "@/components/navigation"
import { MasterTaskForm } from "@/components/master-task-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { masterTasksApi, positionsApi } from "@/lib/api-client"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  Menu
} from "lucide-react"

interface MasterTask {
  id: string
  title: string
  description?: string
  frequency: string
  category?: string
  timing?: string
  publish_status: 'draft' | 'active' | 'inactive'
  default_due_time?: string
  position?: {
    id: string
    name: string
  }
  positions?: {
    id: string
    name: string
  }
  weekdays?: number[]
  months?: number[]
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
  publish_delay_date?: string
}

interface Position {
  id: string
  name: string
}

const frequencyLabels = {
  once_off_sticky: 'Once-off Sticky',
  every_day: 'Every Day',
  weekly: 'Weekly',
  specific_weekdays: 'Specific Weekdays',
  start_every_month: 'Start Every Month',
  start_certain_months: 'Start Certain Months',
  every_month: 'Every Month',
  certain_months: 'Certain Months',
  end_every_month: 'End Every Month',
  end_certain_months: 'End Certain Months'
}

export default function AdminMasterTasksPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPosition, setFilterPosition] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  useEffect(() => {
    // Wait for authentication to complete before loading data
    if (!authLoading && user && user.profile?.role === 'admin') {
      console.log('Authentication complete, loading data for admin user:', user.email)
      loadData()
    } else if (!authLoading && !user) {
      console.log('Authentication complete but no user found')
    } else if (!authLoading && user && user.profile?.role !== 'admin') {
      console.log('Authentication complete but user is not admin:', user.profile?.role)
    }
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('Loading master tasks and positions...')
      const [tasksData, positionsData] = await Promise.all([
        masterTasksApi.getAll({ status: 'all' }), // Get all tasks for admin interface
        positionsApi.getAll()
      ])
      console.log('Loaded tasks:', tasksData.length)
      console.log('Loaded positions:', positionsData.length)
      setTasks(tasksData)
      setPositions(positionsData)
    } catch (error) {
      console.error('Error loading data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert('error', `Failed to load data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'active' | 'inactive') => {
    try {
      await masterTasksApi.update(taskId, { publish_status: newStatus })
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, publish_status: newStatus } : task
      ))
      showAlert('success', `Task ${newStatus} successfully`)
    } catch (error) {
      console.error('Error updating task status:', error)
      showAlert('error', 'Failed to update task status')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This will also delete all associated task instances.')) {
      return
    }

    setDeletingTaskId(taskId)
    try {
      console.log('Deleting task:', taskId)
      await masterTasksApi.delete(taskId)
      console.log('Task deleted successfully')
      setTasks(tasks.filter(task => task.id !== taskId))
      showAlert('success', 'Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert('error', `Failed to delete task: ${errorMessage}`)
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleSaveTask = async (taskData: any) => {
    setFormLoading(true)
    try {
      console.log('Saving task data:', taskData)
      
      if (editingTask) {
        // Update existing task
        console.log('Updating task:', editingTask.id)
        const updatedTask = await masterTasksApi.update(editingTask.id, taskData)
        console.log('Task updated:', updatedTask)
        setTasks(tasks.map(task => 
          task.id === editingTask.id ? updatedTask : task
        ))
        showAlert('success', 'Task updated successfully')
      } else {
        // Create new task
        console.log('Creating new task')
        const newTask = await masterTasksApi.create(taskData)
        console.log('Task created:', newTask)
        setTasks([...tasks, newTask])
        showAlert('success', 'Task created successfully')
      }
      
      setIsTaskDialogOpen(false)
      setEditingTask(null)
    } catch (error) {
      console.error('Error saving task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showAlert('error', `Failed to ${editingTask ? 'update' : 'create'} task: ${errorMessage}`)
    } finally {
      setFormLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setIsTaskDialogOpen(false)
    setEditingTask(null)
  }

  const handleGenerateInstances = async (taskId?: string) => {
    try {
      const response = await fetch(`/api/jobs/generate-instances?mode=custom${taskId ? `&masterTaskId=${taskId}` : ''}`)
      const result = await response.json()
      
      if (result.success) {
        showAlert('success', `Generated ${result.stats.generated} task instances`)
      } else {
        showAlert('error', result.message)
      }
    } catch (error) {
      console.error('Error generating instances:', error)
      showAlert('error', 'Failed to generate instances')
    }
  }



  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesPosition = filterPosition === 'all' || (task.positions?.id || task.position?.id) === filterPosition
    const matchesStatus = filterStatus === 'all' || task.publish_status === filterStatus
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory

    return matchesSearch && matchesPosition && matchesStatus && matchesCategory
  })

  // Get unique categories for filter
  const categories = Array.from(new Set(tasks.map(task => task.category).filter(Boolean)))

  // Show loading spinner while authentication is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show access denied if user is not authenticated or not an admin
  if (!user || user.profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 lg:p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">Master Tasks Management</h1>
                <p className="text-white/90 text-sm lg:text-base">Manage the central checklist that generates all task instances</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <Button
                  onClick={() => {
                    setEditingTask(null)
                    setIsTaskDialogOpen(true)
                  }}
                  className="bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
                <Button
                  onClick={() => handleGenerateInstances()}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full sm:w-auto"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate All
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <Alert className={`mb-6 ${alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <AlertDescription className={alert.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Debug Info - Remove this after testing */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-blue-800 mb-2">Authentication Status</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div>Auth Loading: {authLoading ? 'Yes' : 'No'}</div>
              <div>User: {user ? user.email : 'None'}</div>
              <div>Role: {user?.profile?.role || 'None'}</div>
              <div>Position: {user?.profile?.position_id || 'None'}</div>
              <div>Tasks Loaded: {tasks.length}</div>
              <div>Positions Loaded: {positions.length}</div>
            </div>
          </CardContent>
        </Card>



        {/* Filters */}
        <Card className="card-surface mb-6">
          <CardContent className="pt-4 lg:pt-6">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden mb-4">
              <Button
                variant="outline"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="w-full justify-between"
              >
                <span className="flex items-center">
                  <Menu className="w-4 h-4 mr-2" />
                  Filters & Actions
                </span>
                {showMobileFilters ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Search - Always visible */}
            <div className="mb-4 lg:mb-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters - Hidden on mobile unless toggled */}
            <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Positions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {positions?.map(position => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="card-surface">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg lg:text-xl">
                Master Tasks ({filteredTasks.length} of {tasks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading tasks...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-gray-600 truncate max-w-xs">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{task.positions?.name || task.position?.name || 'Unknown Position'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {frequencyLabels[task.frequency as keyof typeof frequencyLabels]}
                              {task.timing && (
                                <div className="text-xs text-gray-500">{task.timing}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.category ? (
                              <Badge variant="outline" className="text-xs">
                                {task.category}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={task.publish_status}
                              onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                handleStatusChange(task.id, value)
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Clock className="w-3 h-3 mr-1 text-gray-400" />
                              {task.default_due_time || '17:00'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateInstances(task.id)}
                                title="Generate instances for this task"
                              >
                                <Calendar className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingTask(task)
                                  setIsTaskDialogOpen(true)
                                }}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTaskId === task.id}
                                className="text-red-600 hover:text-red-700"
                              >
                                {deletingTaskId === task.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-4">
                  {filteredTasks.map((task) => (
                    <Card key={task.id} className="border border-gray-200">
                      <CardContent className="mobile-card p-4">
                        <div className="space-y-3">
                          {/* Title and Description */}
                          <div>
                            <h3 className="font-medium text-base">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Position:</span>
                              <div className="font-medium">{task.positions?.name || task.position?.name || 'Unknown Position'}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Frequency:</span>
                              <div className="font-medium">
                                {frequencyLabels[task.frequency as keyof typeof frequencyLabels]}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Category:</span>
                              <div>
                                {task.category ? (
                                  <Badge variant="outline" className="text-xs">
                                    {task.category}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Due Time:</span>
                              <div className="flex items-center font-medium">
                                <Clock className="w-3 h-3 mr-1 text-gray-400" />
                                {task.default_due_time || '17:00'}
                              </div>
                            </div>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex flex-col space-y-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <Select
                                  value={task.publish_status}
                                  onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                    handleStatusChange(task.id, value)
                                  }
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateInstances(task.id)}
                                  title="Generate instances"
                                >
                                  <Calendar className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingTask(task)
                                    setIsTaskDialogOpen(true)
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  {deletingTaskId === task.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No tasks found matching your filters.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Task Creation/Edit Dialog */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="dialog-content max-w-6xl w-[95vw] sm:w-[90vw] max-h-[95vh] h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0 pb-4 border-b">
              <DialogTitle className="text-xl font-semibold">
                {editingTask ? 'Edit Master Task' : 'Create New Master Task'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <MasterTaskForm
                task={editingTask}
                positions={positions}
                onSave={handleSaveTask}
                onCancel={handleCancelEdit}
                loading={formLoading}
              />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}