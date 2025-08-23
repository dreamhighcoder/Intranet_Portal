'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import TaskForm from '@/components/admin/TaskFormNew'
import TaskListItem from '@/components/admin/TaskListItem'
import type { MasterChecklistTask, CreateMasterTaskRequest, UpdateMasterTaskRequest } from '@/types/checklist'

// ========================================
// TYPES AND INTERFACES
// ========================================

interface FilterOptions {
  search: string
  publishStatus: string
  frequencyType: string
  category: string
  responsibility: string
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function MasterChecklistPage() {
  const [tasks, setTasks] = useState<MasterChecklistTask[]>([])
  const [filteredTasks, setFilteredTasks] = useState<MasterChecklistTask[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MasterChecklistTask | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    publishStatus: 'all',
    frequencyType: 'all',
    category: 'all',
    responsibility: 'all'
  })

  const { toast } = useToast()

  // ========================================
  // DATA FETCHING
  // ========================================

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [tasks, filters])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/master-tasks')
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }

      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch master tasks',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // ========================================
  // FILTERING
  // ========================================

  const applyFilters = () => {
    let filtered = [...tasks]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(task => 
        task.description?.toLowerCase().includes(searchLower)
      )
    }

    // Publish status filter
    if (filters.publishStatus !== 'all') {
      filtered = filtered.filter(task => task.publish_status === filters.publishStatus)
    }

    // Frequency type filter
    if (filters.frequencyType !== 'all') {
      filtered = filtered.filter(task => task.frequency_rules?.type === filters.frequencyType)
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(task => 
        task.categories?.some(cat => cat === filters.category)
      )
    }

    // Responsibility filter
    if (filters.responsibility !== 'all') {
      filtered = filtered.filter(task => 
        task.responsibility?.some(resp => resp === filters.responsibility)
      )
    }

    setFilteredTasks(filtered)
  }

  // ========================================
  // TASK OPERATIONS
  // ========================================

  const handleCreateTask = async (taskData: CreateMasterTaskRequest) => {
    try {
      const response = await fetch('/api/master-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        throw new Error('Failed to create task')
      }

      const newTask = await response.json()
      setTasks(prev => [newTask, ...prev])
      setIsCreateDialogOpen(false)
      
      toast({
        title: 'Success',
        description: 'Master task created successfully'
      })
    } catch (error) {
      console.error('Error creating task:', error)
      toast({
        title: 'Error',
        description: 'Failed to create master task',
        variant: 'destructive'
      })
    }
  }

  const handleUpdateTask = async (taskId: string, taskData: UpdateMasterTaskRequest) => {
    try {
      const response = await fetch(`/api/master-tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        throw new Error('Failed to update task')
      }

      const updatedTask = await response.json()
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      setEditingTask(null)
      
      toast({
        title: 'Success',
        description: 'Master task updated successfully'
      })
    } catch (error) {
      console.error('Error updating task:', error)
      toast({
        title: 'Error',
        description: 'Failed to update master task',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/master-tasks/${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete task')
      }

      setTasks(prev => prev.filter(task => task.id !== taskId))
      
      toast({
        title: 'Success',
        description: 'Master task deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting task:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete master task',
        variant: 'destructive'
      })
    }
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  const getUniqueCategories = () => {
    const categories = new Set<string>()
    tasks.forEach(task => {
      task.categories?.forEach(cat => categories.add(cat))
    })
    return Array.from(categories).sort()
  }

  const getUniqueResponsibilities = () => {
    const responsibilities = new Set<string>()
    tasks.forEach(task => {
      task.responsibility?.forEach(resp => responsibilities.add(resp))
    })
    return Array.from(responsibilities).sort()
  }

  const getFrequencyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'once_off': 'Once Off',
      'daily': 'Daily',
      'weekly': 'Weekly',
      'specific_weekdays': 'Specific Weekdays',
      'start_of_month': 'Start of Month',
      'end_of_month': 'End of Month',
      'every_month': 'Every Month',
      'certain_months': 'Certain Months'
    }
    return labels[type] || type
  }

  // ========================================
  // RENDER
  // ========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading master tasks...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Checklist</h1>
          <p className="text-muted-foreground">
            Manage recurring tasks and their frequency rules
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Master Task</DialogTitle>
            </DialogHeader>
            <TaskForm
              onSubmit={handleCreateTask}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks (description)..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Publish Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.publishStatus}
                onValueChange={(value) => setFilters(prev => ({ ...prev, publishStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frequency Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <Select
                value={filters.frequencyType}
                onValueChange={(value) => setFilters(prev => ({ ...prev, frequencyType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="once_off">Once Off</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="specific_weekdays">Specific Weekdays</SelectItem>
                  <SelectItem value="start_of_month">Start of Month</SelectItem>
                  <SelectItem value="end_of_month">End of Month</SelectItem>
                  <SelectItem value="every_month">Every Month</SelectItem>
                  <SelectItem value="certain_months">Certain Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getUniqueCategories().map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsibility */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsibility</label>
              <Select
                value={filters.responsibility}
                onValueChange={(value) => setFilters(prev => ({ ...prev, responsibility: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {getUniqueResponsibilities().map(resp => (
                    <SelectItem key={resp} value={resp}>
                      {resp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
        <Button variant="outline" onClick={fetchTasks} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No tasks found</p>
              {filters.search || filters.publishStatus !== 'all' || filters.frequencyType !== 'all' || 
               filters.category !== 'all' || filters.responsibility !== 'all' ? (
                <Button variant="outline" onClick={() => setFilters({
                  search: '',
                  publishStatus: 'all',
                  frequencyType: 'all',
                  category: 'all',
                  responsibility: 'all'
                })}>
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Task
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => (
            <TaskListItem
              key={task.id}
              task={task}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingTask && (
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Master Task</DialogTitle>
            </DialogHeader>
            <TaskForm
              task={editingTask}
              onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
              onCancel={() => setEditingTask(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
