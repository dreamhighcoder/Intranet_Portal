'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar, Clock, Tag, Users, CalendarDays, AlertCircle, CheckCircle2, Info, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'

import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { RESPONSIBILITY_OPTIONS, TASK_CATEGORIES, TASK_FREQUENCIES, TASK_TIMINGS, DEFAULT_DUE_TIMES } from '@/lib/constants'
import type { MasterChecklistTask, CreateMasterTaskRequest, UpdateMasterTaskRequest, FrequencyRule } from '@/types/checklist'

// Zod schema for form validation
const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required').max(200, 'Description must be less than 200 characters'),
  responsibility: z.array(z.string()).min(1, 'At least one responsibility is required'),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  timing: z.enum(['opening', 'anytime_during_day', 'before_order_cut_off', 'closing']),
  due_time: z.string().optional(),
  due_date: z.string().optional(),
  publish_status: z.enum(['active', 'inactive', 'draft']),
  publish_delay: z.string().optional(),
  frequency: z.enum([
    'once_off', 'every_day', 'once_weekly', 'monday', 'tuesday', 'wednesday', 
    'thursday', 'friday', 'saturday', 'once_monthly', 'start_of_month_jan',
    'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul',
    'start_of_month_aug', 'start_of_month_sep', 'start_of_month_oct',
    'start_of_month_nov', 'start_of_month_dec', 'end_of_month_jan',
    'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul',
    'end_of_month_aug', 'end_of_month_sep', 'end_of_month_oct',
    'end_of_month_nov', 'end_of_month_dec'
  ]),
  start_date: z.string().optional(),
  end_date: z.string().optional()
})

type TaskFormData = z.infer<typeof taskFormSchema>

interface TaskFormProps {
  task?: MasterChecklistTask
  onSubmit: (data: CreateMasterTaskRequest | UpdateMasterTaskRequest) => void
  onCancel: () => void
}

