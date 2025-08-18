"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Edit, Trash2, Plus, Eye, Clock, Calendar, User, Tag, Settings, FileText } from "lucide-react"
import Link from "next/link"
import { MasterTask, Position } from "@/lib/types"
import { authenticatedGet, authenticatedPut } from "@/lib/api-client"
import { toastError, toastSuccess } from "@/hooks/use-toast"

// Helper function to render truncated array with badges
const renderTruncatedArray = (items: string[] | undefined, maxVisible: number = 2, variant: "default" | "secondary" | "outline" = "secondary") => {
  if (!items || items.length === 0) {
    return <span className="text-gray-400 text-xs">None</span>
  }

  const visibleItems = items.slice(0, maxVisible)
  const remainingCount = items.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1">
      {visibleItems.map((item, index) => (
        <Badge key={index} variant={variant} className="text-xs">
          {item.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remainingCount}
        </Badge>
      )}
    </div>
  )
}

// Helper function to format frequency for display
const formatFrequency = (frequency: string) => {
  return frequency.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Task Details Modal Component
const TaskDetailsModal = ({ task, positions }: { task: MasterTask, positions: Position[] }) => {
  const getPositionName = (positionId: string) => {
    const position = positions.find(p => p.id === positionId)
    return position?.name || 'Unknown Position'
  }

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Task Details
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Title</label>
              <p className="text-sm mt-1">{task.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <div className="mt-1">
                <Badge className={task.publish_status === 'active' ? 'bg-green-100 text-green-800' : 
                                task.publish_status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-gray-100 text-gray-800'}>
                  {task.publish_status}
                </Badge>
              </div>
            </div>
          </div>
          {task.description && (
            <div>
              <label className="text-sm font-medium text-gray-600">Description</label>
              <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">{task.description}</p>
            </div>
          )}
        </div>

        {/* Assignment & Responsibilities */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Assignment & Responsibilities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Responsibilities</label>
              <div className="mt-1">
                {task.responsibility && task.responsibility.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.responsibility.map((resp, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {resp.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                ) : task.position_id ? (
                  <Badge variant="secondary" className="text-xs">
                    {getPositionName(task.position_id)}
                  </Badge>
                ) : (
                  <span className="text-gray-400 text-xs">No responsibilities assigned</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Categories</label>
              <div className="mt-1">
                {task.categories && task.categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {task.categories.map((category, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                ) : task.category ? (
                  <Badge variant="outline" className="text-xs">{task.category}</Badge>
                ) : (
                  <span className="text-gray-400 text-xs">No categories</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduling
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Frequency</label>
              <p className="text-sm mt-1">
                <Badge variant="outline">{formatFrequency(task.frequency)}</Badge>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Timing</label>
              <p className="text-sm mt-1">{task.timing || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Due Time</label>
              <p className="text-sm mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.due_time || (task as any).default_due_time || 'Not specified'}
              </p>
            </div>
          </div>
          
          {/* Advanced Scheduling */}
          {(task.weekdays && task.weekdays.length > 0) && (
            <div>
              <label className="text-sm font-medium text-gray-600">Specific Weekdays</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {task.weekdays.map((day, index) => {
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  return (
                    <Badge key={index} variant="outline" className="text-xs">
                      {dayNames[day] || day}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
          
          {(task.months && task.months.length > 0) && (
            <div>
              <label className="text-sm font-medium text-gray-600">Specific Months</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {task.months.map((month, index) => {
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  return (
                    <Badge key={index} variant="outline" className="text-xs">
                      {monthNames[month - 1] || month}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Advanced Options
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <span className="text-sm font-medium">Sticky Once Off</span>
              <Badge variant={task.sticky_once_off ? "default" : "outline"}>
                {task.sticky_once_off ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <span className="text-sm font-medium">Allow Edit When Locked</span>
              <Badge variant={task.allow_edit_when_locked ? "default" : "outline"}>
                {task.allow_edit_when_locked ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {task.start_date && (
              <div>
                <label className="text-sm font-medium text-gray-600">Start Date</label>
                <p className="text-sm mt-1">{new Date(task.start_date).toLocaleDateString()}</p>
              </div>
            )}
            {task.end_date && (
              <div>
                <label className="text-sm font-medium text-gray-600">End Date</label>
                <p className="text-sm mt-1">{new Date(task.end_date).toLocaleDateString()}</p>
              </div>
            )}
            {task.publish_delay && (
              <div>
                <label className="text-sm font-medium text-gray-600">Publish Delay</label>
                <p className="text-sm mt-1">{new Date(task.publish_delay).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Created:</span> {new Date(task.created_at).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Updated:</span> {new Date(task.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

export function MasterTasksTable() {
  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      console.log('MasterTasksTable: Fetching data...')
      const [tasksData, positionsData] = await Promise.all([
        authenticatedGet('/api/master-tasks?status=all'),
        authenticatedGet('/api/positions')
      ])
      
      console.log('MasterTasksTable: Received data:', { 
        tasksCount: tasksData?.length || 0,
        positionsCount: positionsData?.length || 0,
        tasks: tasksData,
        positions: positionsData
      })
      
      if (tasksData) {
        setTasks(tasksData)
      }
      if (positionsData) {
        setPositions(positionsData)
      }
    } catch (error) {
      console.error('MasterTasksTable: Error fetching data:', error)
      toastError("Error", "Failed to load master tasks data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return
    }

    try {
      await authenticatedPut(`/api/master-tasks/${taskId}`, { publish_status: 'inactive' })
      toastSuccess("Success", "Task deleted successfully")
      fetchData() // Refresh the data
    } catch (error) {
      console.error('Error deleting task:', error)
      toastError("Error", "Failed to delete task")
    }
  }

  const handlePublishToggle = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    
    const newStatus = task.publish_status === "active" ? "inactive" : "active"
    
    try {
      await authenticatedPut(`/api/master-tasks/${taskId}`, {
        ...task,
        publish_status: newStatus
      })
      
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, publish_status: newStatus }
            : task,
        ),
      )
      
      toastSuccess("Success", `Task ${newStatus === "active" ? "activated" : "deactivated"} successfully`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toastError("Error", "Failed to update task status")
    }
  }

  const getPositionName = (positionId: string) => {
    return positions.find((p) => p.id === positionId)?.name || "Unknown"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "inactive":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Card className="card-surface">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Master Tasks</CardTitle>
          <Button asChild className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]">
            <Link href="/admin/task-editor">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">
            No master tasks found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Task Title</TableHead>
                  <TableHead>Responsibilities</TableHead>
                  <TableHead>Frequencies</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Due Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={task.publish_status === "active"}
                        onCheckedChange={() => handlePublishToggle(task.id)}
                      />
                      <Badge className={getStatusColor(task.publish_status)}>{task.publish_status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-[var(--color-text-secondary)] truncate max-w-xs">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.responsibility && task.responsibility.length > 0 ? (
                      renderTruncatedArray(task.responsibility, 2, "secondary")
                    ) : task.position_id ? (
                      <Badge variant="secondary" className="text-xs">{getPositionName(task.position_id)}</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{formatFrequency(task.frequency)}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.categories && task.categories.length > 0 ? (
                      renderTruncatedArray(task.categories, 2, "outline")
                    ) : task.category ? (
                      <Badge variant="outline" className="text-xs">{task.category}</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </TableCell>
                  <TableCell>{task.due_time || (task as any).default_due_time || ''}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <TaskDetailsModal task={task} positions={positions} />
                      </Dialog>
                      <Button asChild size="sm" variant="outline" className="h-8 w-8 p-0">
                        <Link href={`/admin/task-editor/${task.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(task.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
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
  )
}
