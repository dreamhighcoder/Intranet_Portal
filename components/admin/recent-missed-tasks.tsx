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

        const dateRange = `${startDateYmd},${endDateYmd}`
        
        // First try: use checklist API in admin mode to leverage computed status logic
        const dateList: string[] = []
        ;(() => {
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
          const end = now
          const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // Last 3 days
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateList.push(partsToYmd(new Date(d)))
          }
        })()

        console.log('RecentMissedTasks: Fetching checklist data for dates:', dateList)
        
        // Fetch each day in parallel from checklist API with admin_mode=true
        const dailyResults = await Promise.all(
          dateList.map(d => authenticatedGet<any>(`/api/checklist?role=admin&date=${d}&admin_mode=true`))
        )

        console.log('RecentMissedTasks: Daily results received:', dailyResults.map((res, i) => ({
          date: dateList[i],
          hasData: !!res,
          isArray: Array.isArray(res?.data),
          count: Array.isArray(res?.data) ? res.data.length : 0,
          statuses: Array.isArray(res?.data) ? res.data.map((item: any) => item.status) : []
        })))

        // Flatten and filter to missed/overdue; transform to the shape used by this card
        const allItems = dailyResults.flatMap(res => (res && Array.isArray(res.data)) ? res.data : [])
        console.log('RecentMissedTasks: All flattened items count:', allItems.length)
        console.log('RecentMissedTasks: All item statuses:', allItems.map((item: any) => item.status))
        
        const missedItems = allItems.filter((item: any) => item.status === 'missed' || item.status === 'overdue')
        console.log('RecentMissedTasks: Filtered missed/overdue items:', missedItems.length)
        console.log('RecentMissedTasks: Sample missed item:', missedItems[0])
        
        const checklistItems = missedItems
          .map((item: any) => ({
            id: item.id,
            due_date: item.detailed_status?.dueDate || item.due_date || item.date,
            due_time: item.detailed_status?.dueTime || item.due_time || '',
            status: item.status,
            master_task: {
              title: item.master_task?.title || item.title || '',
              responsibility: item.master_task?.responsibility || item.responsibility || [],
            },
          }))
          .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
          .slice(0, 5)

        console.log('RecentMissedTasks: checklist-based final count:', checklistItems.length)
        console.log('RecentMissedTasks: Final items:', checklistItems)

        if (checklistItems.length > 0) {
          setRecentMissedTasks(checklistItems)
          return
        }

        // Fallback: original task-instances approach (if checklist-based yields nothing)
        const fallbackDateRange = `${dateList[0]},${dateList[dateList.length - 1]}`
        console.log('RecentMissedTasks: Using fallback with date range:', fallbackDateRange)
        const [missedData, overdueData] = await Promise.all([
          taskInstancesApi.getAll({ status: 'missed', dateRange: fallbackDateRange }),
          taskInstancesApi.getAll({ status: 'overdue', dateRange: fallbackDateRange })
        ])

        const normalize = (items: any[] = []) => items
          .map((t) => ({
            ...t,
            status: t.status === 'done' ? 'completed' : t.status,
          }))
          .filter((t) => t.status === 'missed' || t.status === 'overdue')

        let combined = [...normalize(missedData), ...normalize(overdueData)]

        if (combined.length === 0) {
          console.log('RecentMissedTasks: No missed/overdue found, trying all tasks in date range:', fallbackDateRange)
          const all = await taskInstancesApi.getAll({ dateRange: fallbackDateRange })
          combined = normalize(all)
        }

        combined = combined
          .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
          .slice(0, 5)

        setRecentMissedTasks(combined)
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
