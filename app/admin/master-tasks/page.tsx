"use client"

import { useState, useEffect, useRef } from "react"
import Head from 'next/head'
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import TaskForm from "@/components/admin/TaskFormNew"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { masterTasksApi, positionsApi, authenticatedGet } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'
import { toastSuccess, toastError } from "@/hooks/use-toast"
import type { MasterChecklistTask, CreateMasterTaskRequest, UpdateMasterTaskRequest } from "@/types/checklist"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  Menu,
  FileText,
  User,
  Tag,
  Settings,
  Users,
  CheckCircle2,
  Info,
  CalendarDays
} from "lucide-react"

// Using the proper type from checklist.ts
type MasterTask = MasterChecklistTask & {
  position?: {
    id: string
    name: string
  }
  positions?: {
    id: string
    name: string
  }
}

interface Position {
  id: string
  name: string
}

const frequencyLabels = {
  once_off_sticky: 'Once-off Sticky',
  every_day: 'Every Day',
  weekly: 'Weekly',
  specific_weekdays: 'Specific Weekdays',
  start_every_month: 'Start Every Month',
  start_certain_months: 'Start Certain Months',
  every_month: 'Every Month',
  certain_months: 'Certain Months',
  end_every_month: 'End Every Month',
  end_certain_months: 'End Certain Months'
}

// Define responsibility options for proper display names
const RESPONSIBILITY_OPTIONS = [
  { value: 'pharmacist-primary', label: 'Pharmacist (Primary)' },
  { value: 'pharmacist-supporting', label: 'Pharmacist (Supporting)' },
  { value: 'pharmacy-assistants', label: 'Pharmacy Assistant/s' },
  { value: 'dispensary-technicians', label: 'Dispensary Technician/s' },
  { value: 'daa-packers', label: 'DAA Packer/s' },
  { value: 'shared-exc-pharmacist', label: 'Shared (exc. Pharmacist)' },
  { value: 'shared-inc-pharmacist', label: 'Shared (inc. Pharmacist)' },
  { value: 'operational-managerial', label: 'Operational/Managerial' }
]

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
  const option = RESPONSIBILITY_OPTIONS.find(opt => opt.value === value)
  return option ? option.label : value.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Helper function to get display name for categories
