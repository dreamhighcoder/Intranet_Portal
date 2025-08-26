'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, Eye, Clock, AlertTriangle } from 'lucide-react'
import { toastError, toastSuccess } from '@/hooks/use-toast'
import { createAustralianDateTime, getAustralianNow } from '@/lib/timezone-utils'

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

interface ChecklistViewProps {
  role: string
  date: string
  onTaskUpdate?: () => void
  showActions?: boolean
  compact?: boolean
}

export default function ChecklistView({ 
  role, 
  date, 
  onTaskUpdate, 
  showActions = true, 
  compact = false 
}: ChecklistViewProps) {
  const [tasks, setTasks] = useState<ChecklistTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  // Load tasks when role or date changes
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true)
        
        const response = await fetch(`/api/checklist?role=${role}&date=${date}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch tasks')
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch tasks')
        }
        
        setTasks(data.data || [])
      } catch (error) {
        console.error('Error loading tasks:', error)
        setTasks([])
        toastError("Error", "Failed to load tasks. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (role && date) {
      loadTasks()
    }
  }, [role, date])

  const handleTaskComplete = async (taskId: string) => {
    try {
      const response = await fetch(`/api/task-instances/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to complete task')
      }

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed', completed_at: new Date().toISOString() }
          : task
      ))

      toastSuccess("Task Completed", "Task has been marked as complete.")
      onTaskUpdate?.()
    } catch (error) {
      console.error('Error completing task:', error)
      toastError("Error", "Failed to complete task. Please try again.")
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    try {
      const response = await fetch(`/api/task-instances/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'pending',
          completed_by: null,
          completed_at: null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to undo task')
      }

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'pending', completed_by: undefined, completed_at: undefined }
          : task
      ))

      toastSuccess("Task Reopened", "Task has been reopened.")
      onTaskUpdate?.()
    } catch (error) {
      console.error('Error undoing task:', error)
      toastError("Error", "Failed to undo task. Please try again.")
    }
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
            // Compare in Australian timezone
            const { createAustralianDateTime, getAustralianNow } = await import('@/lib/timezone-utils')
            const dueTime = createAustralianDateTime(date, task.master_task.due_time)
            const now = getAustralianNow()
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
  }, [tasks, selectedCategory, selectedStatus, date])

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>()
    tasks.forEach(task => {
      task.master_task.categories.forEach(cat => categories.add(cat))
    })
    return Array.from(categories).sort()
  }, [tasks])

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
      const dueTime = createAustralianDateTime(date, task.master_task.due_time)
      const now = getAustralianNow()
      if (now > dueTime) {
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        )
      }
    }

    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
        <Clock className="h-3 w-3 mr-1" />
        Due Today
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-500">No tasks found for this role and date.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!compact && (
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
                {uniqueCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
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
      )}

      {/* Task List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Title</TableHead>
                {!compact && <TableHead>Category</TableHead>}
                {!compact && <TableHead>Timing</TableHead>}
                {!compact && <TableHead>Due Time</TableHead>}
                <TableHead>Status</TableHead>
                {showActions && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.master_task.title}</div>
                    {!compact && task.master_task.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {task.master_task.description}
                      </p>
                    )}
                  </TableCell>
                  
                  {!compact && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {task.master_task.categories.map((category, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  )}
                  
                  {!compact && (
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {task.master_task.timing}
                      </Badge>
                    </TableCell>
                  )}
                  
                  {!compact && (
                    <TableCell>
                      {task.master_task.due_time ? (
                        <span className="text-sm font-medium">{task.master_task.due_time}</span>
                      ) : (
                        <span className="text-sm text-gray-500">No due time</span>
                      )}
                    </TableCell>
                  )}
                  
                  <TableCell>{getStatusBadge(task)}</TableCell>
                  
                  {showActions && (
                    <TableCell>
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
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="h-4 w-4 mr-1" />
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
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      {!compact && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredTasks.length} of {tasks.length} tasks
          {filteredTasks.length !== tasks.length && (
            <span> (filtered)</span>
          )}
        </div>
      )}
    </div>
  )
}
