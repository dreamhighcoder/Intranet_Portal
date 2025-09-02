'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar, Clock, Tag, Users, CalendarDays, AlertCircle, CheckCircle2, Info, Plus, X as XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

import { TASK_CATEGORIES, TASK_FREQUENCIES, TASK_TIMINGS, DEFAULT_DUE_TIMES } from '@/lib/constants'
import { getResponsibilityOptions } from '@/lib/position-utils'
import { toDisplayFormat } from '@/lib/responsibility-mapper'
import type { MasterChecklistTask, CreateMasterTaskRequest, UpdateMasterTaskRequest } from '@/types/checklist'
import { getAustralianToday } from '@/lib/timezone-utils'

// Zod schema for form validation matching specifications
const taskFormSchema = z.object({
  title: z.string().max(200, 'Title must be less than 500 characters').optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  responsibility: z.array(z.string()).min(1, 'At least one responsibility is required'),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  timing: z.enum(['opening', 'anytime_during_day', 'before_order_cut_off', 'closing']),
  due_time: z.string().optional(),
  due_date: z.string().optional(),
  publish_status: z.enum(['active', 'inactive', 'draft']),
  publish_delay: z.string().optional(),
  frequencies: z.array(z.enum([
    'once_off', 'every_day', 'once_weekly', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul',
    'start_of_month_aug', 'start_of_month_sep', 'start_of_month_oct',
    'start_of_month_nov', 'start_of_month_dec', 'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul',
    'end_of_month_aug', 'end_of_month_sep', 'end_of_month_oct',
    'end_of_month_nov', 'end_of_month_dec'
  ])).min(1, 'At least one frequency is required'),
  start_date: z.string().optional(),
  end_date: z.string().optional()
})

type TaskFormData = z.infer<typeof taskFormSchema>

interface TaskFormProps {
  task?: MasterChecklistTask
  onSubmit: (data: CreateMasterTaskRequest | UpdateMasterTaskRequest) => void
  onCancel: () => void
}

