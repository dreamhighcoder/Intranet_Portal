'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Calendar, CheckCircle, XCircle, AlertTriangle, Tag, FileText, Settings, Hash } from 'lucide-react'

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

  // Category display names and colors
  const CATEGORY_CONFIG = {
    'stock-control': { label: 'Stock Control', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'compliance': { label: 'Compliance', color: 'bg-red-100 text-red-800 border-red-200' },
    'cleaning': { label: 'Cleaning', color: 'bg-green-100 text-green-800 border-green-200' },
    'pharmacy-services': { label: 'Pharmacy Services', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    'fos-operations': { label: 'FOS Operations', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'dispensary-operations': { label: 'Dispensary Operations', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    'general-pharmacy-operations': { label: 'General Pharmacy Operations', color: 'bg-pink-100 text-pink-800 border-pink-200' },
    'business-management': { label: 'Business Management', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    'general': { label: 'General', color: 'bg-gray-100 text-gray-800 border-gray-200' }
  }

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || {
      label: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      color: 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-y-auto max-w-4xl w-full max-h-[90vh] p-0">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center space-x-2 text-xl">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Task Details</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Task Information */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl text-gray-900 flex items-start justify-between">
                  <span className="flex-1">{task.master_task?.title}</span>
                  <Badge className={
                    task.status === 'completed' 
                      ? 'bg-green-100 text-green-800 border-green-200 ml-2'
                      : 'bg-orange-100 text-orange-800 border-orange-200 ml-2'
                  }>
                    {task.status === 'completed' ? 'Completed' : 'Pending'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                {task.master_task?.description && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Description</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{task.master_task.description}</p>
                  </div>
                )}
                
                {/* Basic Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Task Date</span>
                    </div>
                    <p className="text-blue-700 font-semibold">
                      {new Date(task.date).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800">Due Time</span>
                    </div>
                    <p className="text-purple-700 font-semibold">
                      {task.master_task?.due_time || 'No specific time'}
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Responsibility</span>
                    </div>
                    <p className="text-green-700 font-semibold capitalize">
                      {task.role?.replace(/-/g, ' ')}
                    </p>
                  </div>
                </div>

                {/* Task Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Hash className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Task IDs</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-500">Instance ID:</span> <code className="bg-white px-2 py-1 rounded text-xs">{task.id}</code></p>
                      <p><span className="text-gray-500">Master Task ID:</span> <code className="bg-white px-2 py-1 rounded text-xs">{task.master_task_id}</code></p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Settings className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-700">Task Configuration</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-500">Timing:</span> <span className="font-medium">{task.master_task?.timing || 'Not specified'}</span></p>
                      <p><span className="text-gray-500">Created:</span> <span className="font-medium">{formatTimestamp(task.created_at)}</span></p>
                      <p><span className="text-gray-500">Updated:</span> <span className="font-medium">{formatTimestamp(task.updated_at)}</span></p>
                    </div>
                  </div>
                </div>

                {/* Categories */}
                {task.master_task?.categories && task.master_task.categories.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Tag className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-indigo-800">Categories</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.master_task.categories.map((category: string, index: number) => {
                        const config = getCategoryConfig(category)
                        return (
                          <Badge key={index} className={`${config.color} border`}>
                            {config.label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Responsibilities */}
                {task.master_task?.responsibility && task.master_task.responsibility.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <User className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800">All Responsibilities</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.master_task.responsibility.map((resp: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white border-yellow-300 text-yellow-800">
                          {resp.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frequency Rules */}
                {task.master_task?.frequency_rules && Object.keys(task.master_task.frequency_rules).length > 0 && (
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Settings className="h-4 w-4 text-teal-600" />
                      <span className="font-medium text-teal-800">Frequency Rules</span>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(task.master_task.frequency_rules, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Task Payload */}
                {task.payload && Object.keys(task.payload).length > 0 && (
                  <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <FileText className="h-4 w-4 text-rose-600" />
                      <span className="font-medium text-rose-800">Task Payload</span>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(task.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {task.notes && (
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-800">Notes</span>
                    </div>
                    <p className="text-amber-700 leading-relaxed">{task.notes}</p>
                  </div>
                )}

                {/* Current completion info */}
                {task.status === 'completed' && task.completed_at && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 text-green-800 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold text-lg">Task Completed</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 font-medium">Completed At:</span>
                        <p className="text-green-700 font-semibold">
                          {formatTimestamp(task.completed_at)}
                        </p>
                      </div>
                      {task.completed_by && (
                        <div>
                          <span className="text-green-600 font-medium">Completed By:</span>
                          <p className="text-green-700 font-semibold">
                            {task.completed_by}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card className="border-l-4 border-l-indigo-500">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <span>Completion History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-gray-600">Loading history...</span>
                  </div>
                ) : auditLog.length > 0 ? (
                  <div className="space-y-4">
                    {auditLog.map((entry, index) => (
                      <div key={entry.id} className="bg-gray-50 p-4 rounded-lg border">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getActionIcon(entry.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={`text-xs ${getActionColor(entry.action)}`}>
                                {entry.action === 'completed' ? 'Completed' : 'Reopened'}
                              </Badge>
                              <span className="text-sm font-medium text-gray-700">
                                by {entry.user_name}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {formatTimestamp(entry.timestamp)}
                            </p>
                            {entry.old_status && entry.new_status && (
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span className="bg-gray-200 px-2 py-1 rounded">{entry.old_status}</span>
                                <span>→</span>
                                <span className="bg-gray-200 px-2 py-1 rounded">{entry.new_status}</span>
                              </div>
                            )}
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <div className="mt-2 p-2 bg-white rounded border">
                                <span className="text-xs text-gray-500 font-medium">Additional Details:</span>
                                <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No completion history available.</p>
                    <p className="text-sm text-gray-400 mt-1">Task actions will appear here once performed.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
            <Button variant="outline" onClick={onClose} className="px-6">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}