'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Clock, Calendar } from 'lucide-react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { useRouter } from 'next/navigation'

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
  const { user } = usePositionAuth()
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
    const fetchTaskCounts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const today = new Date().toISOString().split('T')[0]
        const response = await fetch(`/api/checklist?role=${role}&date=${today}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch task counts')
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch task counts')
        }
        
        const tasks = data.data || []
        const now = new Date()
        const nineAM = new Date()
        nineAM.setHours(9, 0, 0, 0)
        
        // Calculate task counts
        const counts: TaskCounts = {
          total: tasks.length,
          newSinceNine: 0,
          dueToday: 0,
          overdue: 0,
          completed: 0
        }
        
        tasks.forEach((task: any) => {
          // Count completed tasks
          if (task.status === 'completed') {
            counts.completed++
          }
          
          // Count tasks due today (not completed)
          if (task.status !== 'completed') {
            counts.dueToday++
            
            // Check if overdue (past due time on today's date)
            if (task.master_task?.due_time) {
              const dueTime = new Date(`${today}T${task.master_task.due_time}`)
              if (now > dueTime) {
                counts.overdue++
              }
            }
            
            // Count new tasks since 9 AM (created or appeared after 9 AM)
            const taskCreatedAt = new Date(task.created_at)
            if (taskCreatedAt > nineAM) {
              counts.newSinceNine++
            }
          }
        })
        
        setTaskCounts(counts)
      } catch (err) {
        console.error('Error fetching task counts:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch task counts')
      } finally {
        setLoading(false)
      }
    }

    // Only fetch if user is not authenticated (for public homepage)
    if (!user) {
      fetchTaskCounts()
    }
  }, [role, user])

  const handleOpenChecklist = () => {
    router.push(`/checklist?position=${positionId}`)
  }

  // Don't show card if no tasks and user is not authenticated
  if (!user && !loading && taskCounts.total === 0) {
    return null
  }

  const getAlertLevel = () => {
    if (taskCounts.overdue > 0) return 'high'
    if (taskCounts.dueToday > 0) return 'medium'
    if (taskCounts.newSinceNine > 0) return 'low'
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
      case 'high': return `${taskCounts.overdue} overdue task${taskCounts.overdue !== 1 ? 's' : ''}`
      case 'medium': return `${taskCounts.dueToday} task${taskCounts.dueToday !== 1 ? 's' : ''} due today`
      case 'low': return `${taskCounts.newSinceNine} new task${taskCounts.newSinceNine !== 1 ? 's' : ''} since 9:00 AM`
      default: return 'All caught up!'
    }
  }

  const alertLevel = getAlertLevel()

  return (
    <Card className="card-surface hover:shadow-lg transition-all duration-200 group flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-lg text-white group-hover:scale-110 transition-transform"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg leading-tight" style={{ color: "var(--color-text)" }}>
              {roleDisplayName}
            </CardTitle>
          </div>
          
          {/* Alert Badge */}
          {alertLevel !== 'none' && (
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
            {/* Task Summary */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Tasks:</span>
                <span className="font-medium">{taskCounts.total}</span>
              </div>
              
              {taskCounts.completed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Completed:</span>
                  <span className="font-medium text-green-600">{taskCounts.completed}</span>
                </div>
              )}
              
              {taskCounts.dueToday > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-600">Due Today:</span>
                  <span className="font-medium text-orange-600">{taskCounts.dueToday}</span>
                </div>
              )}
              
              {taskCounts.overdue > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600">Overdue:</span>
                  <span className="font-medium text-red-600">{taskCounts.overdue}</span>
                </div>
              )}
              
              {taskCounts.newSinceNine > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">New Since 9:00 AM:</span>
                  <span className="font-medium text-blue-600">{taskCounts.newSinceNine}</span>
                </div>
              )}
            </div>
            
            {/* Action Button */}
            <Button
              onClick={handleOpenChecklist}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0 mt-auto"
              disabled={taskCounts.total === 0}
            >
              {taskCounts.total === 0 ? 'No Tasks' : 'Open Checklist'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