export default function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const [previewOccurrences, setPreviewOccurrences] = useState<string[]>([])
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  const isEditing = !!task

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      responsibility: task?.responsibility || [],
      categories: task?.categories || [],
      timing: task?.timing || 'opening',
      due_time: task?.due_time || DEFAULT_DUE_TIMES.opening,
      due_date: task?.due_date || '',
      publish_status: task?.publish_status || 'draft',
      publish_delay: task?.publish_delay || '',
      frequency: task?.frequency || 'every_day',
      start_date: task?.start_date || new Date().toISOString().split('T')[0],
      end_date: task?.end_date || ''
    }
  })

  const { watch, setValue, formState: { errors, isValid } } = form
  const frequency = watch('frequency')
  const timing = watch('timing')

  // Auto-fill due_time based on timing selection
  React.useEffect(() => {
    if (timing && DEFAULT_DUE_TIMES[timing as keyof typeof DEFAULT_DUE_TIMES]) {
      setValue('due_time', DEFAULT_DUE_TIMES[timing as keyof typeof DEFAULT_DUE_TIMES])
    }
  }, [timing, setValue])

  const generatePreview = async () => {
    setIsGeneratingPreview(true)
    
    try {
      const formData = form.getValues()
      
      // Validate required fields for preview
      if (!formData.frequency_type) {
        throw new Error('Frequency type is required for preview')
      }
      
      const frequencyRules = buildFrequencyRules(formData)
      
      const sampleHolidays = [
        { date: '2024-01-01', name: 'New Year\'s Day' },
        { date: '2024-01-26', name: 'Australia Day' },
        { date: '2024-04-25', name: 'ANZAC Day' },
        { date: '2024-12-25', name: 'Christmas Day' },
        { date: '2024-12-26', name: 'Boxing Day' }
      ]
      
      const holidayHelper = createHolidayHelper(sampleHolidays)
      const recurrenceEngine = createRecurrenceEngine(holidayHelper)
      
      const startDate = formData.start_date || new Date().toISOString().split('T')[0]
      
      const task = {
        id: 'preview',
        frequency_rules: frequencyRules,
        start_date: startDate,
        end_date: formData.end_date || undefined
      }
      
      // Use a start date that's not in the past for better preview results
      const previewStartDate = new Date(Math.max(new Date().getTime(), new Date(startDate).getTime()))
      
      const occurrences = recurrenceEngine.occurrencesBetween(
        task,
        previewStartDate,
        new Date(previewStartDate.getTime() + 365 * 24 * 60 * 60 * 1000)
      )
      
      const nextOccurrences = occurrences.slice(0, 6)
      setPreviewOccurrences(nextOccurrences.map(occurrence => occurrence.date.toISOString().split('T')[0]))
      
    } catch (error) {
      console.error('Error generating preview:', error)
      setPreviewOccurrences([])
      // You could add a toast notification here to inform the user
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const buildFrequencyRules = (data: TaskFormData): FrequencyRule => {
    const baseRule = {
      business_days_only: data.business_days_only,
      start_date: data.start_date,
      end_date: data.end_date,
      max_occurrences: data.max_occurrences
    }

    switch (data.frequency_type) {
      case 'once_off':
        return {
          type: 'once_off',
          due_date: data.due_date || new Date().toISOString().split('T')[0],
          ...baseRule
        }

      case 'daily':
        return {
          type: 'daily',
          every_n_days: data.every_n_days || 1,
          ...baseRule
        }

      case 'weekly':
        return {
          type: 'weekly',
          every_n_weeks: data.every_n_weeks || 1,
          start_day: data.start_day || 1,
          ...baseRule
        }

      case 'specific_weekdays':
        return {
          type: 'specific_weekdays',
          weekdays: data.weekdays || [1, 2, 3, 4, 5],
          every_n_weeks: data.every_n_weeks || 1,
          ...baseRule
        }

      case 'start_of_month':
        return {
          type: 'start_of_month',
          day_offset: data.start_day || 1,
          every_n_months: data.every_n_months || 1,
          months: data.months || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          ...baseRule
        }

      case 'end_of_month':
        return {
          type: 'end_of_month',
          days_from_end: data.end_day || 1,
          every_n_months: data.every_n_months || 1,
          months: data.months || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          ...baseRule
        }

      case 'every_month':
        return {
          type: 'every_month',
          every_n_months: data.every_n_months || 1,
          ...baseRule
        }

      case 'certain_months':
        return {
          type: 'certain_months',
          months: data.months || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          ...baseRule
        }

      default:
        return {
          type: 'daily',
          every_n_days: 1,
          ...baseRule
        }
    }
  }

  const handleSubmit = (data: TaskFormData) => {
    const frequencyRules = buildFrequencyRules(data)
    
    const taskData = {
      title: data.title,
      description: data.description,
      responsibility: data.responsibility,
      categories: data.categories,
      timing: data.timing,
      due_time: data.due_time,
      due_date: data.due_date,
      publish_status: data.publish_status,
      publish_delay: data.publish_delay,
      start_date: data.start_date,
      end_date: data.end_date,
      frequency_rules: frequencyRules
    }

    onSubmit(taskData)
    setShowConfirmModal(false)
  }

  const handleCreateClick = () => {
    const formData = form.getValues()
    const requiredFields = ['title', 'description', 'responsibility', 'categories']
    const missingFields = requiredFields.filter(field => {
      const value = formData[field as keyof TaskFormData]
      return !value || (Array.isArray(value) && value.length === 0)
    })

    if (missingFields.length > 0) {
      // Show validation errors
      form.trigger()
      return
    }

    setShowConfirmModal(true)
  }

  const addArrayItem = (field: keyof TaskFormData, value: string | number) => {
    const current = form.getValues(field) as (string | number)[]
    if (current && !current.includes(value)) {
      form.setValue(field, [...current, value])
    }
  }

  const removeArrayItem = (field: keyof TaskFormData, value: string | number) => {
    const current = form.getValues(field) as (string | number)[]
    if (current) {
      form.setValue(field, current.filter(item => item !== value))
    }
  }

  return (
    <div className="h-full flex flex-col">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 space-y-4 sm:space-y-6 pb-4">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>Basic Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Enter task title"
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="timing">Timing *</Label>
              <Select
                value={form.watch('timing')}
                onValueChange={(value) => form.setValue('timing', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TIMINGS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="description">Task Description *</Label>
              <span className="text-xs text-muted-foreground">
                {form.watch('description')?.length || 0}/200 characters
              </span>
            </div>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Enter task description"
              rows={3}
              className={errors.description ? "border-red-500" : ""}
              maxLength={200}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="due_time">Due Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="due_time"
                  type="time"
                  {...form.register('due_time')}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="due_date">Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="due_date"
                  type="date"
                  {...form.register('due_date')}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories and Responsibilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Tag className="h-5 w-5" />
            <span>Categories & Responsibilities</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Categories Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Categories *</Label>
              <span className="text-xs text-muted-foreground">
                {form.watch('categories')?.length || 0} selected
              </span>
            </div>
            
            <div className="space-y-3">
              {/* Add Category Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-auto"
                    type="button"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <div className="space-y-2">
                    {TASK_CATEGORIES.map(category => (
                      <div
                        key={category.value}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => {
                          const current = form.getValues('categories') || [];
                          if (!current.includes(category.value)) {
                            form.setValue('categories', [...current, category.value]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={form.watch('categories')?.includes(category.value)}
                          readOnly
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
                        />
                        <span className="text-sm">{category.label}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Selected Categories */}
              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {form.watch('categories')?.map(category => {
                  const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
                  return (
                    <Badge 
                      key={category} 
                      className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 flex items-center gap-2"
                    >
                      {categoryObj?.label || category}
                      <button 
                        type="button"
                        className="hover:bg-blue-800 rounded-full p-0.5" 
                        onClick={() => removeArrayItem('categories', category)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
            {errors.categories && (
              <p className="text-sm text-red-500">{errors.categories.message}</p>
            )}
          </div>

          {/* Responsibilities Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Responsibilities *</Label>
              <span className="text-xs text-muted-foreground">
                {form.watch('responsibility')?.length || 0} selected
              </span>
            </div>
            
            <div className="space-y-3">
              {/* Add Responsibility Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-auto"
                    type="button"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Responsibility
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="start">
                  <div className="space-y-2">
                    {RESPONSIBILITY_OPTIONS.map(responsibility => (
                      <div
                        key={responsibility.value}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => {
                          const current = form.getValues('responsibility') || [];
                          if (!current.includes(responsibility.value)) {
                            form.setValue('responsibility', [...current, responsibility.value]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={form.watch('responsibility')?.includes(responsibility.value)}
                          readOnly
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
                        />
                        <span className="text-sm">{responsibility.label}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Selected Responsibilities */}
              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {form.watch('responsibility')?.map(responsibility => {
                  const responsibilityObj = RESPONSIBILITY_OPTIONS.find(r => r.value === responsibility);
                  return (
                    <Badge 
                      key={responsibility} 
                      className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 flex items-center gap-2"
                    >
                      {responsibilityObj?.label || responsibility}
                      <button 
                        type="button"
                        className="hover:bg-blue-800 rounded-full p-0.5" 
                        onClick={() => removeArrayItem('responsibility', responsibility)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
            {errors.responsibility && (
              <p className="text-sm text-red-500">{errors.responsibility.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarDays className="h-5 w-5" />
            <span>Frequency</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Frequency *</Label>
            <Select
              value={frequency}
              onValueChange={(value) => form.setValue('frequency', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_FREQUENCIES.map(freq => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show due date field only for once_off frequency */}
          {frequency === 'once_off' && (
            <div className="space-y-3">
              <Label htmlFor="due_date_once_off">Due Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="due_date_once_off"
                  type="date"
                  {...form.register('due_date')}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                For once-off tasks, manually enter the due date. For recurring tasks, due dates are auto-calculated.
              </p>
            </div>
          )}

          {/* Frequency-specific options */}
          {frequencyType === 'daily' && (
            <div className="space-y-2">
              <Label htmlFor="every_n_days">Every N Days</Label>
              <Input
                id="every_n_days"
                type="number"
                min="1"
                max="365"
                {...form.register('every_n_days', { valueAsNumber: true })}
                placeholder="1"
              />
            </div>
          )}

          {frequencyType === 'weekly' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="every_n_weeks">Every N Weeks</Label>
                <Input
                  id="every_n_weeks"
                  type="number"
                  min="1"
                  max="52"
                  {...form.register('every_n_weeks', { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_day">Start Day</Label>
                <Select
                  value={form.watch('start_day')?.toString() || '1'}
                  onValueChange={(value) => form.setValue('start_day', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                    <SelectItem value="0">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {frequencyType === 'specific_weekdays' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Select Weekdays</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'Sun' },
                    { value: 1, label: 'Mon' },
                    { value: 2, label: 'Tue' },
                    { value: 3, label: 'Wed' },
                    { value: 4, label: 'Thu' },
                    { value: 5, label: 'Fri' },
                    { value: 6, label: 'Sat' }
                  ].map(day => (
                    <Badge
                      key={day.value}
                      variant={form.watch('weekdays')?.includes(day.value) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        form.watch('weekdays')?.includes(day.value) 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        const current = form.getValues('weekdays') || []
                        if (current.includes(day.value)) {
                          form.setValue('weekdays', current.filter(d => d !== day.value))
                        } else {
                          form.setValue('weekdays', [...current, day.value])
                        }
                      }}
                    >
                      {day.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="every_n_weeks">Every N Weeks</Label>
                <Input
                  id="every_n_weeks"
                  type="number"
                  min="1"
                  max="52"
                  {...form.register('every_n_weeks', { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>
            </div>
          )}

          {/* Common options */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="business_days_only"
                checked={form.watch('business_days_only')}
                onCheckedChange={(checked) => form.setValue('business_days_only', checked)}
                className="data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border-gray-300"
              />
              <Label htmlFor="business_days_only">Business Days Only (Skip weekends & holidays)</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...form.register('start_date')}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="end_date">End Date (Optional)</Label>
                <Input
                  id="end_date"
                  type="date"
                  {...form.register('end_date')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>{/* Publishing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Publishing</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 h-5">
                <Label>Publishing Status *</Label>
              </div>
              <Select
                value={form.watch('publish_status')}
                onValueChange={(value) => form.setValue('publish_status', value as any)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {errors.publish_status && (
                <p className="text-sm text-red-500">{errors.publish_status.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2 h-5">
                <Label htmlFor="publish_delay">Publishing Delay</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 rounded-full">
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">About Publishing Delay</h4>
                      <p className="text-sm text-muted-foreground">
                        Select a future date if you want to delay when this task becomes visible. 
                        If no date is selected, tasks will publish immediately.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <DatePicker
                date={form.watch('publish_delay') ? new Date(form.watch('publish_delay')) : undefined}
                onDateChange={(date) => {
                  if (date) {
                    form.setValue('publish_delay', date.toISOString().split('T')[0]);
                  } else {
                    form.setValue('publish_delay', '');
                  }
                }}
                placeholder="Select a date (optional)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Preview Next 6 Occurrences</span>
            <Button
              type="button"
              variant="outline"
              onClick={generatePreview}
              disabled={isGeneratingPreview}
            >
              {isGeneratingPreview ? 'Generating...' : 'Generate Preview'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {previewOccurrences.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {previewOccurrences.map((date, index) => (
                <Badge key={index} variant="secondary" className="text-center">
                  {new Date(date).toLocaleDateString()}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click "Generate Preview" to see when this task will occur next
            </p>
          )}
        </CardContent>
      </Card>

      </form>
      
      {/* Form Actions - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-white p-4 flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="button" 
          onClick={handleCreateClick}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isEditing ? 'Update Task' : 'Create Task'}
        </Button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ pointerEvents: 'none' }}
        >
          {/* Modal content - no backdrop */}
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border-2 border-gray-200 relative z-10"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              {isEditing ? 'Update Task' : 'Create Task'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isEditing 
                ? 'Are you sure you want to update this task?' 
                : 'Are you sure you want to create this task? All required fields have been completed.'
              }
            </p>
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={form.handleSubmit(handleSubmit)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isEditing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