const getCategoryDisplayName = (value: string): string => {
  const option = CATEGORY_OPTIONS.find(opt => opt.value === value)
  return option ? option.label : value.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Helper to get badge color based on type and value
const getBadgeClass = (item: string, type: string) => {
  if (type === "responsibility") {
    const colorMap: Record<string, string> = {
      'pharmacist-primary': 'bg-blue-100 text-blue-800 border-blue-200',
      'pharmacist-supporting': 'bg-sky-100 text-sky-800 border-sky-200',
      'pharmacy-assistants': 'bg-green-100 text-green-800 border-green-200',
      'dispensary-technicians': 'bg-teal-100 text-teal-800 border-teal-200',
      'daa-packers': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'shared-exc-pharmacist': 'bg-amber-100 text-amber-800 border-amber-200',
      'shared-inc-pharmacist': 'bg-orange-100 text-orange-800 border-orange-200',
      'operational-managerial': 'bg-purple-100 text-purple-800 border-purple-200'
    }
    return colorMap[item] || ''
  } else if (type === "category") {
    const colorMap: Record<string, string> = {
      'stock-control': 'bg-blue-50 text-blue-700 border-blue-100',
      'compliance': 'bg-red-50 text-red-700 border-red-100',
      'cleaning': 'bg-green-50 text-green-700 border-green-100',
      'pharmacy-services': 'bg-purple-50 text-purple-700 border-purple-100',
      'fos-operations': 'bg-amber-50 text-amber-700 border-amber-100',
      'dispensary-operations': 'bg-teal-50 text-teal-700 border-teal-100',
      'general-pharmacy-operations': 'bg-cyan-50 text-cyan-700 border-cyan-100',
      'business-management': 'bg-indigo-50 text-indigo-700 border-indigo-100'
    }
    return colorMap[item] || ''
  }
  return ''
}

// Helper function to render truncated array with badges
const renderTruncatedArray = (
  items: string[] | undefined, 
  maxVisible: number = 2, 
  variant: "default" | "secondary" | "outline" = "secondary",
  type: "responsibility" | "category" | "general" = "general"
) => {
  if (!items || items.length === 0) {
    return <span className="text-gray-400 text-xs">None</span>
  }

  const visibleItems = items.slice(0, maxVisible)
  const remainingCount = items.length - maxVisible

  // Function to get proper display name based on type
  const getDisplayName = (item: string): string => {
    switch (type) {
      case "responsibility":
        return getResponsibilityDisplayName(item)
      case "category":
        return getCategoryDisplayName(item)
      default:
        return item.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  return (
    <div className="flex flex-wrap gap-1 w-full">
      {visibleItems.map((item, index) => {
        const displayName = getDisplayName(item)
        const badgeClass = getBadgeClass(item, type)
        
        return (
          <Badge 
            key={index} 
            variant={variant} 
            className={`text-xs truncate ${badgeClass}`}
            title={displayName}
          >
            {displayName}
          </Badge>
        )
      })}
      {remainingCount > 0 && (
        <Badge 
          variant="outline" 
          className="text-xs bg-gray-100" 
          title={`${remainingCount} more: ${items.slice(maxVisible).map(item => getDisplayName(item)).join(', ')}`}
        >
          + {remainingCount}
        </Badge>
      )}
    </div>
  )
}

// Helper function to format frequency for display
const formatFrequency = (frequency: string) => {
  return frequency.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Helper function to format frequency rules for display
const formatFrequencyRules = (frequencyRules: any) => {
  if (!frequencyRules || typeof frequencyRules !== 'object') {
    return 'No frequency rules defined'
  }

  const rules = []
  
  // Type
  if (frequencyRules.type) {
    rules.push(`Type: ${frequencyRules.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`)
  }
  
  // Interval settings
  if (frequencyRules.every_n_days) {
    rules.push(`Every ${frequencyRules.every_n_days} day${frequencyRules.every_n_days !== 1 ? 's' : ''}`)
  }
  if (frequencyRules.every_n_weeks) {
    rules.push(`Every ${frequencyRules.every_n_weeks} week${frequencyRules.every_n_weeks !== 1 ? 's' : ''}`)
  }
  if (frequencyRules.every_n_months) {
    rules.push(`Every ${frequencyRules.every_n_months} month${frequencyRules.every_n_months !== 1 ? 's' : ''}`)
  }
  
  // Weekdays
  if (frequencyRules.weekdays && Array.isArray(frequencyRules.weekdays) && frequencyRules.weekdays.length > 0) {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const weekdayNames = frequencyRules.weekdays.map((day: number) => dayNames[day - 1] || `Day ${day}`)
    rules.push(`Weekdays: ${weekdayNames.join(', ')}`)
  }
  
  // Months
  if (frequencyRules.months && Array.isArray(frequencyRules.months) && frequencyRules.months.length > 0) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const monthNamesList = frequencyRules.months.map((month: number) => monthNames[month - 1] || `Month ${month}`)
    rules.push(`Months: ${monthNamesList.join(', ')}`)
  }
  
  // Business days only
  if (frequencyRules.business_days_only) {
    rules.push('Business days only: Yes')
  }
  
  // Due date
  if (frequencyRules.due_date) {
    rules.push(`Due date: ${new Date(frequencyRules.due_date).toLocaleDateString()}`)
  }
  
  return rules.length > 0 ? rules : ['No specific rules defined']
}

// Helper function to get frequency badge color
const getFrequencyBadgeColor = (frequency: string) => {
  const colorMap: Record<string, string> = {
    'once_off': 'bg-purple-100 text-purple-800 border-purple-200',
    'once_off_sticky': 'bg-purple-100 text-purple-800 border-purple-200',
    'every_day': 'bg-blue-100 text-blue-800 border-blue-200',
    'weekly': 'bg-green-100 text-green-800 border-green-200',
    'specific_weekdays': 'bg-green-100 text-green-800 border-green-200',
    'monday': 'bg-green-100 text-green-800 border-green-200',
    'tuesday': 'bg-green-100 text-green-800 border-green-200',
    'wednesday': 'bg-green-100 text-green-800 border-green-200',
    'thursday': 'bg-green-100 text-green-800 border-green-200',
    'friday': 'bg-green-100 text-green-800 border-green-200',
    'saturday': 'bg-green-100 text-green-800 border-green-200',
    'once_weekly': 'bg-green-100 text-green-800 border-green-200',
    'start_every_month': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_certain_months': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jan': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_feb': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_mar': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_apr': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_may': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jun': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_jul': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_aug': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_sep': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_oct': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_nov': 'bg-amber-100 text-amber-800 border-amber-200',
    'start_of_month_dec': 'bg-amber-100 text-amber-800 border-amber-200',
    'every_month': 'bg-orange-100 text-orange-800 border-orange-200',
    'certain_months': 'bg-orange-100 text-orange-800 border-orange-200',
    'once_monthly': 'bg-orange-100 text-orange-800 border-orange-200',
    'end_every_month': 'bg-red-100 text-red-800 border-red-200',
    'end_certain_months': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jan': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_feb': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_mar': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_apr': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_may': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jun': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_jul': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_aug': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_sep': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_oct': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_nov': 'bg-red-100 text-red-800 border-red-200',
    'end_of_month_dec': 'bg-red-100 text-red-800 border-red-200'
  }
  return colorMap[frequency] || 'bg-indigo-100 text-indigo-800 border-indigo-200'
}

// Helper function to render frequency with additional details
const renderFrequencyWithDetails = (task: MasterTask) => {
  const baseFrequency = formatFrequency(task.frequency)
  const details = []
  
  // Add weekdays if applicable
  if (task.weekdays && task.weekdays.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekdayNames = task.weekdays.map(day => dayNames[day] || day)
    
    // Format for display
    let weekdayDisplay = weekdayNames.slice(0, 3).join(', ')
    if (task.weekdays.length > 3) {
      weekdayDisplay += ` +${task.weekdays.length - 3} more`
    }
    
    details.push(`Days: ${weekdayDisplay}`)
  }
  
  // Add months if applicable
  if (task.months && task.months.length > 0) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthNamesList = task.months.map(month => monthNames[month - 1] || month)
    
    // Format for display
    let monthDisplay = monthNamesList.slice(0, 3).join(', ')
    if (task.months.length > 3) {
      monthDisplay += ` +${task.months.length - 3} more`
    }
    
    details.push(`Months: ${monthDisplay}`)
  }
  
  // Add due date for once-off tasks
  if (task.frequency === 'once_off' && task.due_date) {
    const dueDate = new Date(task.due_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    details.push(`Due: ${dueDate}`)
  }
  
  // Add timing information
  if (task.timing) {
    const timingMap: Record<string, string> = {
      'opening': '🕘 Opening',
      'anytime': '🕓 Anytime',
      'before_order_cutoff': '🕒 Before Order Cutoff',
      'closing': '🕕 Closing'
    }
    details.push(timingMap[task.timing] || task.timing)
  }
  
  return (
    <div className="space-y-1 w-full flex flex-col">
      <Badge 
        variant="outline" 
        className={`text-xs truncate w-3/5 text-center ${getFrequencyBadgeColor(task.frequency)}`}
        title={baseFrequency}
      >
        {baseFrequency}
      </Badge>
      
      {details.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1 w-full">
          {details.map((detail, index) => (
            <div key={index} className="truncate w-full" title={detail}>
              {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Task Details Modal Component
const TaskDetailsModal = ({ task, positions }: { task: MasterTask, positions: Position[] }) => {
  const getPositionName = (positionId: string) => {
    const position = positions.find(p => p.id === positionId)
    return position?.name || 'Unknown Position'
  }

  return (
    <DialogContent className="task-details-modal overflow-hidden flex flex-col" style={{ maxWidth: "80rem", width: "80vw", maxHeight: "90vh", height: "90vh" }}>
      {/* Fixed Header */}
      <DialogHeader className="flex-shrink-0 pb-4 border-b">
        <DialogTitle className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Task Details
        </DialogTitle>
      </DialogHeader>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Title</label>
                <p className="text-sm mt-1 font-medium">{task.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  <Badge className={task.publish_status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' : 
                                  task.publish_status === 'draft' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 
                                  'bg-gray-100 text-gray-800 border border-gray-200'}>
                    {task.publish_status}
                  </Badge>
                </div>
              </div>
            </div>
            {task.description && (
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">{task.description}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-600">Due Time</label>
              <p className="text-sm mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(task as any).default_due_time || 'Not specified'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assignment & Responsibilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Assignment & Responsibilities</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Responsibilities</label>
                <div className="mt-1">
                  {task.responsibility && task.responsibility.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.responsibility.map((resp, index) => {
                        const badgeClass = getBadgeClass(resp, "responsibility");
                        return (
                          <Badge key={index} variant="secondary" className={`text-xs whitespace-nowrap ${badgeClass}`}>
                            {getResponsibilityDisplayName(resp)}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : task.position_id ? (
                    <Badge variant="secondary" className="text-xs">
                      {getPositionName(task.position_id)}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">No responsibilities assigned</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Categories</label>
                <div className="mt-1">
                  {task.categories && task.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.categories.map((category, index) => {
                        const badgeClass = getBadgeClass(category, "category");
                        return (
                          <Badge key={index} variant="outline" className={`text-xs whitespace-nowrap ${badgeClass}`}>
                            {getCategoryDisplayName(category)}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : task.category ? (
                    <Badge variant="outline" className={`text-xs ${getBadgeClass(task.category, "category")}`}>
                      {getCategoryDisplayName(task.category)}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">No categories</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Scheduling</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Frequency</label>
                <p className="text-sm mt-1">
                  <Badge variant="outline" className={getFrequencyBadgeColor(task.frequency)}>{formatFrequency(task.frequency)}</Badge>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Timing</label>
                <p className="text-sm mt-1">
                  {task.timing ? (
                    <Badge variant="outline" className={`
                      ${task.timing === 'opening' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                        task.timing === 'anytime' ? 'bg-purple-100 text-purple-800 border-purple-200' : 
                        task.timing === 'before_order_cutoff' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                        task.timing === 'closing' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 
                        'bg-gray-100 text-gray-800 border-gray-200'}
                    `}>
                      {task.timing.charAt(0).toUpperCase() + task.timing.slice(1).replace(/_/g, ' ')}
                    </Badge>
                  ) : 'Not specified'}
                </p>
              </div>
            </div>
            
            {/* Advanced Scheduling */}
            {(task.weekdays && task.weekdays.length > 0) && (
              <div className="p-3 bg-gray-50 rounded-md">
                <label className="text-sm font-medium text-gray-600">Specific Weekdays</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.weekdays.map((day, index) => {
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    return (
                      <Badge key={index} variant="outline" className="text-xs">
                        {dayNames[day] || day}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
            
            {(task.months && task.months.length > 0) && (
              <div className="p-3 bg-gray-50 rounded-md mt-3">
                <label className="text-sm font-medium text-gray-600">Specific Months</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.months.map((month, index) => {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                    return (
                      <Badge key={index} variant="outline" className="text-xs">
                        {monthNames[month - 1] || month}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Tag className="h-5 w-5" />
              <span>Advanced Options</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <div>
                  <span className="text-sm font-medium">Sticky Once Off</span>
                  <p className="text-xs text-gray-500 mt-1">Task will remain visible after completion</p>
                </div>
                <Badge variant={task.sticky_once_off ? "default" : "outline"} className="ml-2">
                  {task.sticky_once_off ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <div>
                  <span className="text-sm font-medium">Allow Edit When Locked</span>
                  <p className="text-xs text-gray-500 mt-1">Task can be edited even when locked</p>
                </div>
                <Badge variant={task.allow_edit_when_locked ? "default" : "outline"} className="ml-2">
                  {task.allow_edit_when_locked ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Settings */}
        {(task.due_date || task.start_date || task.end_date || task.publish_delay || task.publish_delay_date) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5" />
                <span>Date Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {task.due_date && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <label className="text-sm font-medium text-gray-600">Due Date (Once-off)</label>
                    <p className="text-sm mt-1">{new Date(task.due_date).toLocaleDateString()}</p>
                  </div>
                )}
                {task.start_date && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <label className="text-sm font-medium text-gray-600">Start Date</label>
                    <p className="text-sm mt-1">{new Date(task.start_date).toLocaleDateString()}</p>
                  </div>
                )}
                {task.publish_delay && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <label className="text-sm font-medium text-gray-600">Publish Delay</label>
                    <p className="text-sm mt-1">{new Date(task.publish_delay).toLocaleDateString()}</p>
                  </div>
                )}
                {task.end_date && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <label className="text-sm font-medium text-gray-600">End Date</label>
                    <p className="text-sm mt-1">{new Date(task.end_date).toLocaleDateString()}</p>
                  </div>
                )}
                {task.publish_delay_date && (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <label className="text-sm font-medium text-gray-600">Publish Delay Date</label>
                    <p className="text-sm mt-1">{new Date(task.publish_delay_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Frequency Rules */}
        {task.frequency_rules && Object.keys(task.frequency_rules).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Frequency Rules</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="space-y-2">
                  {formatFrequencyRules(task.frequency_rules).map((rule, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      • {rule}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5" />
              <span>Task Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
              <div>
                <span className="font-medium">Created:</span> {new Date(task.created_at).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Updated:</span> {new Date(task.updated_at).toLocaleString()}
              </div>
              {(task as any).created_by && (
                <div>
                  <span className="font-medium">Created By:</span> {(task as any).created_by}
                </div>
              )}
              {(task as any).updated_by && (
                <div>
                  <span className="font-medium">Updated By:</span> {(task as any).updated_by}
                </div>
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
    </DialogContent>
  )
}

export default function AdminMasterTasksPage() {
  // Custom styles for modals
  const customStyles = `
    .task-details-modal {
      max-width: 80rem !important;
      width: 80vw !important;
      max-height: 90vh !important;
      height: 90vh !important;
    }
    
    .create-task-modal {
      max-width: 64rem !important;
      width: 70vw !important;
      max-height: 95vh !important;
      height: 95vh !important;
    }
    
    .task-details-modal .card,
    .create-task-modal .card {
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      margin-bottom: 1rem;
    }
    
    .task-details-modal .card-header,
    .create-task-modal .card-header {
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 0.75rem;
    }
  `;
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()

  const [tasks, setTasks] = useState<MasterTask[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPosition, setFilterPosition] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [generatingInstancesId, setGeneratingInstancesId] = useState<string | null>(null)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; task: any | null }>({ isOpen: false, task: null })
  const [generateConfirmModal, setGenerateConfirmModal] = useState<{ isOpen: boolean; task: any | null }>({ isOpen: false, task: null })
  
  // File input ref for import functionality
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Wait for authentication to complete before loading data
    if (!authLoading && user && isAdmin) {
      console.log('Authentication complete, loading data for admin user:', user.position.name)
      loadData()
    } else if (!authLoading && !user) {
      console.log('Authentication complete but no user found')
    } else if (!authLoading && user && !isAdmin) {
      console.log('Authentication complete but user is not admin:', user.position.name)
    }
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('Loading master tasks and positions...')
      const [tasksData, positionsData] = await Promise.all([
        masterTasksApi.getAll({ status: 'all' }), // Get all tasks for admin interface
        positionsApi.getAll()
      ])
      console.log('Loaded tasks:', tasksData.length)
      console.log('Loaded positions:', positionsData.length)
      
      // Debug: Log the first few tasks to see their structure
      if (tasksData.length > 0) {
        console.log('Sample task data:', {
          id: tasksData[0].id,
          title: tasksData[0].title,
          responsibility: tasksData[0].responsibility,
          categories: tasksData[0].categories,
          position_id: tasksData[0].position_id,
          category: tasksData[0].category,
          positions: tasksData[0].positions,
          position: tasksData[0].position
        })
        
        // Log all tasks to see the pattern
        console.log('All tasks responsibility/categories data:')
        tasksData.forEach((task, index) => {
          console.log(`Task ${index + 1}:`, {
            title: task.title,
            responsibility: task.responsibility,
            categories: task.categories,
            hasResponsibilityArray: Array.isArray(task.responsibility),
            hasCategoriesArray: Array.isArray(task.categories),
            responsibilityLength: task.responsibility?.length || 0,
            categoriesLength: task.categories?.length || 0
          })
        })
      }
      
      setTasks(tasksData)
      
      // Filter out administrator positions from the dropdown
      const filteredPositions = positionsData.filter((position: any) => {
        const isAdmin = position.role === 'admin' || 
                       position.name.toLowerCase().includes('admin') || 
                       position.displayName?.toLowerCase().includes('admin')
        return !isAdmin
      })
      setPositions(filteredPositions)
    } catch (error) {
      console.error('Error loading data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Loading Failed', `Failed to load data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type: 'success' | 'error', title: string, description?: string) => {
    if (type === 'success') {
      toastSuccess(title, description)
    } else {
      toastError(title, description)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'draft' | 'active' | 'inactive') => {
    try {
      console.log('Updating task status:', { taskId, newStatus })
      
      // Optimistically update the UI first
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, publish_status: newStatus } : task
      ))
      
      // Then update the database
      const updatedTask = await masterTasksApi.update(taskId, { publish_status: newStatus })
      console.log('Task status updated:', updatedTask)
      
      // Update with the full response from server (in case there are other changes)
      setTasks(tasks.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      
      showToast('success', 'Status Updated', `Task status changed to ${newStatus}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      
      // Revert the optimistic update on error
      await loadData()
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Update Failed', `Failed to update task status: ${errorMessage}`)
    }
  }

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    setDeleteConfirmModal({ isOpen: true, task })
  }

  const confirmDeleteTask = async () => {
    const task = deleteConfirmModal.task
    if (!task) return

    setDeleteConfirmModal({ isOpen: false, task: null })
    setDeletingTaskId(task.id)
    
    try {
      console.log('Deleting task:', task.id)
      await masterTasksApi.delete(task.id)
      console.log('Task deleted successfully')
      
      // Immediately remove from UI
      setTasks(tasks.filter(t => t.id !== task.id))
      
      showToast('success', 'Task Deleted', `"${task.title}" was deleted successfully`)
    } catch (error) {
      console.error('Error deleting task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Delete Failed', `Failed to delete task: ${errorMessage}`)
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleSaveTask = async (taskData: CreateMasterTaskRequest | UpdateMasterTaskRequest) => {
    setFormLoading(true)
    try {
      console.log('Saving task data:', taskData)
      
      if (editingTask) {
        // Update existing task
        console.log('Updating task:', editingTask.id)
        const updatedTask = await masterTasksApi.update(editingTask.id, taskData)
        console.log('Task updated:', updatedTask)
        
        // Immediately update the UI with the new data
        setTasks(tasks.map(task => 
          task.id === editingTask.id ? updatedTask : task
        ))
        
        showToast('success', 'Task Updated', 'Task was updated successfully')
      } else {
        // Create new task
        const newTask = await masterTasksApi.create(taskData)
        console.log('Task created:', newTask)
        
        // Immediately add the new task to the UI
        setTasks([newTask, ...tasks])
        
        showToast('success', 'Task Created', 'New task was created successfully')
      }
      
      // Close dialog and reset state
      setIsTaskDialogOpen(false)
      setEditingTask(null)
      
      // Optionally reload data to ensure consistency
      // await loadData()
      
    } catch (error) {
      console.error('Error saving task:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', `${editingTask ? 'Update' : 'Create'} Failed`, `Failed to ${editingTask ? 'update' : 'create'} task: ${errorMessage}`)
    } finally {
      setFormLoading(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset form loading state
    setFormLoading(false)
    
    // Close dialog and reset editing state
    setIsTaskDialogOpen(false)
    setEditingTask(null)
    
    console.log('Edit dialog cancelled')
  }

  const handleGenerateInstances = (taskId?: string) => {
    const task = taskId ? tasks.find(t => t.id === taskId) : null
    setGenerateConfirmModal({ isOpen: true, task })
  }

  const confirmGenerateInstances = async () => {
    const task = generateConfirmModal.task
    const taskId = task?.id
    
    setGenerateConfirmModal({ isOpen: false, task: null })
    
    if (taskId) {
      setGeneratingInstancesId(taskId)
    }
    
    try {
      console.log('Generating instances for task:', taskId || 'all tasks')
      
      // Use authenticated API call
      const result = await authenticatedGet(`/api/jobs/generate-instances?mode=custom${taskId ? `&masterTaskId=${taskId}` : ''}`)
      
      if (!result) {
        throw new Error('Failed to generate instances')
      }
      
      if (result.success) {
        const message = taskId 
          ? `✅ Generated ${result.stats.generated} instances for "${task?.title}"`
          : `✅ Generated ${result.stats.generated} task instances`
        
        const details = result.stats.skipped > 0 
          ? ` (${result.stats.skipped} skipped as they already exist)`
          : ''
        
        showToast('success', 'Instances Generated', message + details)
      } else {
        showToast('error', 'Generation Failed', result.message || 'Failed to generate instances')
      }
    } catch (error) {
      console.error('Error generating instances:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate instances'
      showToast('error', 'Generation Failed', errorMessage)
    } finally {
      if (taskId) {
        setGeneratingInstancesId(null)
      }
    }
  }

  // Export handler function
  const handleExport = async () => {
    try {
      if (filteredTasks.length === 0) {
        showToast('error', 'Export Failed', 'No tasks to export')
        return
      }

      // Create export data from current filtered tasks
      const exportData = filteredTasks.map(task => ({
        'Title': task.title,
        'Description': task.description || '',
        'Position': task.positions?.name || task.position?.name || '',
        'Frequency': frequencyLabels[task.frequency as keyof typeof frequencyLabels] || task.frequency,
        'Category': task.category || '',
        'Status': task.publish_status,
        'Default Due Time': (task as any).default_due_time || '',
        'Timing': task.timing || '',
        'Weekdays': task.weekdays?.join(',') || '',
        'Months': task.months?.join(',') || '',
        'Sticky Once Off': task.sticky_once_off ? 'Yes' : 'No',
        'Allow Edit When Locked': task.allow_edit_when_locked ? 'Yes' : 'No',
        'Publish Delay Date': task.publish_delay_date || ''
      }))

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Tasks')

      // Generate Excel file and download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `master_tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast('success', 'Export Successful', `Exported ${exportData.length} master tasks to Excel`)
    } catch (error) {
      console.error('Error exporting tasks:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to export tasks'
      showToast('error', 'Export Failed', errorMessage)
    }
  }

  // Import handler function
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      let importData: any[] = []
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.csv')) {
        // Handle CSV files
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          throw new Error('File must contain at least a header row and one data row')
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const row: any = {}
          
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          
          importData.push(row)
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Handle Excel files
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        importData = XLSX.utils.sheet_to_json(worksheet)
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.')
      }

      if (importData.length === 0) {
        throw new Error('No data found in the file')
      }

      // Validate required headers
      const requiredHeaders = ['Title', 'Position', 'Frequency']
      const firstRow = importData[0]
      const availableHeaders = Object.keys(firstRow)
      
      const missingHeaders = requiredHeaders.filter(header => !availableHeaders.includes(header))
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
      }

      // Process and validate data
      const processedData = []
      for (let i = 0; i < importData.length; i++) {
        const row = importData[i]
        
        // Find position ID
        const position = positions.find(p => p.name === row['Position'])
        if (!position) {
          throw new Error(`Position "${row['Position']}" not found in row ${i + 2}`)
        }

        // Map data to master task format
        const taskData = {
          title: row['Title']?.toString().trim(),
          description: row['Description']?.toString().trim() || '',
          position_id: position.id,
          frequency: Object.keys(frequencyLabels).find(key => 
            frequencyLabels[key as keyof typeof frequencyLabels] === row['Frequency']
          ) || row['Frequency'],
          category: row['Category']?.toString().trim() || '',
          publish_status: (['draft', 'active', 'inactive'].includes(row['Status']) ? row['Status'] : 'draft') as 'draft' | 'active' | 'inactive',
          // Map to current column name on server; keep key for import structure
          default_due_time: row['Default Due Time']?.toString().trim() || null,
          timing: row['Timing']?.toString().trim() || '',
          weekdays: row['Weekdays'] ? 
            row['Weekdays'].toString().split(',').map((w: string) => parseInt(w.trim())).filter((w: number) => !isNaN(w) && w >= 0 && w <= 6) : [],
          months: row['Months'] ? 
            row['Months'].toString().split(',').map((m: string) => parseInt(m.trim())).filter((m: number) => !isNaN(m) && m >= 1 && m <= 12) : [],
          sticky_once_off: row['Sticky Once Off']?.toString().toLowerCase() === 'yes',
          allow_edit_when_locked: row['Allow Edit When Locked']?.toString().toLowerCase() === 'yes',
          publish_delay_date: row['Publish Delay Date']?.toString().trim() || null
        }

        if (!taskData.title) {
          throw new Error(`Title is required in row ${i + 2}`)
        }

        processedData.push(taskData)
      }

      // Import tasks one by one
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      for (let i = 0; i < processedData.length; i++) {
        const taskData = processedData[i]
        try {
          const newTask = await masterTasksApi.create(taskData)
          setTasks(prevTasks => [newTask, ...prevTasks])
          successCount++
        } catch (error) {
          console.error('Error importing task:', taskData.title, error)
          errorCount++
          errors.push(`Row ${i + 2}: ${taskData.title} - ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        showToast('success', 'Import Successful', `Successfully imported ${successCount} tasks${errorCount > 0 ? ` (${errorCount} failed)` : ''}`)
        if (errors.length > 0 && errors.length <= 5) {
          console.log('Import errors:', errors)
        }
      } else {
        showToast('error', 'Import Failed', `${errorCount} tasks could not be imported`)
      }

    } catch (error) {
      console.error('Error importing file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import file'
      showToast('error', 'Import Failed', errorMessage)
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Check if position matches either in responsibility array or legacy position_id
    const matchesPosition = filterPosition === 'all' || 
      (task.positions?.id || task.position?.id) === filterPosition ||
      (task.responsibility && task.responsibility.some(r => {
        // If filtering by a position ID, check if any responsibility matches that position
        const position = positions.find(p => p.id === filterPosition)
        if (!position) return false
        
        // Convert position name to responsibility format for comparison
        const positionAsResponsibility = position.name.toLowerCase().replace(/\s+/g, '-')
        return r.includes(positionAsResponsibility)
      }))
    
    const matchesStatus = filterStatus === 'all' || task.publish_status === filterStatus
    
    // Check if category matches either in categories array or legacy category field
    const matchesCategory = filterCategory === 'all' || 
      task.category === filterCategory ||
      (task.categories && task.categories.includes(filterCategory))

    return matchesSearch && matchesPosition && matchesStatus && matchesCategory
  })

  // Get unique categories for filter - combine legacy category and new categories array
  const allCategories = new Set<string>()
  
  // Add legacy categories
  tasks.forEach(task => {
    if (task.category) allCategories.add(task.category)
  })
  
  // Add categories from arrays
  tasks.forEach(task => {
    if (task.categories && Array.isArray(task.categories)) {
      task.categories.forEach(cat => allCategories.add(cat))
    }
  })
  
  const categories = Array.from(allCategories).filter(Boolean)

  // Show loading spinner while authentication is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show access denied if user is not authenticated or not an admin
  if (!user || !isAdmin) {
    // Debug info for troubleshooting
    console.log('Master Tasks page access check:', { user, isAdmin, userRole: user?.role })
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
          <div className="mt-4 p-4 bg-gray-100 rounded text-sm text-left max-w-md">
            <strong>Debug Info:</strong><br/>
            User: {user ? 'Present' : 'Missing'}<br/>
            IsAdmin: {isAdmin ? 'True' : 'False'}<br/>
            User Role: {user?.role || 'Unknown'}<br/>
            <a href="/admin/auth-test" className="text-blue-600 underline">Run Auth Test</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Inline styles for modal sizing */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 lg:p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">Master Tasks Management</h1>
                <p className="text-white/90 text-sm lg:text-base">Manage the central checklist that generates all task instances</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button 
                    onClick={() => handleGenerateInstances()} 
                    variant="outline"
                    disabled={generatingInstancesId !== null}
                    className="text-green-600 border-green-600 hover:bg-green-50 w-full sm:w-auto"
                  >
                    {generatingInstancesId === null ? (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Generate All Instances
                      </>
                    ) : (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                        Generating...
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingTask(null)
                      setIsTaskDialogOpen(true)
                    }}
                    className="bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Task
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-surface mb-6 py-0">
          <CardContent className="pt-4 pb-4">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden mb-4">
              <Button
                variant="outline"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="w-full justify-between"
              >
                <span className="flex items-center">
                  <Menu className="w-4 h-4 mr-2" />
                  Filters & Actions
                </span>
                {showMobileFilters ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filters - Hidden on mobile unless toggled */}
            <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Search Field - Takes 2 columns */}
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Position Filter */}
                <div className="flex justify-start w-full">
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Positions</SelectItem>
                      {positions?.map(position => position && (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="flex justify-start w-full">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="flex justify-start w-full">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map(category => category && (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Export and Import Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} className="w-full">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImport}
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="card-surface w-full gap-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg lg:text-xl">
                Master Tasks ({filteredTasks.length} of {tasks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="w-full p-0 sm:p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading tasks...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block w-full">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%] py-3 bg-gray-50">Task</TableHead>
                        <TableHead className="w-[15%] py-3 bg-gray-50">Responsibilities</TableHead>
                        <TableHead className="w-[15%] py-3 bg-gray-50">Frequencies</TableHead>
                        <TableHead className="w-[15%] py-3 bg-gray-50">Categories</TableHead>
                        <TableHead className="w-[10%] py-3 bg-gray-50 text-center">Status</TableHead>
                        <TableHead className="w-[10%] py-3 bg-gray-50 text-center">Due Time</TableHead>
                        <TableHead className="w-[10%] py-3 bg-gray-50 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id} className="hover:bg-gray-50">
                          <TableCell className="py-3">
                            <div className="max-w-full">
                              <div className="font-medium truncate">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-gray-600 truncate">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="max-w-full overflow-hidden">
                              {task.responsibility && task.responsibility.length > 0 ? (
                                renderTruncatedArray(task.responsibility, 2, "secondary", "responsibility")
                              ) : task.positions?.name || task.position?.name ? (
                                <div>
                                  <Badge variant="secondary" className="text-xs truncate max-w-full">{task.positions?.name || task.position?.name}</Badge>
                                  <div className="text-xs text-red-500 mt-1 truncate">Legacy data</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="max-w-full overflow-hidden">
                              {renderFrequencyWithDetails(task)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="max-w-full overflow-hidden">
                              {task.categories && task.categories.length > 0 ? (
                                renderTruncatedArray(task.categories, 2, "outline", "category")
                              ) : task.category ? (
                                <div>
                                  <Badge variant="outline" className="text-xs truncate max-w-full">{getCategoryDisplayName(task.category)}</Badge>
                                  <div className="text-xs text-red-500 mt-1 truncate">Legacy data</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Select
                                value={task.publish_status}
                                onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                  handleStatusChange(task.id, value)
                                }
                              >
                                <SelectTrigger className="w-26">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center text-sm">
                              <Clock className="w-3 h-3 mr-1 text-gray-400" />
                              {(task as any).default_due_time || '17:00'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center space-x-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    title="View task details"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </DialogTrigger>
                                <TaskDetailsModal task={task} positions={positions} />
                              </Dialog>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateInstances(task.id)}
                                disabled={generatingInstancesId === task.id}
                                title="Generate instances for this task"
                                className="h-7 w-7 p-0"
                              >
                                {generatingInstancesId === task.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                ) : (
                                  <Calendar className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingTask(task)
                                  setIsTaskDialogOpen(true)
                                }}
                                className="h-7 w-7 p-0"
                                title="Edit task"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTaskId === task.id}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                title="Delete task"
                              >
                                {deletingTaskId === task.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-4 w-full px-4 sm:px-6">
                  {filteredTasks.map((task) => (
                    <Card key={task.id} className="border border-gray-200 w-full">
                      <CardContent className="mobile-card p-4">
                        <div className="space-y-3 w-full">
                          {/* Title and Description */}
                          <div>
                            <h3 className="font-medium text-base">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-gray-500">Responsibilities:</span>
                              <div className="mt-1">
                                {task.responsibility && task.responsibility.length > 0 ? (
                                  renderTruncatedArray(task.responsibility, 3, "secondary")
                                ) : task.positions?.name || task.position?.name ? (
                                  <div>
                                    <Badge variant="secondary" className="text-xs">{task.positions?.name || task.position?.name}</Badge>
                                    <div className="text-xs text-red-500 mt-1">Legacy data - needs migration</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">None</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Frequency:</span>
                              <div className="mt-1">
                                {renderFrequencyWithDetails(task)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Categories:</span>
                              <div className="mt-1">
                                {task.categories && task.categories.length > 0 ? (
                                  renderTruncatedArray(task.categories, 3, "outline", "category")
                                ) : task.category ? (
                                  <div>
                                    <Badge variant="outline" className="text-xs">{getCategoryDisplayName(task.category)}</Badge>
                                    <div className="text-xs text-red-500 mt-1">Legacy data - needs migration</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">None</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Due Time:</span>
                              <div className="flex items-center font-medium mt-1">
                                <Clock className="w-3 h-3 mr-1 text-gray-400" />
                                {(task as any).default_due_time || '17:00'}
                              </div>
                            </div>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex flex-col space-y-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <Select
                                  value={task.publish_status}
                                  onValueChange={(value: 'draft' | 'active' | 'inactive') => 
                                    handleStatusChange(task.id, value)
                                  }
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex space-x-1">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      title="View task details"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <TaskDetailsModal task={task} positions={positions} />
                                </Dialog>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateInstances(task.id)}
                                  disabled={generatingInstancesId === task.id}
                                  title="Generate instances"
                                >
                                  {generatingInstancesId === task.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                  ) : (
                                    <Calendar className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingTask(task)
                                    setIsTaskDialogOpen(true)
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  {deletingTaskId === task.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No tasks found matching your filters.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Task Creation/Edit Dialog */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="dialog-content create-task-modal overflow-hidden flex flex-col" style={{ maxWidth: "64rem", width: "70vw", maxHeight: "95vh", height: "95vh" }}>
            <DialogHeader className="flex-shrink-0 pb-4 border-b">
              <DialogTitle className="text-xl font-semibold">
                {editingTask ? 'Edit Master Task' : 'Create New Master Task'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <TaskForm
                task={editingTask}
                onSubmit={handleSaveTask}
                onCancel={handleCancelEdit}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmModal.isOpen} onOpenChange={(open) => !open && setDeleteConfirmModal({ isOpen: false, task: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Delete Master Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>"{deleteConfirmModal.task?.title}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium mb-2">This will permanently delete:</p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• The master task</li>
                  <li>• All associated task instances</li>
                  <li>• All completion history</li>
                </ul>
                <p className="text-red-800 text-sm font-medium mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmModal({ isOpen: false, task: null })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteTask}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Generate Instances Confirmation Modal */}
        <Dialog open={generateConfirmModal.isOpen} onOpenChange={(open) => !open && setGenerateConfirmModal({ isOpen: false, task: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-600 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Generate Task Instances
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {generateConfirmModal.task ? (
                <p className="text-gray-700">
                  Generate task instances for <strong>"{generateConfirmModal.task.title}"</strong>?
                </p>
              ) : (
                <p className="text-gray-700">
                  Generate task instances for <strong>all active tasks</strong>?
                </p>
              )}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm font-medium mb-2">This will:</p>
                <ul className="text-green-700 text-sm space-y-1">
                  <li>• Create new task instances based on frequency settings</li>
                  <li>• Generate instances for the next 365 days</li>
                  <li>• Skip instances that already exist</li>
                </ul>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setGenerateConfirmModal({ isOpen: false, task: null })}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmGenerateInstances}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Instances
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}