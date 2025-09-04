"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"

import { masterTasksApi, positionsApi } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import * as XLSX from 'xlsx'
import { toastSuccess, toastError } from "@/hooks/use-toast"
import type { MasterChecklistTask, CreateMasterTaskRequest, UpdateMasterTaskRequest } from "@/types/checklist"
import { PublishStatus } from "@/types/checklist"
import { DEFAULT_DUE_TIMES } from "@/lib/constants"
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
  CalendarDays,
  MoreHorizontal,
  Check,
  X,
  ChevronUp,
  ChevronDown
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
  custom_order?: number
}

interface Position {
  id: string
  name: string
  display_order?: number
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

// Dynamic responsibility options - loaded from database
let RESPONSIBILITY_OPTIONS: { value: string; label: string }[] = []

// Helper function to convert position name to responsibility value
// This must match the nameToResponsibilityValue function in position-utils.ts
const nameToResponsibilityValue = (positionName: string): string => {
  return positionName
    .toLowerCase()
    .trim()
    .replace(/[()/]/g, ' ') // normalize punctuation
    .replace(/[^a-z0-9]+/g, '-') // non-alphanum to dash
    .replace(/^-+|-+$/g, '') // trim dashes
}

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
    // Dynamic color assignment based on hash of the item name
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-sky-100 text-sky-800 border-sky-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-rose-100 text-rose-800 border-rose-200',
      'bg-orange-100 text-orange-800 border-orange-200'
    ]
    // Simple hash function to consistently assign colors
    let hash = 0
    for (let i = 0; i < item.length; i++) {
      hash = ((hash << 5) - hash + item.charCodeAt(i)) & 0xffffffff
    }
    return colors[Math.abs(hash) % colors.length]
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
const formatFrequency = (frequency: string | null | undefined) => {
  if (!frequency) {
    return 'Not set'
  }
  return frequency.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}



