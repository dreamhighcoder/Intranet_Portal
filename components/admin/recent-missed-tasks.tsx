"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { taskInstancesApi } from "@/lib/api-client"

interface TaskInstance {
  id: string
  due_date: string
  due_time: string
  status: string
  master_task: {
    title: string
    position: {
      name: string
    }
  }
}

export function RecentMissedTasks() {
  const [recentMissedTasks, setRecentMissedTasks] = useState<TaskInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRecentMissedTasks() {
      try {
        // Get date range for last 7 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 7)
        
        const dateRange = `${startDate.toISOString().split('T')[0]},${endDate.toISOString().split('T')[0]}`
        
        // Fetch missed and overdue tasks
        const [missedData, overdueData] = await Promise.all([
          taskInstancesApi.getAll({ status: 'missed', dateRange }),
          taskInstancesApi.getAll({ status: 'overdue', dateRange })
        ])
        
        // Combine and sort by due date (most recent first)
        const allTasks = [...(missedData || []), ...(overdueData || [])]
          .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
          .slice(0, 5)
        
        setRecentMissedTasks(allTasks)
      } catch (error) {
        console.error('Error fetching recent missed tasks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecentMissedTasks()
  }, [])

  return (
    <Card className="card-surface">
      <CardHeader>
        <CardTitle>Recent Missed Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-[var(--color-text-secondary)] text-center py-4">Loading...</p>
        ) : recentMissedTasks.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-4">No missed tasks recently</p>
        ) : (
          <div className="space-y-4">
            {recentMissedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--color-text-primary)]">{task.master_task.title}</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">{task.master_task.position.name}</p>
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
