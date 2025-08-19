'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Calendar, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  onTaskUpdate?: () => void
}

interface AuditLogEntry {
  id: string
  user_name: string
  action: string
  old_status?: string
  new_status?: string
  timestamp: string
  metadata?: any
}

export default function TaskDetailModal({ 
  isOpen, 
  onClose, 
  task, 
  onTaskUpdate 
}: TaskDetailModalProps) {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && task?.id) {
      loadAuditLog()
    }
  }, [isOpen, task?.id])

  const loadAuditLog = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/audit/task-completion?task_instance_id=${task.id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAuditLog(data.data || [])
        }
      }
    } catch (error) {
      console.error('Error loading audit log:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'uncompleted':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'completed':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'uncompleted':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    }
  }

  if (!task) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-y-auto" style={{ maxWidth: "80rem", width: "80vw", maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>Task Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{task.master_task?.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.master_task?.description && (
                <p className="text-gray-600">{task.master_task.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Date: {task.date}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>Due: {task.master_task?.due_time || 'No due time'}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>Role: {task.role}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span>Status: </span>
                  <Badge className={
                    task.status === 'completed' 
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-orange-100 text-orange-800 border-orange-200'
                  }>
                    {task.status === 'completed' ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
              </div>

              {/* Categories */}
              {task.master_task?.categories && task.master_task.categories.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Categories: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.master_task.categories.map((category: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Current completion info */}
              {task.status === 'completed' && task.completed_at && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Completed</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    {formatTimestamp(task.completed_at)}
                  </p>
                  {task.completed_by && (
                    <p className="text-sm text-green-600 mt-1">
                      by {task.completed_by}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Completion History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                </div>
              ) : auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry, index) => (
                    <div key={entry.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getActionIcon(entry.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getActionColor(entry.action)}`}>
                            {entry.action === 'completed' ? 'Completed' : 'Reopened'}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            by {entry.user_name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(entry.timestamp)}
                        </p>
                        {entry.old_status && entry.new_status && (
                          <p className="text-xs text-gray-400 mt-1">
                            {entry.old_status} → {entry.new_status}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No completion history available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}