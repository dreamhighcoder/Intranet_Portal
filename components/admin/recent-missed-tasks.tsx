"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { taskInstancesApi, authenticatedGet } from "@/lib/api-client"
import { usePositionAuth } from "@/lib/position-auth-context"
import { toDisplayFormat } from "@/lib/responsibility-mapper"
// Avoid importing timezone-utils on the client to prevent date-fns-tz bundling issues
// We'll format AU dates locally using Intl.DateTimeFormat

interface TaskInstance {
  id: string
  due_date: string
  due_time: string
  status: string
  master_task: {
    title: string
    responsibility: string[]
  }
}

export function RecentMissedTasks() {
  const [recentMissedTasks, setRecentMissedTasks] = useState<TaskInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user, isLoading: authLoading } = usePositionAuth()

  useEffect(() => {
    async function fetchRecentMissedTasks() {
      // Wait for auth to complete loading
      if (authLoading) {
        console.log('RecentMissedTasks: Auth still loading, waiting...')
        return
      }
      
      // Check if user is authenticated
      if (!user || !user.isAuthenticated) {
        console.log('RecentMissedTasks: Skipping fetch - user not authenticated:', { hasUser: !!user, isAuthenticated: user?.isAuthenticated })
        setIsLoading(false)
        return
      }
      
      // Add a small delay to ensure authentication context is fully ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        console.log('RecentMissedTasks: Fetching data for authenticated user:', user.displayName)
        
        // Get date range for last 3 days using Australian timezone
        const tz = 'Australia/Sydney'
        const now = new Date()
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        const partsToYmd = (d: Date) => {
          const parts = fmt.formatToParts(d)
          const y = parts.find(p => p.type === 'year')?.value
          const m = parts.find(p => p.type === 'month')?.value
          const day = parts.find(p => p.type === 'day')?.value
          return `${y}-${m}-${day}`
        }
        const endDateYmd = partsToYmd(now)
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // Last 3 days
        const startDateYmd = partsToYmd(start)

        // Use the reports API to get consistent task status data
        console.log('RecentMissedTasks: Fetching from reports API for date range:', startDateYmd, 'to', endDateYmd)
        
        // Fetch outstanding tasks report which includes missed and overdue tasks
        const outstandingTasksData = await authenticatedGet<any>(`/api/reports?type=outstanding-tasks&start_date=${startDateYmd}&end_date=${endDateYmd}`)
        
        console.log('RecentMissedTasks: Outstanding tasks data received:', {
          hasData: !!outstandingTasksData,
          totalTasks: outstandingTasksData?.totalOutstandingTasks || 0,
          tasksCount: outstandingTasksData?.outstandingTasks?.length || 0
        })

        if (outstandingTasksData?.outstandingTasks && outstandingTasksData.outstandingTasks.length > 0) {
          // Transform the data to match the expected format
          const recentMissedItems = outstandingTasksData.outstandingTasks
            .map((item: any) => ({
              id: item.id,
              due_date: item.due_date,
              due_time: '', // Outstanding tasks report doesn't include due_time, but we can leave it empty
              status: item.status,
              master_task: {
                title: item.master_tasks?.title || '',
                responsibility: item.master_tasks?.responsibility || [],
              },
            }))
            .sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
            .slice(0, 5)

          console.log('RecentMissedTasks: Final items from reports API:', recentMissedItems.length)
          setRecentMissedTasks(recentMissedItems)
          return
        }

        // If no outstanding tasks found, set empty array
        console.log('RecentMissedTasks: No outstanding tasks found')
        setRecentMissedTasks([])
      } catch (error) {
        console.error('RecentMissedTasks: Error fetching recent missed tasks:', error)
        setRecentMissedTasks([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecentMissedTasks()
  }, [user, authLoading])

  return (
    <Card className="card-surface gap-3">
      <CardHeader>
        <CardTitle>Recent Missed Tasks (Last 3 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-[var(--color-text-secondary)] text-center py-4">Loading...</p>
        ) : recentMissedTasks.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-4">No missed tasks recently</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recentMissedTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--color-text-primary)]">{task.master_task.title}</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {task.master_task.responsibility && task.master_task.responsibility.length > 0 
                      ? task.master_task.responsibility.map(r => toDisplayFormat(r)).join(', ')
                      : 'All Positions'
                    }
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Due: {task.due_date} {task.due_time ? `at ${task.due_time}` : ''}
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
