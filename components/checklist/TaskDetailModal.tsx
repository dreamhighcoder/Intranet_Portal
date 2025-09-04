'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Calendar, CheckCircle, XCircle, AlertTriangle, Tag, FileText, Settings, Hash } from 'lucide-react'
import { toDisplayFormat } from '@/lib/responsibility-mapper'

interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  onTaskUpdate?: () => void
}

interface CompletionLogEntry {
  id: string
  action: string
  completion_time: string
  time_to_complete?: string
  notes?: string
  created_at: string
  user_profiles?: {
    display_name: string
  }
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onTaskUpdate
}: TaskDetailModalProps) {
  const [completionLog, setCompletionLog] = useState<CompletionLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && task?.id) {
      loadCompletionLog()
    }
  }, [isOpen, task?.id])

  const loadCompletionLog = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/audit/task-completion?task_instance_id=${task.id}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCompletionLog(data.data || [])
        }
      }
    } catch (error) {
      console.error('Error loading completion log:', error)
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

  // Helper function to format frequency rules as readable badges
  const formatFrequencyRules = (frequencyRules: any) => {
    if (!frequencyRules || typeof frequencyRules !== 'object') return []

    const badges = []
    const { type, ...attributes } = frequencyRules

    // Add main type badge
    if (type) {
      const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      badges.push({
        label: typeLabel,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        isMain: true
      })
    }

    // Add attribute badges based on the frequency type
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined) return

      let label = ''
      let color = 'bg-gray-100 text-gray-800 border-gray-200'

      switch (key) {
        case 'every_n_days':
          label = `Every ${value} day${value > 1 ? 's' : ''}`
          color = 'bg-green-100 text-green-800 border-green-200'
          break
        case 'every_n_weeks':
          label = `Every ${value} week${value > 1 ? 's' : ''}`
          color = 'bg-purple-100 text-purple-800 border-purple-200'
          break
        case 'every_n_months':
          label = `Every ${value} month${value > 1 ? 's' : ''}`
          color = 'bg-orange-100 text-orange-800 border-orange-200'
          break
        case 'business_days_only':
          if (value) {
            label = 'Business Days Only'
            color = 'bg-yellow-100 text-yellow-800 border-yellow-200'
          }
          break
        case 'exclude_holidays':
          if (value) {
            label = 'Exclude Holidays'
            color = 'bg-red-100 text-red-800 border-red-200'
          }
          break
        case 'weekdays':
          if (Array.isArray(value) && value.length > 0) {
            const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            const days = value.map(day => weekdayNames[day - 1]).join(', ')
            label = `Weekdays: ${days}`
            color = 'bg-indigo-100 text-indigo-800 border-indigo-200'
          }
          break
        case 'months':
          if (Array.isArray(value) && value.length > 0) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const months = value.map(month => monthNames[month - 1]).join(', ')
            label = `Months: ${months}`
            color = 'bg-pink-100 text-pink-800 border-pink-200'
          }
          break
        case 'day_offset':
          label = `Day ${value + 1} of month`
          color = 'bg-teal-100 text-teal-800 border-teal-200'
          break
        case 'days_from_end':
          label = value === 0 ? 'Last day of month' : `${value} day${value > 1 ? 's' : ''} from end`
          color = 'bg-cyan-100 text-cyan-800 border-cyan-200'
          break
        case 'start_date':
          label = `Start: ${new Date(value).toLocaleDateString('en-AU')}`
          color = 'bg-emerald-100 text-emerald-800 border-emerald-200'
          break
        case 'end_date':
          label = `End: ${new Date(value).toLocaleDateString('en-AU')}`
          color = 'bg-rose-100 text-rose-800 border-rose-200'
          break
        case 'due_date':
          label = `Due: ${new Date(value).toLocaleDateString('en-AU')}`
          color = 'bg-amber-100 text-amber-800 border-amber-200'
          break
        case 'start_day':
          const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          label = `Start: ${weekdayNames[value - 1]}`
          color = 'bg-violet-100 text-violet-800 border-violet-200'
          break
        default:
          if (typeof value === 'boolean' && value) {
            label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          } else if (typeof value === 'string' || typeof value === 'number') {
            label = `${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}: ${value}`
          }
          break
      }

      if (label) {
        badges.push({ label, color, isMain: false })
      }
    })

    return badges
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="task-details-modal overflow-hidden flex flex-col" style={{ maxWidth: "80rem", width: "80vw", maxHeight: "90vh", height: "90vh" }}>
        {/* <div className="p-4 sm:p-6"> */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Task Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4 space-y-6">
          {/* Task Information */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-0">
              <CardTitle className="text-xl text-gray-900 flex items-start justify-between">
                <span className="flex-1">{task.master_task?.title}</span>
                <div className="flex flex-wrap gap-1 ml-2">
                  {task.position_completions && task.position_completions.length > 0 ? (
                    task.position_completions.map((completion: any, index: number) => (
                      <Badge key={index} className="bg-green-100 text-green-800 border-green-200 text-xs">
                        ✓ {completion.position_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Badge>
                    ))
                  ) : (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Description */}
              {task.master_task?.description && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Description</span>
                  </div>
                  <p className="text-blue-700 leading-relaxed">{task.master_task.description}</p>
                </div>
              )}

              {/* Basic Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-800">Task Date</span>
                  </div>
                  <p className="text-purple-700 font-semibold">
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
                    <span className="font-medium text-purple-800">Timing</span>
                  </div>
                  <p className="text-purple-700 font-semibold">
                    {task.master_task?.timing?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Not specified'}
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
              </div>

              {/* Responsibilities, Categories and Frequencies */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Responsibilities */}
                {task.master_task?.responsibility && task.master_task.responsibility.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">All Responsibilities</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.master_task.responsibility.map((resp: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white border-green-200 text-green-800">
                          {toDisplayFormat(resp)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                {task.master_task?.categories && task.master_task.categories.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Categories</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.master_task.categories.map((category: string, index: number) => {
                        const config = getCategoryConfig(category)
                        return (
                          <Badge key={index} className="bg-white border-green-200 text-green-800">
                            {config.label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Frequencies */}
                {task.master_task?.frequencies && Object.keys(task.master_task.frequencies).length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <Settings className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Frequencies</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.master_task.frequencies.map((frequencies: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white border-green-200 text-green-800">
                          {toDisplayFormat(frequencies)}
                        </Badge>
                      ))}

                      {/* {task.master_task.frequencies.map((frequencies: string, index: number) => {
                          const config = getCategoryConfig(frequencies)
                          return (
                            <Badge key={index} className="bg-white border-indigo-200 text-indigo-800">
                              {config.label}
                            </Badge>
                          )
                        })} */}

                      {/* {formatFrequencyRules(task.master_task.).map((badge, index) => (
                          <Badge
                            key={index}
                            // className="bg-white border-indigo-200 text-indigo-800"
                            className={`${badge.color} border ${badge.isMain ? 'border-indigo-200 text-indigo-800' : 'text-indigo-800'}`}
                          >
                            {badge.label}
                          </Badge>
                        ))} */}
                    </div>
                  </div>
                )}

              </div>

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

            </CardContent>
          </Card>

          {/* Completion History */}
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Clock className="h-5 w-5 text-indigo-600" />
                <span>Completion Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Current Status Summary */}
              <div className={`p-4 rounded-lg border mb-6 ${task.status === 'completed'
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
                }`}>
                <div className="flex items-center space-x-2 mb-3">
                  {task.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-orange-600" />
                  )}
                  <span className={`font-semibold text-lg ${task.status === 'completed' ? 'text-green-800' : 'text-orange-800'
                    }`}>
                    Current Status: {task.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                </div>

                {task.status === 'completed' && task.completed_at && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {task.position_completions.map((completion: any, index: number) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                ✓ {completion.position_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Badge>
                            </div>
                            <div className="text-sm text-green-700 space-y-1">
                              <p>
                                <span className="font-medium">Completed at:</span>{' '}
                                {new Date(completion.completed_at).toLocaleString('en-AU', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {completion.completed_by && (
                                <p>
                                  <span className="font-medium">Completed by:</span> {completion.completed_by}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {task.status !== 'completed' && (
                  <p className="text-orange-700 text-sm">
                    This task is currently pending completion.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Fixed Footer */}
        <div className="flex-shrink-0 pt-4 border-t mt-auto">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => document.querySelector('[data-state="open"] button[aria-label="Close"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
              Close
            </Button>
          </div>
        </div>
        {/* </div> */}
      </DialogContent>
    </Dialog>
  )
}