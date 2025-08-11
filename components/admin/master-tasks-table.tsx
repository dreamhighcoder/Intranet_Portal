"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { mockMasterTasks, mockPositions } from "@/lib/mock-data"
import { Edit, Trash2, Plus } from "lucide-react"
import Link from "next/link"

export function MasterTasksTable() {
  const [tasks, setTasks] = useState(mockMasterTasks)

  const handlePublishToggle = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              publish_status: task.publish_status === "active" ? "inactive" : "active",
            }
          : task,
      ),
    )
  }

  const getPositionName = (positionId: string) => {
    return mockPositions.find((p) => p.id === positionId)?.name || "Unknown"
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
          <Button asChild className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90">
            <Link href="/admin/task-editor">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
