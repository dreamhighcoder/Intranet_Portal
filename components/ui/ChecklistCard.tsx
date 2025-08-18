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
    const fetchTaskCounts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const today = new Date().toISOString().split('T')[0]
        
        // Use public API for task counts (no authentication required)
        const queryParams = new URLSearchParams({
          date: today,
          position_id: positionId
        })
        
        // If role is a responsibility value, use responsibility filtering
        const responsibilityValues = [
          'pharmacist-primary', 'pharmacist-supporting', 'pharmacy-assistants',
          'dispensary-technicians', 'daa-packers', 'shared-exc-pharmacist',
          'shared-inc-pharmacist', 'operational-managerial'
        ]
        
        if (responsibilityValues.includes(role)) {
          queryParams.set('responsibility', role)
        }
        
        const response = await fetch(`/api/public/task-counts?${queryParams.toString()}`)
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
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

    // Always fetch task counts for the homepage cards
    fetchTaskCounts()
  }, [role, positionId])

  const handleOpenChecklist = () => {
    router.push(`/checklist?position=${positionId}`)
  }

  // Always show card, but make it inactive if no tasks
  const hasNoTasks = !loading && taskCounts.total === 0

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
      case 'high': return `${taskCounts.overdue} tasks overdue`
      case 'medium': return `${taskCounts.dueToday} tasks due today`
      case 'low': return `New task(s)!`
      default: return 'All caught up!'
    }
  }

  const alertLevel = getAlertLevel()

  return (
    <Card className={`card-surface hover:shadow-lg transition-all duration-200 group flex flex-col h-full ${hasNoTasks ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg text-white group-hover:scale-110 transition-transform ${hasNoTasks ? 'opacity-50' : ''}`}
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg leading-tight" style={{ color: "var(--color-text)" }}>
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
            {/* Task Summary - Always show the four key alerts */}
            <div className="mb-4 space-y-2">
              {/* New tasks alert */}
              {taskCounts.newSinceNine > 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                  <span className="text-blue-700 font-medium">New task(s)!</span>
                  <span className="text-blue-600 font-semibold">{taskCounts.newSinceNine}</span>
                </div>
              )}
              
              {/* Total tasks to do */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{taskCounts.total} tasks to do</span>
                <span className="font-medium">{taskCounts.total}</span>
              </div>
              
              {/* Tasks due today */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-600">{taskCounts.dueToday} tasks due today</span>
                <span className="font-medium text-orange-600">{taskCounts.dueToday}</span>
              </div>
              
              {/* Overdue tasks */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">{taskCounts.overdue} tasks overdue</span>
                <span className="font-medium text-red-600">{taskCounts.overdue}</span>
              </div>
              
              {/* Completed tasks (if any) */}
              {taskCounts.completed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Completed:</span>
                  <span className="font-medium text-green-600">{taskCounts.completed}</span>
                </div>
              )}
            </div>
            
            {/* Action Button */}
            <Button
              onClick={handleOpenChecklist}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)] border-0 mt-auto"
              disabled={hasNoTasks}
            >
              {hasNoTasks ? 'No Tasks Available' : 'Open Checklist'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
