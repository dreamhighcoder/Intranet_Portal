"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TaskWithDetails } from "@/lib/types"
import { calculateTaskStatus, toggleTaskCompletion } from "@/lib/task-utils"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CheckCircle, Clock, AlertCircle } from "lucide-react"

interface TaskCardProps {
  task: TaskWithDetails
  onTaskUpdate?: () => void
}

export function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  const status = calculateTaskStatus(task)

  const handleToggleCompletion = async () => {
    setIsUpdating(true)
    try {
      await toggleTaskCompletion(task.id)
      onTaskUpdate?.()

      toast({
        title: status === "done" ? "Task reopened" : "Task completed",
        description: `${task.master_task.title} has been ${status === "done" ? "reopened" : "marked as complete"}.`,
        variant: "default",
      })
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const statusColors = TASK_STATUS_COLORS[status]
  const statusLabel = TASK_STATUS_LABELS[status]

  const getStatusIcon = () => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "overdue":
      case "missed":
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case "due_today":
        return <Clock className="w-4 h-4 text-blue-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <Card className="card-surface hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-[var(--color-text-primary)] mb-2 line-clamp-2">{task.master_task.title}</h3>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {task.master_task.category}
              </Badge>
              <Badge className={`text-xs flex items-center gap-1 ${statusColors}`}>
                {getStatusIcon()}
                {statusLabel}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="text-sm text-[var(--color-text-secondary)]">
            <p className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due: {task.due_time}
            </p>
            {task.completed_at && (
              <p className="text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle className="w-3 h-3" />
                Completed:{" "}
                {new Date(task.completed_at).toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {task.master_task.description && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{task.master_task.description}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant={status === "done" ? "outline" : "default"}
              onClick={handleToggleCompletion}
              disabled={isUpdating}
              className={
                status === "done"
                  ? "border-green-200 text-green-700 hover:bg-green-50"
                  : "bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
              }
            >
              {isUpdating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Updating...
                </>
              ) : status === "done" ? (
                "Undo"
              ) : (
                "Mark Done"
              )}
            </Button>

            <Button size="sm" variant="ghost" className="text-[var(--color-text-secondary)]">
              History
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
