"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TaskWithDetails } from "@/lib/types"
import { calculateTaskStatus, toggleTaskCompletion } from "@/lib/task-utils"
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CheckCircle, Clock, AlertCircle, AlertTriangle, Circle } from "lucide-react"

interface TaskCardProps {
  task: TaskWithDetails
  onTaskUpdate?: () => void
}

export function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const status = calculateTaskStatus(task)

  const handleToggleCompletion = async () => {
    setIsUpdating(true)
    try {
      await toggleTaskCompletion(task.id)
      onTaskUpdate?.()

      toastSuccess(
        status === "done" ? "Task reopened" : "Task completed",
        `${task.master_task.title} has been ${status === "done" ? "reopened" : "marked as complete"}.`
      )
    } catch (error) {
      console.error("Failed to update task:", error)
      toastError(
        "Error",
        "Failed to update task. Please try again."
      )
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case "done":
        return (
          <Badge className="task-status-done flex items-center gap-1" aria-label="Task completed">
            <CheckCircle className="w-3 h-3" />
            Done
          </Badge>
        )
      case "missed":
        return (
          <Badge className="task-status-missed flex items-center gap-1" aria-label="Task missed">
            <AlertTriangle className="w-3 h-3" />
            Missed
          </Badge>
        )
      case "overdue":
        return (
          <Badge className="task-status-overdue flex items-center gap-1" aria-label="Task overdue">
            <AlertCircle className="w-3 h-3" />
            Overdue
          </Badge>
        )
      case "due_today":
        return (
          <Badge className="task-status-due-today flex items-center gap-1" aria-label="Due today">
            <Clock className="w-3 h-3" />
            Due Today
          </Badge>
        )
      default:
        return (
          <Badge className="task-status-not-due flex items-center gap-1" aria-label="Not due yet">
            <Circle className="w-3 h-3" />
            To Do
          </Badge>
        )
    }
  }

  return (
    <Card className="card-surface hover:shadow-md transition-all duration-200 hover:scale-[1.02] flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium mb-2 line-clamp-2" style={{ color: "var(--color-text)" }}>
              {task.master_task.title}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                {task.master_task.category}
              </Badge>
              {getStatusBadge()}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            <p className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due: {task.due_time}
            </p>
            {task.completed_at && (
              <p className="flex items-center gap-1 mt-1" style={{ color: "var(--accent-green)" }}>
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
            <p className="text-sm line-clamp-2 flex-1" style={{ color: "var(--color-text-muted)" }}>
              {task.master_task.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 mt-auto">
          <Button
            size="sm"
            variant={status === "done" ? "outline" : "default"}
            onClick={handleToggleCompletion}
            disabled={isUpdating}
            className={status === "done" ? "border-green-200 hover:bg-green-50" : ""}
            style={
              status === "done"
                ? { color: "var(--accent-green)" }
                : {
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-primary-on)",
                    borderColor: "var(--color-primary)",
                  }
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

          <Button size="sm" variant="ghost" style={{ color: "var(--color-text-muted)" }}>
            History
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
