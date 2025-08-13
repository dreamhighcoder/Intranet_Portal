"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, AlertCircle, Info } from "lucide-react"

interface MasterTask {
  id?: string
  title: string
  description?: string
  position_id?: string
  frequency: string
  weekdays: number[]
  months: number[]
  timing?: string
  default_due_time?: string
  category?: string
  publish_status: 'draft' | 'active' | 'inactive'
  publish_delay_date?: string
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
}

interface Position {
  id: string
  name: string
}

interface MasterTaskFormProps {
  task?: MasterTask | null
  positions: Position[]
  onSave: (task: MasterTask) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

const frequencyOptions = [
  { value: 'once_off_sticky', label: 'Once-off Sticky', description: 'Persists until completed' },
  { value: 'every_day', label: 'Every Day', description: 'Mon-Sat, no public holidays' },
  { value: 'weekly', label: 'Weekly', description: 'Monday anchor, PH push-forward' },
  { value: 'specific_weekdays', label: 'Specific Weekdays', description: 'Custom weekday selection' },
  { value: 'start_every_month', label: 'Start of Every Month', description: 'Due +5 workdays' },
  { value: 'start_certain_months', label: 'Start of Certain Months', description: 'Due +5 workdays' },
  { value: 'every_month', label: 'Every Month', description: 'Due last Saturday' },
  { value: 'certain_months', label: 'Certain Months Only', description: 'Due last Saturday' },
  { value: 'end_every_month', label: 'End of Every Month', description: 'Last/second-last Monday' },
  { value: 'end_certain_months', label: 'End of Certain Months', description: 'Last/second-last Monday' }
]

const weekdayOptions = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
]

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

const timingOptions = [
  { value: 'morning', label: 'Morning' },
  { value: 'before_close', label: 'Before Close' },
  { value: 'custom', label: 'Custom Time' }
]

const categoryOptions = [
  'Daily Operations',
  'Weekly Tasks',
  'Monthly Reports',
  'Compliance',
  'Inventory',
  'Customer Service',
  'Administration',
  'Maintenance',
  'Training',
  'Quality Control'
]