export default function TaskFormNew({ task, onSubmit, onCancel }: TaskFormProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [responsibilityOptions, setResponsibilityOptions] = useState<{ value: string; label: string }[]>([])

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
      due_date: task?.due_date || undefined,
      publish_status: task?.publish_status || 'draft',
      publish_delay: task?.publish_delay || undefined,
      frequencies: task?.frequencies || [],
      start_date: task?.start_date || getAustralianToday(),
      end_date: task?.end_date || undefined
    }
  })

  const { watch, setValue, formState: { errors, isValid } } = form
  const frequencies = watch('frequencies')
  const timing = watch('timing')

  // Load dynamic responsibilities from Positions + shared
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const opts = await getResponsibilityOptions()
        if (mounted) setResponsibilityOptions(opts)
      } catch {
        if (mounted) setResponsibilityOptions([])
      }
    })()
    return () => { mounted = false }
  }, [])

  // Auto-fill due_time based on timing selection
  useEffect(() => {
    if (timing && DEFAULT_DUE_TIMES[timing as keyof typeof DEFAULT_DUE_TIMES]) {
      setValue('due_time', DEFAULT_DUE_TIMES[timing as keyof typeof DEFAULT_DUE_TIMES])
    }
  }, [timing, setValue])

  const handleSubmit = (data: TaskFormData) => {
    // Create a base task data object with required fields
    const taskData: any = {
      title: data.title,
      description: data.description,
      responsibility: data.responsibility,
      categories: data.categories,
      timing: data.timing,
      due_time: data.due_time,
      publish_status: data.publish_status,
      frequencies: data.frequencies
    }

    // Only add date fields if they have valid values
    if (data.due_date && data.due_date.trim() !== '') {
      taskData.due_date = data.due_date
    }

    if (data.publish_delay && data.publish_delay.trim() !== '') {
      taskData.publish_delay = data.publish_delay
    }

    if (data.start_date && data.start_date.trim() !== '') {
      taskData.start_date = data.start_date
    }

    if (data.end_date && data.end_date.trim() !== '') {
      taskData.end_date = data.end_date
    }

    console.log('Submitting task data:', taskData)
    onSubmit(taskData)
    setShowConfirmModal(false)
  }

  const handleCreateClick = async () => {
    // Get current form values
    const formData = form.getValues()
    
    // Check required fields: Description, Responsibilities, Categories, and Frequency
    const requiredFields = [
      { field: 'description', label: 'Description', value: formData.description },
      { field: 'responsibility', label: 'Responsibilities', value: formData.responsibility },
      { field: 'categories', label: 'Categories', value: formData.categories },
      { field: 'frequencies', label: 'Frequency', value: formData.frequencies }
    ]
    
    const missingFields = requiredFields.filter(({ value }) => {
      if (Array.isArray(value)) {
        return !value || value.length === 0
      }
      return !value || value.trim() === ''
    })
    
    if (missingFields.length > 0) {
      // Set errors for missing fields
      missingFields.forEach(({ field, label }) => {
        form.setError(field as any, {
          type: 'manual',
          message: `${label} is required`
        })
      })
      
      // Show toast warning
      const missingFieldNames = missingFields.map(f => f.label).join(', ')
      import('@/hooks/use-toast').then(({ toastError }) => {
        toastError("Validation Error", `Please fill in the following required fields: ${missingFieldNames}`)
      })
      
      // Scroll to the first error
      const firstError = missingFields[0].field
      const errorElement = document.getElementById(firstError)
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // Trigger full validation for all other fields
    const result = await form.trigger()
    if (!result) {
      // If validation fails, scroll to the first error
      const firstError = Object.keys(form.formState.errors)[0]
      const errorElement = document.getElementById(firstError)
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setShowConfirmModal(true)
  }

  const addArrayItem = (field: keyof TaskFormData, value: string) => {
    const current = form.getValues(field) as string[]
    if (current && !current.includes(value)) {
      form.setValue(field, [...current, value])
    }
  }

  const removeArrayItem = (field: keyof TaskFormData, value: string) => {
    const current = form.getValues(field) as string[]
    if (current) {
      form.setValue(field, current.filter(item => item !== value))
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4 relative pointer-events-auto shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold">Confirm Task Creation</h3>
            <p>Are you sure you want to {isEditing ? 'update' : 'create'} this task?</p>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => form.handleSubmit(handleSubmit)()}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]"
              >
                {isEditing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
            <div className="grid flex grid-cols-1 lg:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="timing">Timing *</Label>
                  <Select
                    value={form.watch('timing')}
                    onValueChange={(value) => form.setValue('timing', value as any)}
                  >
                    <SelectTrigger className="w-full">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="description">Task Description *</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.watch('description')?.length || 0}/500 characters
                  </span>
                </div>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Enter task description"
                  rows={3}
                  className={errors.description ? "border-red-500" : ""}
                  maxLength={500}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>
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
                <div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due time is auto-filled based on Timing selection. Can be overridden.
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Responsibilities & Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Tag className="h-5 w-5" />
              <span>Responsibilities & Categories</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Responsibilities Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Responsibilities * (Multi-select)</Label>
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
                  <PopoverContent 
                    className="w-80 p-2" 
                    align="start"
                    onWheel={(e) => {
                      // Allow wheel scrolling within the popover
                      e.stopPropagation();
                    }}
                  >
                    <div className="space-y-2">
                      {responsibilityOptions.map(responsibility => (
                        <div
                          key={responsibility.value}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => {
                            const currentValues = form.watch('responsibility') || [];
                            if (currentValues.includes(responsibility.value)) {
                              removeArrayItem('responsibility', responsibility.value);
                            } else {
                              addArrayItem('responsibility', responsibility.value);
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
              </div>

              <div>
                <span className="text-xs text-muted-foreground mb-2 block">
                  {form.watch('responsibility')?.length || 0} selected
                </span>

                {/* Selected Responsibilities */}
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {form.watch('responsibility')?.map(responsibility => {
                    const responsibilityObj = responsibilityOptions.find(r => r.value === responsibility)
                    return (
                      <Badge
                        key={responsibility}
                        className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 flex items-center gap-2"
                      >
                        {responsibilityObj?.label || toDisplayFormat(responsibility)}
                        <button
                          type="button"
                          className="hover:bg-blue-800 rounded-full p-0.5"
                          onClick={() => removeArrayItem('responsibility', responsibility)}
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
              {errors.responsibility && (
                <p className="text-sm text-red-500">{errors.responsibility.message}</p>
              )}
            </div>

            {/* Categories Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Categories * (Multi-select)</Label>
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
                  <PopoverContent 
                    className="w-80 p-2" 
                    align="start"
                    onWheel={(e) => {
                      // Allow wheel scrolling within the popover
                      e.stopPropagation();
                    }}
                  >
                    <div className="space-y-2">
                      {TASK_CATEGORIES.map(category => (
                        <div
                          key={category.value}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => {
                            const currentValues = form.watch('categories') || [];
                            if (currentValues.includes(category.value)) {
                              removeArrayItem('categories', category.value);
                            } else {
                              addArrayItem('categories', category.value);
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
              </div>

              <div>
                <span className="text-xs text-muted-foreground mb-2 block">
                  {form.watch('categories')?.length || 0} selected
                </span>

                {/* Selected Categories */}
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {form.watch('categories')?.map(category => {
                    const categoryObj = TASK_CATEGORIES.find(c => c.value === category);
                    return (
                      <Badge
                        key={category}
                        className="bg-green-600 text-white hover:bg-green-700 px-3 py-1 flex items-center gap-2"
                      >
                        {categoryObj?.label || category}
                        <button
                          type="button"
                          className="hover:bg-green-800 rounded-full p-0.5"
                          onClick={() => removeArrayItem('categories', category)}
                        >
                          <XIcon className="h-3 w-3" />
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
          </CardContent>
        </Card>

        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> */}
        {/* Frequency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarDays className="h-5 w-5" />
              <span>Frequency</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              {/* <div className="grid grid-cols-2 gap-4"> */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Frequencies * (Multi-select)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-auto"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Frequency
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-80 p-2 max-h-80 overflow-y-auto" 
                      align="start"
                      onWheel={(e) => {
                        // Allow wheel scrolling within the popover
                        e.stopPropagation();
                      }}
                    >
                      <div className="space-y-2">
                        {TASK_FREQUENCIES.map(frequency => (
                          <div
                            key={frequency.value}
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => {
                              const currentValues = form.watch('frequencies') || [];
                              if (currentValues.includes(frequency.value)) {
                                removeArrayItem('frequencies', frequency.value);
                              } else {
                                addArrayItem('frequencies', frequency.value);
                              }
                            }}
                          >
                            <Checkbox
                              checked={form.watch('frequencies')?.includes(frequency.value)}
                              readOnly
                              className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
                            />
                            <span className="text-sm">{frequency.label}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground mb-2 block">
                    {form.watch('frequencies')?.length || 0} selected
                  </span>

                  {/* Selected Frequencies */}
                  <div className="flex flex-wrap gap-2 min-h-[2rem]">
                    {form.watch('frequencies')?.map(frequency => {
                      const frequencyObj = TASK_FREQUENCIES.find(f => f.value === frequency);
                      return (
                        <Badge
                          key={frequency}
                          className="bg-green-600 text-white hover:bg-green-700 px-3 py-1 flex items-center gap-2"
                        >
                          {frequencyObj?.label || frequency}
                          <button
                            type="button"
                            className="hover:bg-green-800 rounded-full p-0.5"
                            onClick={() => removeArrayItem('frequencies', frequency)}
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                {errors.frequencies && (
                  <p className="text-sm text-red-500">{errors.frequencies.message}</p>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    For once off tasks, manually enter the due date. For all other tasks (i.e. recurring tasks), the due dates are system generated.
                  </p>
                </div>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Show due date field only for once_off frequency */}
              {frequencies?.includes('once_off') && (
                <div className="space-y-3">
                  <Label htmlFor="due_date_once_off">Due Date of Once Off Task *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="due_date_once_off"
                      type="date"
                      {...form.register('due_date')}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              {/* </div> */}
</div>
              {/* Empty div for layout when no due date */}
              {!frequencies?.includes('once_off') && (
                <div></div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Publishing */}
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
                <Label>Publishing Status *</Label>
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
                <p className="text-xs text-muted-foreground">
                  Only Active tasks appear in checklists (respecting publishing delay).
                </p>
                {errors.publish_status && (
                  <p className="text-sm text-red-500">{errors.publish_status.message}</p>
                )}
              </div>
              <div className="space-y-3">
                <Label htmlFor="publish_delay">Publishing Delay</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="publish_delay"
                    type="date"
                    {...form.register('publish_delay')}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tasks remain hidden until this date, even if Active.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* </div> */}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateClick}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-on)]"
          >
            {isEditing ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  )
}