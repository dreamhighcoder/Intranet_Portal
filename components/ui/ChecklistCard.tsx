'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Clock, Calendar } from 'lucide-react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { useRouter } from 'next/navigation'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { getAustralianToday } from '@/lib/timezone-utils'

interface ChecklistCardProps {
  role: string
  roleDisplayName: string
  positionId: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
}

interface TaskCounts {
  total: number
  newSinceNine: number
  dueToday: number
  overdue: number
  completed: number
}

export default function ChecklistCard({
  role,
  roleDisplayName,
  positionId,
  icon: Icon,
  iconBg
}: ChecklistCardProps) {
  const { user, isLoading: authLoading } = usePositionAuth()
  const router = useRouter()
  const [taskCounts, setTaskCounts] = useState<TaskCounts>({
    total: 0,
    newSinceNine: 0,
    dueToday: 0,
    overdue: 0,
    completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTaskCounts = async (effectiveDate?: string) => {
      try {
        setLoading(true)
        setError(null)

        const today = getAustralianToday()
        const dateToUse = effectiveDate || today
        const roleSlug = toKebabCase(role)
        if (!roleSlug) {
          console.warn('ChecklistCard: empty role slug, skipping fetch', { role })
          setLoading(false)
          setError('Missing role')
          return
        }

        const queryParams = new URLSearchParams({ date: dateToUse, role: roleSlug })
        const url = `/api/checklist/counts?${queryParams.toString()}`
        const response = await fetch(url, { cache: 'no-store' })

        if (!response.ok) {
          let serverMessage = ''
          try {
            const errBody = await response.json()
            serverMessage = errBody?.error || JSON.stringify(errBody)
          } catch {}
          console.error('ChecklistCard request failed', { url, status: response.status, statusText: response.statusText, serverMessage })
          throw new Error(`API request failed: ${response.status} ${response.statusText}${serverMessage ? ' - ' + serverMessage : ''}`)
        }

        const result = await response.json()
        if (!result.success) {
          console.error('ChecklistCard response not successful', { url, result })
          throw new Error(result.error || 'Failed to fetch task counts')
        }

        setTaskCounts(result.data)
      } catch (err) {
        console.error('Error fetching task counts:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch task counts')
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchTaskCounts()

    // Refresh when window regains focus (admin may have just activated a task)
    const onFocus = () => fetchTaskCounts()
    window.addEventListener('focus', onFocus)

    // Refresh when any checklist update event fires
    const onPositionsUpdated = () => fetchTaskCounts()
    const onTasksChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { role?: string; date?: string; action?: string } | undefined
      // Refresh all cards whenever any task changes; use provided date if present
      fetchTaskCounts(detail?.date)
    }
    window.addEventListener('positions-updated', onPositionsUpdated)
    window.addEventListener('tasks-changed', onTasksChanged as EventListener)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('positions-updated', onPositionsUpdated)
      window.removeEventListener('tasks-changed', onTasksChanged)
    }
  }, [role, positionId])

  const handleOpenChecklist = () => {
    // Instead of directly navigating, we need to trigger the login modal
    // We'll use a custom event to communicate with the parent component
    const event = new CustomEvent<{ positionId: string; roleDisplayName: string }>('open-checklist-login', {
      detail: {
        positionId,
        roleDisplayName: roleDisplayName
      }
    });
    window.dispatchEvent(event);
  }

  // Always show card, but make it inactive if no tasks and no new tasks
  const hasNoTasks = !loading && taskCounts.total === 0 && taskCounts.newSinceNine === 0

  const getAlertLevel = () => {
    // New tasks take priority over all other alerts
    if (taskCounts.newSinceNine > 0) return 'low'
    if (taskCounts.overdue > 0) return 'high'
    if (taskCounts.dueToday > 0) return 'medium'
    return 'none'
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'medium': return <Clock className="h-4 w-4" />
      case 'low': return <CheckCircle className="h-4 w-4" />
      default: return <Calendar className="h-4 w-4" />
    }
  }

  const getAlertMessage = (level: string) => {
    switch (level) {
      case 'high': return `${taskCounts.overdue} tasks overdue`
      case 'medium': return `${taskCounts.dueToday} tasks due today`
      case 'low': return taskCounts.newSinceNine === 1 ? 'New task!' : 'New tasks!'
      default: return 'All caught up!'
    }
  }

  const alertLevel = getAlertLevel()

  return (
    <Card className={`card-surface hover:shadow-lg transition-all duration-200 group flex flex-col h-full ${hasNoTasks ? 'opacity-60 bg-gray-50 border-gray-200' : ''
      }`}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg text-white group-hover:scale-110 transition-transform ${hasNoTasks ? 'opacity-50 bg-gray-400' : ''
                }`}
              style={{ backgroundColor: hasNoTasks ? undefined : iconBg }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className={`text-lg leading-tight ${hasNoTasks ? 'text-gray-500' : ''
              }`} style={{ color: hasNoTasks ? undefined : "var(--color-text)" }}>
              {roleDisplayName}
            </CardTitle>
          </div>

          {/* Alert Badge */}
          {!hasNoTasks && alertLevel !== 'none' && (
            <Badge className={`${getAlertColor(alertLevel)} border`}>
              <div className="flex items-center space-x-1">
                {getAlertIcon(alertLevel)}
                <span className="text-xs font-medium">
                  {getAlertMessage(alertLevel)}
                </span>
              </div>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 mb-2">Error loading tasks</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Task Summary - Show the four key alerts as per specifications */}
            <div className="mb-4 space-y-2">
              {/* New tasks alert - any task assigned since 9:00am today, not yet done */}
              {taskCounts.newSinceNine > 0 && (
                <div className="flex items-center justify-between text-sm px-2 py-1 bg-blue-50 rounded border-l-4 border-blue-400">
                  <span className="text-blue-700 font-medium flex items-center">
                    <span className="mr-1">🆕</span> {taskCounts.newSinceNine === 1 ? 'New task!' : 'New tasks!'}
                  </span>
                  <Badge  className="bg-blue-600 text-white font-medium">{taskCounts.newSinceNine}</Badge>
                </div>
              )}

              {/* X tasks to do - total tasks due today (regardless of original due date) */}
              <div className="flex items-center justify-between text-sm px-2 py-1 bg-gray-50 rounded">
                <span className="text-gray-700 font-medium flex items-center">
                  <span className="mr-1">📋</span> Tasks to do
                </span>
                <Badge variant="secondary" className="font-medium">{taskCounts.total}</Badge>
              </div>

              {/* X tasks due today - tasks specifically due today */}
              {taskCounts.dueToday > 0 && (
                <div className="flex items-center justify-between text-sm px-2 py-1 bg-orange-50 rounded">
                  <span className="text-orange-700 font-medium flex items-center">
                    <span className="mr-1">⏰</span> Due today
                  </span>
                  <Badge className="bg-orange-100 text-orange-800 font-medium">{taskCounts.dueToday}</Badge>
                </div>
              )}

              {/* X tasks overdue - tasks past their due date but still completable */}
              {taskCounts.overdue > 0 && (
                <div className="flex items-center justify-between text-sm px-2 py-1 bg-red-50 rounded">
                  <span className="text-red-700 font-medium flex items-center">
                    <span className="mr-1">⚠️</span> Overdue
                  </span>
                  <Badge className="bg-red-100 text-red-800 font-medium">{taskCounts.overdue}</Badge>
                </div>
              )}

              {/* Completed tasks (if any) */}
              {taskCounts.completed > 0 && (
                <div className="flex items-center justify-between text-sm px-2 py-1 bg-green-50 rounded">
                  <span className="text-green-700 font-medium flex items-center">
                    <span className="mr-1">✅</span> Completed
                  </span>
                  <Badge className="bg-green-100 text-green-800 font-medium">{taskCounts.completed}</Badge>
                </div>
              )}

              {/* No tasks message */}
              {taskCounts.total === 0 && !loading && !error && (
                <div className="text-center py-2 text-gray-500">
                  No tasks scheduled for today
                </div>
              )}
            </div>

            {/* Action Button */}
            <Button
              onClick={handleOpenChecklist}
              className={`w-full border-0 mt-auto ${hasNoTasks
                  ? 'bg-gray-400 text-white hover:bg-gray-500'
                  : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]'
                }`}
            >
              {hasNoTasks ? 'Open Checklist' : 'Open Checklist'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
