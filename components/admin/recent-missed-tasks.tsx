"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { mockTaskInstances, mockMasterTasks, mockPositions } from "@/lib/mock-data"

export function RecentMissedTasks() {
  // Mock recent missed tasks
  const recentMissedTasks = mockTaskInstances
    .filter((task) => task.status === "missed" || task.status === "overdue")
    .slice(0, 5)
    .map((task) => ({
      ...task,
      master_task: mockMasterTasks.find((mt) => mt.id === task.master_task_id)!,
      position: mockPositions.find((p) => p.id === task.position_id)!,
    }))

  return (
    <Card className="card-surface">
      <CardHeader>
        <CardTitle>Recent Missed Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {recentMissedTasks.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-4">No missed tasks recently</p>
        ) : (
          <div className="space-y-4">
            {recentMissedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--color-text-primary)]">{task.master_task.title}</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">{task.position.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Due: {task.due_date} at {task.due_time}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-red-100 text-red-800 border-red-200">
                    {task.status === "missed" ? "Missed" : "Overdue"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