export function MasterTaskForm({ task, positions, onSave, onCancel, loading = false }: MasterTaskFormProps) {
  const [formData, setFormData] = useState<MasterTask>(() => {
    const defaultData = {
      title: '',
      description: '',
      position_id: '',
      frequency: 'every_day',
      weekdays: [],
      months: [],
      timing: 'morning',
      default_due_time: '17:00',
      category: '',
      publish_status: 'draft',
      publish_delay_date: '',
      sticky_once_off: false,
      allow_edit_when_locked: false
    }
    
    if (task) {
      // Ensure null values are converted to empty strings for controlled inputs
      return {
        ...defaultData,
        ...task,
        title: task.title || '',
        description: task.description || '',
        position_id: task.position_id || '',
        timing: task.timing || 'morning',
        default_due_time: task.default_due_time || '17:00',
        category: task.category || '',
        publish_delay_date: task.publish_delay_date || '',
        weekdays: task.weekdays || [],
        months: task.months || []
      }
    }
    
    return defaultData
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customCategory, setCustomCategory] = useState('')
  const [showCustomCategory, setShowCustomCategory] = useState(false)

  useEffect(() => {
    if (task) {
      // Ensure null values are converted to empty strings for controlled inputs
      const sanitizedTask = {
        ...task,
        title: task.title || '',
        description: task.description || '',
        position_id: task.position_id || '',
        timing: task.timing || 'morning',
        default_due_time: task.default_due_time || '17:00',
        category: task.category || '',
        publish_delay_date: task.publish_delay_date || '',
        weekdays: task.weekdays || [],
        months: task.months || []
      }
      setFormData(sanitizedTask)
      // Check if category is custom (not in predefined list)
      if (task.category && !categoryOptions.includes(task.category)) {
        setCustomCategory(task.category)
        setShowCustomCategory(true)
      }
    }
  }, [task])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.position_id) {
      newErrors.position_id = 'Position is required'
    }

    if (formData.frequency === 'specific_weekdays' && formData.weekdays.length === 0) {
      newErrors.weekdays = 'At least one weekday must be selected'
    }

    if (['start_certain_months', 'certain_months', 'end_certain_months'].includes(formData.frequency) && formData.months.length === 0) {
      newErrors.months = 'At least one month must be selected'
    }

    if (formData.timing === 'custom' && !formData.default_due_time) {
      newErrors.default_due_time = 'Due time is required for custom timing'
    }

    if (formData.publish_delay_date && new Date(formData.publish_delay_date) < new Date()) {
      newErrors.publish_delay_date = 'Publish delay date must be in the future'
    }

    console.log('Form validation errors:', newErrors)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const finalCategory = showCustomCategory ? customCategory : formData.category
    const taskData = {
      ...formData,
      category: finalCategory || undefined
    }

    try {
      await onSave(taskData)
    } catch (error) {
      console.error('Error saving task:', error)
      // Error handling is done in the parent component
    }
  }

  const handleWeekdayToggle = (weekday: number) => {
    const newWeekdays = formData.weekdays.includes(weekday)
      ? formData.weekdays.filter(w => w !== weekday)
      : [...formData.weekdays, weekday].sort()
    
    setFormData({ ...formData, weekdays: newWeekdays })
  }

  const handleMonthToggle = (month: number) => {
    const newMonths = formData.months.includes(month)
      ? formData.months.filter(m => m !== month)
      : [...formData.months, month].sort()
    
    setFormData({ ...formData, months: newMonths })
  }

  const selectedFrequency = frequencyOptions.find(f => f.value === formData.frequency)
  const needsWeekdays = formData.frequency === 'specific_weekdays'
  const needsMonths = ['start_certain_months', 'certain_months', 'end_certain_months'].includes(formData.frequency)

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSubmit} className="master-task-form flex-1 overflow-y-auto px-1">
        <div className="space-y-4 pb-4">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Info className="w-5 h-5 mr-2" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Title - Full width */}
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">{errors.title}</p>
              )}
            </div>

            {/* Description - Full width */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Position and Category - Side by side on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Position *</Label>
                <Select
                  value={formData.position_id}
                  onValueChange={(value) => setFormData({ ...formData, position_id: value })}
                >
                  <SelectTrigger className={errors.position_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(position => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.position_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.position_id}</p>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <div className="space-y-2">
                  <Select
                    value={showCustomCategory ? 'custom' : (formData.category || 'none')}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setShowCustomCategory(true)
                        setFormData({ ...formData, category: '' })
                      } else if (value === 'none') {
                        setShowCustomCategory(false)
                        setFormData({ ...formData, category: '' })
                      } else {
                        setShowCustomCategory(false)
                        setFormData({ ...formData, category: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categoryOptions.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Category...</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {showCustomCategory && (
                    <Input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter custom category"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frequency Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Frequency Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="frequency">Frequency Type *</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                frequency: value,
                weekdays: value === 'specific_weekdays' ? formData.weekdays : [],
                months: ['start_certain_months', 'certain_months', 'end_certain_months'].includes(value) ? formData.months : []
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedFrequency && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedFrequency.description}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {needsWeekdays && (
            <div>
              <Label>Weekdays *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-2">
                {weekdayOptions.map(weekday => (
                  <div key={weekday.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`weekday-${weekday.value}`}
                      checked={formData.weekdays.includes(weekday.value)}
                      onCheckedChange={() => handleWeekdayToggle(weekday.value)}
                    />
                    <Label 
                      htmlFor={`weekday-${weekday.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {weekday.label}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.weekdays && (
                <p className="text-sm text-red-600 mt-1">{errors.weekdays}</p>
              )}
            </div>
          )}

          {needsMonths && (
            <div>
              <Label>Months *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                {monthOptions.map(month => (
                  <div key={month.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`month-${month.value}`}
                      checked={formData.months.includes(month.value)}
                      onCheckedChange={() => handleMonthToggle(month.value)}
                    />
                    <Label 
                      htmlFor={`month-${month.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {month.label}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.months && (
                <p className="text-sm text-red-600 mt-1">{errors.months}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Timing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timing">Timing</Label>
              <Select
                value={formData.timing}
                onValueChange={(value) => setFormData({ ...formData, timing: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timingOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="due_time">Default Due Time</Label>
              <Input
                id="due_time"
                type="time"
                value={formData.default_due_time}
                onChange={(e) => setFormData({ ...formData, default_due_time: e.target.value })}
                className={errors.default_due_time ? 'border-red-500' : ''}
              />
              {errors.default_due_time && (
                <p className="text-sm text-red-600 mt-1">{errors.default_due_time}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publishing & Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Publishing & Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Publish Status</Label>
              <Select
                value={formData.publish_status}
                onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                  setFormData({ ...formData, publish_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="delay_date">Publish Delay Date</Label>
              <Input
                id="delay_date"
                type="date"
                value={formData.publish_delay_date}
                onChange={(e) => setFormData({ ...formData, publish_delay_date: e.target.value })}
                className={errors.publish_delay_date ? 'border-red-500' : ''}
              />
              {errors.publish_delay_date && (
                <p className="text-sm text-red-600 mt-1">{errors.publish_delay_date}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="sticky_once_off"
                  checked={formData.sticky_once_off}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, sticky_once_off: checked as boolean })
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="sticky_once_off" className="cursor-pointer font-medium">
                    Sticky Once-off
                  </Label>
                  <p className="text-sm text-gray-600">
                    Task persists until completed, never auto-locks
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="allow_edit_when_locked"
                  checked={formData.allow_edit_when_locked}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, allow_edit_when_locked: checked as boolean })
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="allow_edit_when_locked" className="cursor-pointer font-medium">
                    Allow Edit When Locked
                  </Label>
                  <p className="text-sm text-gray-600">
                    Task can be edited even after being locked due to missed status
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

        </div>
      </form>
      
      {/* Form Actions - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-white/95 backdrop-blur-sm p-4 mt-4 sticky bottom-0">
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto min-w-[100px] h-10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-w-[120px] h-10 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            onClick={handleSubmit}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </div>
            ) : (
              task ? 'Update Task' : 'Create Task'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}