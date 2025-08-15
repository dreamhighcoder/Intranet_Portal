"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2, Plus } from "lucide-react"
import Link from "next/link"
import { MasterTask, Position } from "@/lib/types"
import { authenticatedGet, authenticatedPut } from "@/lib/api-client"
import { toastError, toastSuccess } from "@/hooks/use-toast"

export function MasterTasksTable() {
  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
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
    
    fetchData()
  }, [])

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
                  <TableHead>Position</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Category</TableHead>
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
                  <TableCell>{getPositionName(task.position_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.frequency.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.category}</Badge>
                  </TableCell>
                  <TableCell>{task.default_due_time}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/task-editor/${task.id}`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 bg-transparent">
                        <Trash2 className="w-4 h-4" />
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