// Helper function to get frequency badge color
const getFrequencyBadgeColor = (frequency: string | null | undefined) => {
  if (!frequency) {
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

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
    'start_of_every_month': 'bg-amber-100 text-amber-800 border-amber-200',
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
    'end_of_every_month': 'bg-red-100 text-red-800 border-red-200',
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
  // Use frequencies array
  const frequencies = task.frequencies || []

  if (frequencies.length === 0) {
    return <span className="text-gray-400 text-xs">No frequency set</span>
  }

  return (
    <div className="space-y-2">
      {/* Frequencies */}
      <div className="flex flex-wrap gap-1">
        {frequencies.slice(0, 2).map((freq, index) => (
          <Badge
            key={index}
            className={`text-xs ${getFrequencyBadgeColor(freq)}`}
          >
            {formatFrequency(freq)}
          </Badge>
        ))}
        {frequencies.length > 2 && (
          <Badge
            variant="outline"
            className="text-xs bg-gray-100"
            title={`${frequencies.length - 2} more: ${frequencies.slice(2).map(f => formatFrequency(f)).join(', ')}`}
          >
            +{frequencies.length - 2}
          </Badge>
        )}
      </div>

      {/* Timing */}
      {task.timing && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">
            {task.timing.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      )}
    </div>
  )
}

// Helper function to parse due time to minutes for sorting
const parseDueTimeToMinutes = (dueTime?: string): number => {
  if (!dueTime) return 1020 // Default to 17:00 (17 * 60 = 1020 minutes)
  const [hours, minutes] = dueTime.split(':').map(Number)
  return hours * 60 + minutes
}

// Helper function to get frequency rank for sorting
const getFrequencyRankForDay = (frequencies: string[], date: Date): number => {
  if (!frequencies || frequencies.length === 0) return 999

  // Frequency priority order (lower number = higher priority)
  const frequencyRanks: Record<string, number> = {
    'once_off': 1,
    'once_off_sticky': 2,
    'every_day': 3,
    'monday': 4,
    'tuesday': 5,
    'wednesday': 6,
    'thursday': 7,
    'friday': 8,
    'saturday': 9,
    'sunday': 10,
    'weekly': 11,
    'specific_weekdays': 12,
    'once_weekly': 13,
    'start_every_month': 14,
    'start_of_every_month': 15,
    'start_certain_months': 16,
    'every_month': 17,
    'certain_months': 18,
    'once_monthly': 19,
    'end_every_month': 20,
    'end_of_every_month': 21,
    'end_certain_months': 22
  }

  // Get the lowest rank (highest priority) from all frequencies
  let minRank = 999
  for (const freq of frequencies) {
    const rank = frequencyRanks[freq] || 999
    if (rank < minRank) {
      minRank = rank
    }
  }

  return minRank
}

// Sortable Header Component
const SortableHeader = ({
  field,
  children,
  sortField,
  sortDirection,
  onSort,
  className = ""
}: {
  field: string
  children: React.ReactNode
  sortField: string
  sortDirection: 'asc' | 'desc'
  onSort: (field: string) => void
  className?: string
}) => {
  const isActive = sortField === field
  const isCentered = className.includes('text-center')

  return (
    <TableHead
      className={`cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center ${isCentered ? 'justify-center' : 'justify-left'}`}>
        <span>{children}</span>
        <div className={`flex flex-col ${isCentered ? 'ml-1' : 'ml-1'}`}>
          <ChevronUp
            className={`h-3 w-3 ${isActive && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
          />
          <ChevronDown
            className={`h-3 w-3 -mt-1 ${isActive && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
          />
        </div>
      </div>
    </TableHead>
  )
}

// Pagination Component
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1"
      >
        Prev
      </Button>

      {getVisiblePages().map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <span className="px-3 py-1 text-gray-500">...</span>
          ) : (
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 min-w-[40px] ${currentPage === page ? "bg-blue-500 text-white" : ""
                }`}
            >
              {page}
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1"
      >
        Next
      </Button>
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
        <Card className="border-l-4 border-l-blue-500 gap-2">
          <CardHeader className="flex flex-col sm:flex-row justify-between">
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
            <Badge className={task.publish_status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' :
              task.publish_status === 'draft' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                'bg-gray-100 text-gray-800 border border-gray-200'}>
              {task.publish_status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="items-center  p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <label className="text-sm font-medium text-gray-600">Title</label>
                <p className="text-sm mt-1 font-medium">{task.title}</p>
              </div>
              {task.description && (
                <div className="relative lg:col-span-3 items-center p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="text-sm mt-1 bg-gray-50 rounded-md">{task.description}</p>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Assignment & Responsibilities */}
        <Card className="border-l-4 border-l-indigo-500 gap-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Responsibilities & Categories</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="items-center  p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
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
              <div className="items-center  p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
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
        <Card className="border-l-4 border-l-green-500 gap-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Scheduling</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative lg:col-span-2 items-center p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <label className="text-sm font-medium text-gray-600">Frequencies</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {task.frequencies && task.frequencies.length > 0 ? (
                    task.frequencies.map((freq, index) => (
                      <Badge key={index} variant="outline" className={getFrequencyBadgeColor(freq)}>
                        {formatFrequency(freq)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">No frequencies set</span>
                  )}
                </div>
              </div>

              <div className="items-center  p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <label className="text-sm font-medium text-gray-600">Timing</label>
                <p className="text-sm mt-1">
                  {task.timing ? (
                    <Badge variant="outline" className={`
                      ${task.timing === 'opening' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        task.timing === 'anytime_during_day' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          task.timing === 'before_order_cut_off' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            task.timing === 'closing' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'}
                    `}>
                      {task.timing.charAt(0).toUpperCase() + task.timing.slice(1).replace(/_/g, ' ')}
                    </Badge>
                  ) : 'Not specified'}
                </p>
              </div>
              <div className="items-center p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                <label className="text-sm font-medium text-gray-600">Due Time</label>
                <p className="text-sm mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.due_time || 'Not specified'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Settings */}
        {(task.due_date || task.start_date || task.end_date || task.publish_delay) && (
          <Card className="border-l-4 border-l-indigo-500 gap-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5" />
                <span>Date Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {task.due_date && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                    <label className="text-sm font-medium text-gray-600">Due Date (Once-off)</label>
                    <p className="text-sm mt-1">{new Date(task.due_date).toLocaleDateString()}</p>
                  </div>
                )}
                {task.start_date && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                    <label className="text-sm font-medium text-gray-600">Start Date</label>
                    <p className="text-sm mt-1">{new Date(task.start_date).toLocaleDateString()}</p>
                  </div>
                )}
                {task.publish_delay && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                    <label className="text-sm font-medium text-gray-600">Publish Delay</label>
                    <p className="text-sm mt-1">{new Date(task.publish_delay).toLocaleDateString()}</p>
                  </div>
                )}
                {task.end_date && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-100 shadow-sm">
                    <label className="text-sm font-medium text-gray-600">End Date</label>
                    <p className="text-sm mt-1">{new Date(task.end_date).toLocaleDateString()}</p>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card className="border-l-4 border-l-yellow-500 gap-2">
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
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; task: any | null }>({ isOpen: false, task: null })

  // Bulk action state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [bulkActionModal, setBulkActionModal] = useState<{ isOpen: boolean; action: 'delete' | 'status' | null }>({ isOpen: false, action: null })
  const [bulkStatusValue, setBulkStatusValue] = useState<PublishStatus>(PublishStatus.ACTIVE)
  const [bulkDeleteConfirmModal, setBulkDeleteConfirmModal] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)

  // Import loading state
  const [isImporting, setIsImporting] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [tasksPerPage, setTasksPerPage] = useState(100)

  // Sorting state
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Drag and drop state for custom ordering
  const [customOrderMap, setCustomOrderMap] = useState<Record<string, number>>({}) // master_task_id -> index
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [isOrderDirty, setIsOrderDirty] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

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

      // Load responsibility options from positions (excluding Administrator)
      const responsibilityOptions = positionsData
        .filter((position: any) => position.name !== 'Administrator')
        .map((position: any) => ({
          value: nameToResponsibilityValue(position.name),
          label: position.name
        }))

      // No longer adding shared options - they have been removed

      RESPONSIBILITY_OPTIONS.length = 0 // Clear existing array
      RESPONSIBILITY_OPTIONS.push(...responsibilityOptions) // Add new options

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


      }

      setTasks(tasksData)

      // Filter out only exact 'Administrator' from the dropdown
      const filteredPositions = positionsData.filter((position: any) => position.name !== 'Administrator')
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

  const handleStatusChange = async (taskId: string, newStatus: PublishStatus) => {
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
        // Notify homepage cards to refresh counts immediately
        try { window.dispatchEvent(new Event('tasks-changed')) } catch { }
      } else {
        // Create new task
        const newTask = await masterTasksApi.create(taskData)
        console.log('Task created:', newTask)

        // Immediately add the new task to the UI
        setTasks([newTask, ...tasks])

        showToast('success', 'Task Created', 'New task was created successfully')
        // Notify homepage cards to refresh counts immediately
        try { window.dispatchEvent(new Event('tasks-changed')) } catch { }
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

  // Bulk action functions
  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks)
    if (checked) {
      newSelected.add(taskId)
    } else {
      newSelected.delete(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(paginatedTasks.map(task => task.id)))
    } else {
      setSelectedTasks(new Set())
    }
  }

  const handleBulkAction = (action: 'delete' | 'status') => {
    if (selectedTasks.size === 0) {
      showToast('error', 'No Selection', 'Please select tasks to perform bulk action')
      return
    }

    if (action === 'delete') {
      setBulkDeleteConfirmModal(true)
    } else {
      setBulkActionModal({ isOpen: true, action })
    }
  }

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirmModal(false)
    setBulkDeleteLoading(true)

    try {
      const selectedTaskIds = Array.from(selectedTasks)
      const selectedTaskTitles = tasks.filter(t => selectedTasks.has(t.id)).map(t => t.title)

      // Delete all selected tasks
      await Promise.all(selectedTaskIds.map(id => masterTasksApi.delete(id)))

      // Remove from UI
      setTasks(tasks.filter(t => !selectedTasks.has(t.id)))
      setSelectedTasks(new Set())

      showToast('success', 'Bulk Delete Complete', `Successfully deleted ${selectedTaskIds.length} task(s)`)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Bulk Delete Failed', `Failed to delete tasks: ${errorMessage}`)
      // Reload data to ensure consistency
      await loadData()
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  const confirmBulkStatusChange = async () => {
    setBulkActionModal({ isOpen: false, action: null })
    setBulkStatusLoading(true)

    try {
      const selectedTaskIds = Array.from(selectedTasks)

      // Update status for all selected tasks
      await Promise.all(selectedTaskIds.map(id =>
        masterTasksApi.update(id, { publish_status: bulkStatusValue })
      ))

      // Update UI
      setTasks(tasks.map(task =>
        selectedTasks.has(task.id)
          ? { ...task, publish_status: bulkStatusValue }
          : task
      ))
      setSelectedTasks(new Set())

      showToast('success', 'Bulk Status Update Complete',
        `Successfully updated ${selectedTaskIds.length} task(s) to ${bulkStatusValue}`)
    } catch (error) {
      console.error('Error in bulk status update:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', 'Bulk Status Update Failed', `Failed to update task statuses: ${errorMessage}`)
      // Reload data to ensure consistency
      await loadData()
    } finally {
      setBulkStatusLoading(false)
    }
  }

  // Removed instance generation handlers and UI per requirement

  // Export handler function
  const handleExport = async () => {
    try {
      if (filteredAndSortedTasks.length === 0) {
        showToast('error', 'Export Failed', 'No tasks to export')
        return
      }

      // Export using current DB schema field names, prettifying key columns for readability
      const toTitle = (s: string) => s ? s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''
      const exportData = filteredAndSortedTasks.map(task => ({
        Title: task.title,
        Description: task.description || '',
        Responsibility: Array.isArray(task.responsibility) ? task.responsibility.map(v => toTitle(String(v))).join(', ') : '',
        Categories: Array.isArray(task.categories)
          ? task.categories.map(v => toTitle(String(v))).join(', ')
          : (task.category ? toTitle(String(task.category)) : ''), // legacy fallback
        Frequencies: Array.isArray(task.frequencies) ? task.frequencies.map(f => formatFrequency(f)).join(', ') : '',
        Timing: task.timing ? toTitle(String(task.timing)) : '',
        'Due Time': task.due_time || '',
        'Due Date': (task as any).due_date || '',
        'Start Date': (task as any).start_date || '',
        'End Date': (task as any).end_date || '',
        'Publish Status': task.publish_status || 'draft',
        'Publish Delay': (task as any).publish_delay || '',
        Weekdays: Array.isArray((task as any).weekdays) ? (task as any).weekdays.join(',') : '',
        Months: Array.isArray((task as any).months) ? (task as any).months.join(',') : '',
        'Sticky Once Off': task.sticky_once_off ? 'TRUE' : 'FALSE',
        'Allow Edit When Locked': task.allow_edit_when_locked ? 'TRUE' : 'FALSE'
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'master_tasks')

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

    setIsImporting(true)

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

      // Validate required headers (case-insensitive, order-agnostic)
      const headerKeys = Object.keys(importData[0] || {})
      const hasAny = (variants: string[]) => headerKeys.some(h => variants.includes(h) || variants.includes(h.toString().toLowerCase()) || variants.includes(h.toString().replace(/\s+/g, '_').toLowerCase()))
      // Only these are required per spec; order may vary
      const requiredHeaderSets: Record<string, string[]> = {
        Description: ['Description', 'description'],
        Responsibility: ['Responsibility', 'responsibility'],
        Categories: ['Categories', 'Category', 'categories', 'category'],
        Frequencies: ['Frequencies', 'Frequency', 'frequencies', 'frequency'],
        Timing: ['Timing', 'timing'],
      }
      const missingHeaders = Object.entries(requiredHeaderSets)
        .filter(([, variants]) => !hasAny(variants.map(v => v.toLowerCase())))
        .map(([label]) => label)
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
      }

      // Helper: normalize object keys (lowercase, remove spaces/underscores)
      const normalizeKeys = (obj: Record<string, any>) => {
        const out: Record<string, any> = {}
        Object.keys(obj).forEach(k => {
          const nk = k.toString().toLowerCase().replace(/\s+/g, '_')
          out[nk] = obj[k]
        })
        return out
      }

      // Process and validate data according to new schema
      const processedData: any[] = []
      for (let i = 0; i < importData.length; i++) {
        const originalRow = importData[i]
        const row = normalizeKeys(originalRow)

        // Support legacy column names by mapping where possible
        const title = (row.title ?? originalRow['Title'])?.toString().trim()
        const description = (row.description ?? originalRow['Description'] ?? '').toString().trim()

        // Title is optional; keep as provided or empty
        const finalTitle = title ?? ''

        // responsibilities/categories/frequencies can be comma-separated strings
        const responsibilityRaw = (row.responsibility ?? originalRow['Responsibility'] ?? '').toString()
        const categoriesRaw = (row.categories ?? originalRow['Category'] ?? originalRow['Categories'] ?? '').toString()
        const frequenciesRaw = (row.frequencies ?? originalRow['Frequency'] ?? originalRow['Frequencies'] ?? '').toString()

        // helpers
        const toArray = (val: string) => val
          ? val.split(',').map(v => v.trim()).filter(Boolean)
          : []
        const toKebab = (s: string) => s
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        const normalizeTiming = (s: string) => {
          if (!s) return 'anytime_during_day'
          const t = s.toString().trim().toLowerCase().replace(/\s+/g, '_')
          // explicit mapping for common display variants
          const map: Record<string, string> = {
            'opening': 'opening',
            'anytime_during_day': 'anytime_during_day',
            'anytime': 'anytime_during_day',
            'before_order_cut_off': 'before_order_cut_off',
            'before_order_cutoff': 'before_order_cut_off',
            'closing': 'closing',
          }
          return map[t] || t
        }
        const normalizeFrequency = (s: string) => {
          if (!s) return ''
          const f = s.toString().trim().toLowerCase().replace(/\s+/g, '_')
          const map: Record<string, string> = {
            'once_off': 'once_off',
            'once-off': 'once_off',
            'once_off_sticky': 'once_off_sticky',
            'once-off_sticky': 'once_off_sticky',
            'every_day': 'every_day',
            'daily': 'every_day',
            'weekly': 'weekly',
            'once_weekly': 'once_weekly',
            'specific_weekdays': 'specific_weekdays',
            'monday': 'monday',
            'tuesday': 'tuesday',
            'wednesday': 'wednesday',
            'thursday': 'thursday',
            'friday': 'friday',
            'saturday': 'saturday',
            'once_monthly': 'once_monthly',
            'start_every_month': 'start_of_every_month',
            'start_of_every_month': 'start_of_every_month',
            'start_of_month': 'start_of_every_month',
            'start_certain_months': 'start_certain_months',
            // Specific month mappings for start of month
            'start_of_january': 'start_of_month_jan',
            'start_of_jan': 'start_of_month_jan',
            'start_of_february': 'start_of_month_feb',
            'start_of_feb': 'start_of_month_feb',
            'start_of_march': 'start_of_month_mar',
            'start_of_mar': 'start_of_month_mar',
            'start_of_april': 'start_of_month_apr',
            'start_of_apr': 'start_of_month_apr',
            'start_of_may': 'start_of_month_may',
            'start_of_june': 'start_of_month_jun',
            'start_of_jun': 'start_of_month_jun',
            'start_of_july': 'start_of_month_jul',
            'start_of_jul': 'start_of_month_jul',
            'start_of_august': 'start_of_month_aug',
            'start_of_aug': 'start_of_month_aug',
            'start_of_september': 'start_of_month_sep',
            'start_of_sep': 'start_of_month_sep',
            'start_of_october': 'start_of_month_oct',
            'start_of_oct': 'start_of_month_oct',
            'start_of_november': 'start_of_month_nov',
            'start_of_nov': 'start_of_month_nov',
            'start_of_december': 'start_of_month_dec',
            'start_of_dec': 'start_of_month_dec',
            'every_month': 'every_month',
            'certain_months': 'certain_months',
            'end_every_month': 'end_of_every_month',
            'end_of_every_month': 'end_of_every_month',
            'end_of_month': 'end_of_every_month',
            'end_certain_months': 'end_certain_months',
            // Specific month mappings for end of month
            'end_of_january': 'end_of_month_jan',
            'end_of_jan': 'end_of_month_jan',
            'end_of_february': 'end_of_month_feb',
            'end_of_feb': 'end_of_month_feb',
            'end_of_march': 'end_of_month_mar',
            'end_of_mar': 'end_of_month_mar',
            'end_of_april': 'end_of_month_apr',
            'end_of_apr': 'end_of_month_apr',
            'end_of_may': 'end_of_month_may',
            'end_of_june': 'end_of_month_jun',
            'end_of_jun': 'end_of_month_jun',
            'end_of_july': 'end_of_month_jul',
            'end_of_jul': 'end_of_month_jul',
            'end_of_august': 'end_of_month_aug',
            'end_of_aug': 'end_of_month_aug',
            'end_of_september': 'end_of_month_sep',
            'end_of_sep': 'end_of_month_sep',
            'end_of_october': 'end_of_month_oct',
            'end_of_oct': 'end_of_month_oct',
            'end_of_november': 'end_of_month_nov',
            'end_of_nov': 'end_of_month_nov',
            'end_of_december': 'end_of_month_dec',
            'end_of_dec': 'end_of_month_dec',
          }
          return map[f] || f
        }

        // normalize arrays
        const responsibility = toArray(responsibilityRaw).map(toKebab)
        const categories = toArray(categoriesRaw).map(toKebab)
        const frequencies = toArray(frequenciesRaw).map(normalizeFrequency)

        // timing with default (map display -> enum value)
        const timing = normalizeTiming(row.timing ?? originalRow['Timing'] ?? 'anytime_during_day')

        // optional dates/times - auto-assign due_time based on timing if not provided
        const due_time_from_file = (row.due_time ?? originalRow['Default Due Time'] ?? '').toString().trim()
        const due_time = due_time_from_file || DEFAULT_DUE_TIMES[timing as keyof typeof DEFAULT_DUE_TIMES] || undefined
        const due_date = (row.due_date ?? originalRow['Due Date'] ?? '').toString().trim() || undefined
        const start_date = (row.start_date ?? originalRow['Start Date'] ?? '').toString().trim() || undefined
        const end_date = (row.end_date ?? originalRow['End Date'] ?? '').toString().trim() || undefined

        // status and publish delay
        const publish_status_raw = (row.publish_status ?? originalRow['Status'] ?? 'draft').toString().trim().toLowerCase()
        const publish_status = ['draft', 'active', 'inactive'].includes(publish_status_raw) ? publish_status_raw : 'draft'
        const publish_delay = (row.publish_delay ?? originalRow['Publish Delay'] ?? originalRow['Publish Delay Date'] ?? '').toString().trim() || undefined

        // weekdays/months
        const parseNums = (v: any) => v
          ? v.toString().split(',').map((n: string) => parseInt(n.trim(), 10)).filter((n: number) => !isNaN(n))
          : []
        const weekdays = parseNums(row.weekdays ?? originalRow['Weekdays'])
        const months = parseNums(row.months ?? originalRow['Months'])

        // booleans
        const toBool = (v: any) => {
          const s = (v ?? '').toString().trim().toLowerCase()
          return ['true', 'yes', 'y', '1'].includes(s)
        }
        const sticky_once_off = toBool(row.sticky_once_off ?? originalRow['Sticky Once Off'])
        const allow_edit_when_locked = toBool(row.allow_edit_when_locked ?? originalRow['Allow Edit When Locked'])

        // validations
        // Title is optional; do not enforce presence
        if (!responsibility.length) {
          throw new Error(`At least one responsibility is required in row ${i + 2}`)
        }
        if (!categories.length) {
          throw new Error(`At least one category is required in row ${i + 2}`)
        }
        if (!frequencies.length) {
          throw new Error(`At least one frequency is required in row ${i + 2}`)
        }

        processedData.push({
          title: finalTitle,
          description,
          responsibility,
          categories,
          frequencies,
          timing,
          due_time,
          due_date,
          start_date,
          end_date,
          publish_status,
          publish_delay,
          weekdays,
          months,
          sticky_once_off,
          allow_edit_when_locked,
        })
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
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Initialize custom order map when tasks load
  useEffect(() => {
    if (tasks.length === 0) {
      setCustomOrderMap({})
      setIsOrderDirty(false)
      return
    }

    // Check if any task has custom_order from database
    const hasCustomOrder = tasks.some(t => typeof t.custom_order === 'number')

    if (!hasCustomOrder) {
      // No custom order exists, initialize with base default order
      const baseOrder: Record<string, number> = {}
      const baseSorted = getBaseSortedTasks(tasks)
      baseSorted.forEach((task, index) => {
        baseOrder[task.id] = index
      })
      setCustomOrderMap(baseOrder)
      setIsOrderDirty(false)
    } else {
      // Custom order exists, use it
      const orderMap: Record<string, number> = {}
      tasks.forEach((task) => {
        // Use custom_order from database if available, otherwise use default order
        if (typeof task.custom_order === 'number') {
          orderMap[task.id] = task.custom_order
        } else {
          // For tasks without custom_order, assign a high number to put them at the end
          orderMap[task.id] = 999999
        }
      })
      setCustomOrderMap(orderMap)
      setIsOrderDirty(false)
    }
  }, [tasks, positions])

  // Helper function to get base sorted tasks (Timing, Frequency, Position order, Task Description)
  const getBaseSortedTasks = (taskList: MasterTask[]) => {
    return [...taskList].sort((a, b) => {
      // 1. Sort by due_time (timing)
      const aMin = parseDueTimeToMinutes(a.due_time)
      const bMin = parseDueTimeToMinutes(b.due_time)
      if (aMin !== bMin) return aMin - bMin

      // 2. Sort by position display_order (responsibility)
      const aResponsibility = (a.responsibility || [])[0] || ''
      const bResponsibility = (b.responsibility || [])[0] || ''

      if (aResponsibility !== bResponsibility) {
        // Find the positions for these responsibilities
        const aPosition = positions.find(p => nameToResponsibilityValue(p.name) === aResponsibility)
        const bPosition = positions.find(p => nameToResponsibilityValue(p.name) === bResponsibility)

        const aOrder = aPosition?.display_order || 999
        const bOrder = bPosition?.display_order || 999

        if (aOrder !== bOrder) return aOrder - bOrder
      }

      // 3. Sort by frequency rank
      const aRank = getFrequencyRankForDay(a.frequencies || [], new Date())
      const bRank = getFrequencyRankForDay(b.frequencies || [], new Date())
      if (aRank !== bRank) return aRank - bRank

      // 4. Sort by task description
      const aDesc = a.description?.toLowerCase() || ''
      const bDesc = b.description?.toLowerCase() || ''
      if (aDesc !== bDesc) return aDesc.localeCompare(bDesc)

      return 0
    })
  }

  // Drag handlers for desktop rows
  const handleRowDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleRowDragOver = (e: React.DragEvent, overIndex: number) => {
    e.preventDefault()
  }

  const handleRowDrop = (overIndex: number) => {
    if (dragIndex === null || dragIndex === overIndex) return

    // Reorder the filtered tasks
    const current = [...filteredAndSortedTasks]
    const [moved] = current.splice(dragIndex, 1)
    current.splice(overIndex, 0, moved)

    // Rebuild custom order map based on new order
    const newMap: Record<string, number> = { ...customOrderMap }
    current.forEach((task, index) => {
      newMap[task.id] = index
    })

    setCustomOrderMap(newMap)
    setIsOrderDirty(true)
    setDragIndex(null)
  }

  const handleSaveOrder = async () => {
    if (isSavingOrder) return
    try {
      setIsSavingOrder(true)

      // Create order array from customOrderMap
      const orderArray = Object.entries(customOrderMap).map(([taskId, customOrder]) => ({
        id: taskId,
        custom_order: customOrder
      }))

      // Save the order using the new reorder API
      await masterTasksApi.reorder(orderArray)

      // Update the local tasks state with the new custom_order values
      setTasks(prevTasks =>
        prevTasks.map(task => ({
          ...task,
          custom_order: customOrderMap[task.id] ?? task.custom_order
        }))
      )

      toastSuccess('Order Saved', 'Custom order has been saved successfully.')
      setIsOrderDirty(false)
      setCustomOrderMap({}) // Clear the temporary order map

      // Reload tasks to get updated custom_order data
      await loadData()
    } catch (e) {
      console.error('Failed to save custom order', e)
      toastError('Save Failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsSavingOrder(false)
    }
  }

  // Filter and sort tasks based on search and filters
  const filteredAndSortedTasks = useMemo(() => {
    // First, filter tasks
    const filtered = tasks.filter(task => {
      const matchesSearch = !searchTerm ||
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())

      // Check if position matches - since we're filtering by position but tasks have responsibility arrays,
      // we need to match the selected position name with the responsibility values
      const matchesPosition = filterPosition === 'all' ||
        (task.responsibility && Array.isArray(task.responsibility) && task.responsibility.some(r => {
          // If filtering by a position ID, get the position name and convert it to the same format
          // used when creating responsibility values (lowercase with dashes)
          const position = positions.find(p => p.id === filterPosition)
          if (!position) return false

          // Convert position name to the same format used in responsibility values
          const formattedPositionName = nameToResponsibilityValue(position.name)

          // Check if the responsibility matches the formatted position name
          return r === formattedPositionName
        }))

      const matchesStatus = filterStatus === 'all' || task.publish_status === filterStatus

      // Check if category matches either in categories array or legacy category field
      const matchesCategory = filterCategory === 'all' ||
        task.category === filterCategory ||
        (task.categories && task.categories.includes(filterCategory))

      return matchesSearch && matchesPosition && matchesStatus && matchesCategory
    })

    // Then, sort tasks
    if (sortField) {
      // Manual sorting is active
      return [...filtered].sort((a, b) => {
        let aValue: any = ''
        let bValue: any = ''

        switch (sortField) {
          case 'title':
            aValue = a.description?.toLowerCase() || ''
            bValue = b.description?.toLowerCase() || ''
            break
          case 'responsibility':
            aValue = a.responsibility?.[0] || ''
            bValue = b.responsibility?.[0] || ''
            break
          case 'category':
            aValue = a.categories?.[0] || a.category || ''
            bValue = b.categories?.[0] || b.category || ''
            break
          case 'frequency':
            aValue = a.frequencies?.[0] || ''
            bValue = b.frequencies?.[0] || ''
            break
          case 'status':
            aValue = a.publish_status || ''
            bValue = b.publish_status || ''
            break
          case 'due_time':
            aValue = (a as any).default_due_time || '17:00'
            bValue = (b as any).default_due_time || '17:00'
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    } else {
      // No manual sorting, use customOrderMap or fallback to default sorting

      // If customOrderMap is empty or not ready, use base default sorting
      if (Object.keys(customOrderMap).length === 0) {
        return getBaseSortedTasks(filtered)
      }

      // Use customOrderMap (which contains either database custom_order or default order)
      return [...filtered].sort((a, b) => {
        const aOrder = customOrderMap[a.id]
        const bOrder = customOrderMap[b.id]

        // If both have order values, sort by them
        if (typeof aOrder === 'number' && typeof bOrder === 'number') {
          return aOrder - bOrder
        }

        // If only one has order, prioritize it
        if (typeof aOrder === 'number' && typeof bOrder !== 'number') {
          return -1
        }
        if (typeof bOrder === 'number' && typeof aOrder !== 'number') {
          return 1
        }

        // Fallback to base default order
        return getBaseSortedTasks([a, b]).indexOf(a) - getBaseSortedTasks([a, b]).indexOf(b)
      })
    }
  }, [tasks, searchTerm, filterPosition, filterStatus, filterCategory, sortField, sortDirection, customOrderMap, positions])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedTasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterPosition, filterStatus, filterCategory])

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
            <strong>Debug Info:</strong><br />
            User: {user ? 'Present' : 'Missing'}<br />
            IsAdmin: {isAdmin ? 'True' : 'False'}<br />
            User Role: {user?.role || 'Unknown'}<br />
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
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
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
                    placeholder="Search tasks (description)..."
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
                          {getCategoryDisplayName(category)}
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
                      disabled={isImporting}
                      className="w-full"
                    >
                      {isImporting ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-2"></div>
                          Importing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <Upload className="w-4 h-4 mr-1" />
                          Import
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="card-surface w-full gap-0">
          <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg lg:text-xl mb-1">
                Master Tasks ({filteredAndSortedTasks.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredAndSortedTasks.length)}`} of {filteredAndSortedTasks.length})
                {totalPages > 1 && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    - Page {currentPage} of {totalPages}
                  </span>
                )}
              </CardTitle>
              <div className="mt-2 sm:mt-0 sm:ml-4 flex items-center gap-2">
                <span className="text-sm text-gray-600">Per page:</span>
                <Select value={String(tasksPerPage)} onValueChange={(v) => { setTasksPerPage(parseInt(v, 10)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="150">150</SelectItem>
                    <SelectItem value="1000000">View All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex space-x-3">
              {/* Bulk Actions */}
              {selectedTasks.size > 0 && (
                <div className="flex space-x-3">
                  <span className="text-sm font-medium text-gray-700 mt-1">
                    {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('status')}
                      disabled={bulkStatusLoading}
                      className="flex items-center space-x-1"
                    >
                      {bulkStatusLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span>Changing Status...</span>
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4" />
                          <span>Change Status</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('delete')}
                      disabled={bulkDeleteLoading}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      {bulkDeleteLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          <span>Deleting Selected...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Selected</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {/* Save Order Button - Only show when order is dirty and in "All Positions" view */}
              {isOrderDirty && filterPosition === 'all' && !sortField && (
                <div>
                  <Button
                    onClick={handleSaveOrder}
                    disabled={isSavingOrder}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    {isSavingOrder ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                        Saving Order...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        Save Order
                      </span>
                    )}
                  </Button>
                </div>
              )}
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
                        <TableHead className="w-[5%] py-3 bg-gray-50 text-center">
                          <Checkbox
                            checked={selectedTasks.size === paginatedTasks.length && paginatedTasks.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all tasks"
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                          />
                        </TableHead>
                        <SortableHeader
                          field="title"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[23%] py-3 bg-gray-50"
                        >
                          Title & Description
                        </SortableHeader>
                        <SortableHeader
                          field="responsibility"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[14%] py-3 bg-gray-50"
                        >
                          Responsibilities
                        </SortableHeader>
                        <SortableHeader
                          field="category"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[14%] py-3 bg-gray-50"
                        >
                          Categories
                        </SortableHeader>
                        <SortableHeader
                          field="frequency"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[14%] py-3 bg-gray-50"
                        >
                          Frequencies & Timing
                        </SortableHeader>
                        <SortableHeader
                          field="status"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[10%] py-3 bg-gray-50 text-center"
                        >
                          Status
                        </SortableHeader>
                        <SortableHeader
                          field="due_time"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[10%] py-3 bg-gray-50 text-center"
                        >
                          Due Time
                        </SortableHeader>
                        <TableHead className="w-[10%] py-3 bg-gray-50 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTasks.map((task, index) => {
                        const globalIndex = startIndex + index
                        const isDragging = dragIndex === globalIndex
                        const canDrag = filterPosition === 'all' && !sortField // Only allow drag when showing all positions and no manual sorting

                        return (
                          <TableRow
                            key={task.id}
                            className={`hover:bg-gray-50 transition-colors ${isDragging ? 'opacity-50' : ''} ${canDrag ? 'cursor-move' : ''}`}
                            draggable={canDrag}
                            onDragStart={() => canDrag && handleRowDragStart(globalIndex)}
                            onDragOver={(e) => canDrag && handleRowDragOver(e, globalIndex)}
                            onDrop={() => canDrag && handleRowDrop(globalIndex)}
                            onDragEnd={() => setDragIndex(null)}
                          >
                            <TableCell className="py-3 text-center">
                              <Checkbox
                                checked={selectedTasks.has(task.id)}
                                onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                                aria-label={`Select task ${task.title}`}
                                className="data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                              />
                            </TableCell>
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
                            <TableCell className="py-3">
                              <div className="max-w-full overflow-hidden">
                                {renderFrequencyWithDetails(task)}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Select
                                  value={task.publish_status}
                                  onValueChange={(value: PublishStatus) =>
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
                                {task.due_time || 'Not set'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-wrap justify-center gap-1 max-w-full">
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
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-4 w-full px-4 sm:px-6">
                  {paginatedTasks.map((task) => (
                    <Card key={task.id} className="border border-gray-200 w-full">
                      <CardContent className="mobile-card p-4">
                        <div className="space-y-3 w-full">
                          {/* Selection and Title */}
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              checked={selectedTasks.has(task.id)}
                              onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                              aria-label={`Select task ${task.title}`}
                              className="mt-1 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500"
                            />
                            <div className="flex-1">
                              <h3 className="font-medium text-base">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                            </div>
                          </div>
                          {/* Details Grid */}
                          <div className="space-y-3 text-sm grid sm:grid-cols-2 gap-2">
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
                              <span className="text-gray-500">Frequency:</span>
                              <div className="mt-1">
                                {renderFrequencyWithDetails(task)}
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
                            <div className="sm:flex items-center justify-between space-y-2">
                              <div className="flex items-center justify-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <Select
                                  value={task.publish_status}
                                  onValueChange={(value: PublishStatus) =>
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
                              <div className="flex items-center justify-center flex-wrap gap-4">
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

                {/* Pagination */}
                {filteredAndSortedTasks.length > 0 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                )}

                {filteredAndSortedTasks.length === 0 && (
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
                task={editingTask || undefined}
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

        {/* Bulk Status Change Modal */}
        <Dialog open={bulkActionModal.isOpen && bulkActionModal.action === 'status'} onOpenChange={(open) => !open && setBulkActionModal({ isOpen: false, action: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Bulk Status Change
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Change status for <strong>{selectedTasks.size}</strong> selected task{selectedTasks.size !== 1 ? 's' : ''}?
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">New Status:</label>
                <Select value={bulkStatusValue} onValueChange={(value: PublishStatus) => setBulkStatusValue(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PublishStatus.DRAFT}>Draft</SelectItem>
                    <SelectItem value={PublishStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={PublishStatus.INACTIVE}>Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkActionModal({ isOpen: false, action: null })}
                  disabled={bulkStatusLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmBulkStatusChange}
                  disabled={bulkStatusLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {bulkStatusLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : ("")
                  }
                  Update Status
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation Modal */}
        <Dialog open={bulkDeleteConfirmModal} onOpenChange={setBulkDeleteConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Bulk Delete Tasks
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>{selectedTasks.size}</strong> selected task{selectedTasks.size !== 1 ? 's' : ''}?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium mb-2">This will permanently delete:</p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• {selectedTasks.size} master task{selectedTasks.size !== 1 ? 's' : ''}</li>
                  <li>• All associated task instances</li>
                  <li>• All completion history</li>
                </ul>
                <p className="text-red-800 text-sm font-medium mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkDeleteConfirmModal(false)}
                  disabled={bulkActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmBulkDelete}
                  disabled={bulkActionLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {bulkActionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Tasks
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}