'use client'

import { useState } from 'react'
import { Edit, Trash2, Calendar, Clock, Tag, Users, AlertCircle, CheckCircle2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import type { MasterChecklistTask, FrequencyRule, FrequencyType } from '@/types/checklist'
import { toDisplayFormat } from '@/lib/responsibility-mapper'
import { getAustralianToday, getAustralianNow } from '@/lib/timezone-utils'

// Responsibility options are now handled dynamically via toDisplayFormat utility
// This removes hardcoded position names and uses database-driven data

// Define category options for proper display names
const CATEGORY_OPTIONS = [
  { value: 'stock-control', label: 'Stock Control' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'pharmacy-services', label: 'Pharmacy Services' },
  { value: 'fos-operations', label: 'FOS Operations' },
  { value: 'dispensary-operations', label: 'Dispensary Operations' },
  { value: 'general-pharmacy-operations', label: 'General Pharmacy Operations' },
  { value: 'business-management', label: 'Business Management' }
]

// Helper function to get display name for responsibilities
const getResponsibilityDisplayName = (value: string): string => {
  return toDisplayFormat(value)
}

// Helper function to get display name for categories
const getCategoryDisplayName = (value: string): string => {
  const option = CATEGORY_OPTIONS.find(opt => opt.value === value)
  return option ? option.label : value.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

interface TaskListItemProps {
  task: MasterChecklistTask
  onEdit: (task: MasterChecklistTask) => void
  onDelete: (taskId: string) => void
}

export default function TaskListItem({ task, onEdit, onDelete }: TaskListItemProps) {
  const [previewOccurrences, setPreviewOccurrences] = useState<string[]>([])
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  const getFrequencyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'once_off': 'Once Off',
      'daily': 'Daily',
      'weekly': 'Weekly',
      'specific_weekdays': 'Specific Weekdays',
      'start_of_month': 'Start of Month',
      'end_of_month': 'End of Month',
      'every_month': 'Every Month',
      'certain_months': 'Certain Months'
    }
    return labels[type] || type
  }

  const getTimingLabel = (timing: string) => {
    const labels: Record<string, string> = {
      'morning': 'Morning',
      'afternoon': 'Afternoon',
      'evening': 'Evening',
      'anytime': 'Anytime'
    }
    return labels[timing] || timing
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getFrequencyDescription = (rules: FrequencyRule) => {
    switch (rules.type) {
      case 'daily':
        return `Every ${rules.every_n_days || 1} day${rules.every_n_days !== 1 ? 's' : ''}${rules.business_days_only ? ' (business days only)' : ''}`
      case 'weekly':
        return `Every ${rules.every_n_weeks || 1} week${rules.every_n_weeks !== 1 ? 's' : ''}`
      case 'specific_weekdays':
        const weekdays = rules.weekdays?.map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1]).join(', ') || ''
        return `Every ${weekdays}${rules.every_n_weeks ? ` (every ${rules.every_n_weeks} week${rules.every_n_weeks !== 1 ? 's' : ''})` : ''}`
      case 'start_of_month':
        return `Start of month${rules.every_n_months ? ` (every ${rules.every_n_months} month${rules.every_n_months !== 1 ? 's' : ''})` : ''}`
      case 'end_of_month':
        return `End of month${rules.every_n_months ? ` (every ${rules.every_n_months} month${rules.every_n_months !== 1 ? 's' : ''})` : ''}`
      case 'every_month':
        return `Every month${rules.every_n_months ? ` (every ${rules.every_n_months} month${rules.every_n_months !== 1 ? 's' : ''})` : ''}`
      case 'certain_months':
        const months = rules.months?.map(m => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]).join(', ') || ''
        return `Certain months: ${months}`
      case 'once_off':
        return `Once off${rules.due_date ? ` on ${new Date(rules.due_date).toLocaleDateString()}` : ''}`
      default:
        return rules.type
    }
  }

  const generatePreview = async () => {
    setIsGeneratingPreview(true)
    
    try {
      // Create sample holidays for preview (same as TaskForm)
      const sampleHolidays = [
        { date: '2024-01-01', name: 'New Year\'s Day' },
        { date: '2024-01-26', name: 'Australia Day' },
        { date: '2024-04-25', name: 'ANZAC Day' },
        { date: '2024-12-25', name: 'Christmas Day' },
        { date: '2024-12-26', name: 'Boxing Day' }
      ]
      
      const holidayHelper = createHolidayHelper(sampleHolidays)
      const recurrenceEngine = createRecurrenceEngine(holidayHelper)
      
      const taskForPreview = {
        id: 'preview',
        frequency_rules: task.frequency_rules,
        start_date: task.start_date || getAustralianToday(),
        end_date: task.end_date
      }
      
      const australianNow = getAustralianNow()
      const oneYearFromNow = new Date(australianNow.getTime() + 365 * 24 * 60 * 60 * 1000)
      
      const occurrences = recurrenceEngine.occurrencesBetween(
        taskForPreview,
        australianNow,
        oneYearFromNow
      )
      
      const nextOccurrences = occurrences.slice(0, 6)
      const formattedOccurrences = nextOccurrences.map(occurrence => 
        occurrence.date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      )
      
      setPreviewOccurrences(formattedOccurrences)
    } catch (error) {
      console.error('Error generating preview:', error)
      setPreviewOccurrences(['Error generating preview'])
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-gray-900 truncate">
              {task.title}
            </CardTitle>
            {task.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <Badge className={getStatusColor(task.publish_status)}>
              {task.publish_status.charAt(0).toUpperCase() + task.publish_status.slice(1)}
            </Badge>
            
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (previewOccurrences.length === 0) {
                      generatePreview()
                    }
                  }}
                  disabled={isGeneratingPreview}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Next 6 Occurrences</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {isGeneratingPreview ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600">Generating preview...</p>
                    </div>
                  ) : previewOccurrences.length > 0 ? (
                    previewOccurrences.map((occurrence, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 rounded-md bg-gray-50">
                        <span className="text-sm font-medium text-gray-900">{index + 1}.</span>
                        <span className="text-sm text-gray-700">{occurrence}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-600 text-center py-4">
                      Click Preview to see next occurrences
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(task)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Frequency */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Frequency
              </p>
              <p className="text-sm text-gray-900 truncate">
                {getFrequencyTypeLabel(task.frequency_rules.type)}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {getFrequencyDescription(task.frequency_rules)}
              </p>
            </div>
          </div>

          {/* Timing */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Timing
              </p>
              <p className="text-sm text-gray-900">
                {getTimingLabel(task.timing)}
              </p>
              {task.due_time && (
                <p className="text-xs text-gray-600">
                  Due: {task.due_time}
                </p>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center space-x-2">
            <Tag className="h-4 w-4 text-gray-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Categories
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.categories?.slice(0, 2).map((category, index) => (
                  <Badge key={index} variant="secondary" className="text-xs whitespace-nowrap">
                    {getCategoryDisplayName(category)}
                  </Badge>
                ))}
                {task.categories && task.categories.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    + ({task.categories.length - 2})
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Responsibility */}
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Responsibility
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.responsibility?.slice(0, 2).map((role, index) => (
                  <Badge key={index} variant="outline" className="text-xs whitespace-nowrap">
                    {getResponsibilityDisplayName(role)}
                  </Badge>
                ))}
                {task.responsibility && task.responsibility.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    + ({task.responsibility.length - 2})
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              {task.sticky_once_off && (
                <div className="flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Sticky Once-off</span>
                </div>
              )}
              {task.allow_edit_when_locked && (
                <div className="flex items-center space-x-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>Editable when locked</span>
                </div>
              )}
            </div>
            
            <div className="text-right">
              <p>Created: {new Date(task.created_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
              {task.updated_at !== task.created_at && (
                <p>Updated: {new Date(task.updated_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
