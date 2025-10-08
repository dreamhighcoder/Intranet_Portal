'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { DateNavigator } from '@/components/date-navigator'
import { TaskFilters } from '@/components/task-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Check, X, Eye, LogOut, Settings, ChevronRight, Search, Clock, Users, FileText, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { toastError, toastSuccess, toastWarning } from '@/hooks/use-toast'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { authenticatedGet, authenticatedPost, positionsApi, publicHolidaysApi } from '@/lib/api-client'
import TaskDetailModal from '@/components/checklist/TaskDetailModal'
import { getAustralianNow, getAustralianToday, formatAustralianDate, parseAustralianDate, createAustralianDateTime, australianNowUtcISOString, toAustralianTime, AUSTRALIAN_TIMEZONE } from '@/lib/timezone-utils'
import { formatInTimeZone } from 'date-fns-tz'
import { calculateTaskStatus, setHolidays } from '@/lib/task-status-calculator'
import { TASK_FREQUENCIES } from '@/lib/constants'
// Shared UI holiday set for PH-aware business day checks
let UI_HOLIDAY_SET = new Set<string>()

interface PositionCompletion {
  position_name: string
  completed_by: string
  completed_at: string
  is_completed: boolean
}

interface ChecklistTask {
  id: string
  master_task_id: string
  date: string
  role: string
  status: string
  completed_by?: string
  completed_at?: string
  payload: Record<string, any>
  notes?: string
  created_at: string
  updated_at: string
  // New position-specific completion data
  position_completions?: PositionCompletion[]
  is_completed_for_position?: boolean
  // New-task indicator provided by API
  is_new?: boolean
  // Status calculation details from backend
  detailed_status?: 'not_due_yet' | 'due_today' | 'overdue' | 'missed' | 'completed'
  due_date?: string | null
  due_time?: string | null
  lock_date?: string | null
  lock_time?: string | null
  can_complete?: boolean
  master_task: {
    id: string
    title: string
    description?: string
    timing: string
    due_time?: string
    due_date?: string // For once_off tasks
    responsibility: string[]
    categories: string[]
    frequencies: string[] // Using frequencies from database
    custom_order?: number
    // Ensure availability of creation and visibility anchors
    created_at?: string // ISO timestamp
    publish_delay?: string // ISO date string
    start_date?: string // ISO date string
    end_date?: string // ISO date string
  }
}

// Category display names, colors, and emojis
const CATEGORY_CONFIG = {
  'stock-control': { label: '📦 Stock Control', emoji: '📦', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'compliance': { label: '☑️ Compliance', emoji: '☑️', color: 'bg-red-100 text-red-800 border-red-200' },
  'cleaning': { label: '🧹 Cleaning', emoji: '🧹', color: 'bg-green-100 text-green-800 border-green-200' },
  'pharmacy-services': { label: '💉 Pharmacy Services', emoji: '💉', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'fos-operations': { label: '🛍️ FOS Operations', emoji: '🛍️', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'dispensary-operations': { label: '💊 Dispensary Operations', emoji: '💊', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'general-pharmacy-operations': { label: '🌀 General Pharmacy Operations', emoji: '🌀', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'business-management': { label: '📊 Business Management', emoji: '📊', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'general': { label: 'General', emoji: '', color: 'bg-gray-100 text-gray-800 border-gray-200' }
}

const getCategoryConfig = (category: string) => {
  return CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || {
    label: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    emoji: '',
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Responsibility badge colors - bright and distinct colors for better visibility
const RESPONSIBILITY_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-red-100 text-red-800 border-red-200'
]

// Timing badge colors - bright and distinct colors for different timing values
const TIMING_COLORS = {
  'opening': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'closing': 'bg-rose-100 text-rose-800 border-rose-200',
  'anytime_during_day': 'bg-blue-100 text-blue-800 border-blue-200',
  'specific_time': 'bg-purple-100 text-purple-800 border-purple-200',
  'morning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'afternoon': 'bg-orange-100 text-orange-800 border-orange-200',
  'evening': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'before_opening': 'bg-teal-100 text-teal-800 border-teal-200',
  'after_closing': 'bg-pink-100 text-pink-800 border-pink-200',
  'during_business_hours': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'end_of_day': 'bg-amber-100 text-amber-800 border-amber-200',
  'start_of_day': 'bg-lime-100 text-lime-800 border-lime-200',
  'lunch_time': 'bg-violet-100 text-violet-800 border-violet-200'
}

const getResponsibilityColor = (responsibility: string) => {
  // Create a consistent hash-based color assignment for each responsibility
  let hash = 0
  for (let i = 0; i < responsibility.length; i++) {
    const char = responsibility.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % RESPONSIBILITY_COLORS.length
  return RESPONSIBILITY_COLORS[index]
}

const getTimingColor = (timing: string) => {
  return TIMING_COLORS[timing as keyof typeof TIMING_COLORS] || 'bg-gray-100 text-gray-800 border-gray-200'
}

const formatResponsibility = (responsibility: string) => {
  if (!responsibility) return ''
  const key = responsibility.trim().toLowerCase()

  // Explicit mappings for known formats
  const SPECIAL_MAP: Record<string, string> = {
    'pharmacist-primary': 'Pharmacist (Primary)',
    'pharmacist-supporting': 'Pharmacist (Supporting)',
    'pharmacy-assistant-s': 'Pharmacy Assistant/s',
    'dispensary-technician-s': 'Dispensary Technician/s',
    'daa-packer-s': 'DAA Packer/s',
    'operational-managerial': 'Operational/Managerial',
  }
  if (SPECIAL_MAP[key]) return SPECIAL_MAP[key]

  // Helper to title-case with acronym handling
  const toTitle = (w: string) => {
    if (w.toLowerCase() === 'daa') return 'DAA'
    return w.charAt(0).toUpperCase() + w.slice(1)
  }

  // Pharmacist variants with parentheses
  const pharmacistMatch = key.match(/^pharmacist-(primary|supporting)$/)
  if (pharmacistMatch) {
    return `Pharmacist (${toTitle(pharmacistMatch[1])})`
  }

  // Plural marker: trailing "-s" -> "/s"
  if (key.endsWith('-s')) {
    const base = key.slice(0, -2).split('-').map(toTitle).join(' ')
    return `${base}/s`
  }

  // Default: kebab-case to spaced Title Case
  return key
    .split('-')
    .map(toTitle)
    .join(' ')
}

const getResponsibilityAbbreviation = (responsibility: string) => {
  if (!responsibility) return ''
  const key = responsibility.trim().toLowerCase()

  // Abbreviation mappings
  const ABBREVIATION_MAP: Record<string, string> = {
    'pharmacy-assistant-s': 'PA',
    'pharmacy-assistant': 'PA',
    'dispensary-technician-s': 'DT',
    'dispensary-technician': 'DT',
    'daa-packer-s': 'DP',
    'daa-packer': 'DP',
    'pharmacist-primary': 'PH1',
    'pharmacist-supporting': 'PH2',
    'operational-managerial': 'OM',
  }

  return ABBREVIATION_MAP[key] || responsibility.substring(0, 2).toUpperCase()
}

// Apply carry-over logic to preserve position completion badges during carry-over period
const getTaskStatusWithCarryOver = (task: ChecklistTask, currentDate: string, isViewingToday: boolean = false): string => {
  // Debug: Log task data at entry
  console.log('🔍 getTaskStatusWithCarryOver called:', {
    taskTitle: task.master_task?.title,
    taskId: task.id,
    currentDate,
    isViewingToday,
    is_completed_for_position: task.is_completed_for_position,
    completed_at: task.completed_at,
    position_completions: task.position_completions,
    detailed_status: task.detailed_status,
    frequencies: task.master_task?.frequencies
  })

  // If task is not completed for this position, calculate the status
  if (!task.is_completed_for_position) {
    // If we have a cached detailed_status, use it (from API)
    if (task.detailed_status) {
      console.log('✅ Using cached detailed_status:', task.detailed_status)
      return task.detailed_status
    }

    // Otherwise, calculate the status (for clean tasks created by admin logic)
    const taskInput = {
      date: task.date,
      due_date: task.due_date || undefined,
      master_task: {
        due_time: task.master_task?.due_time || undefined,
        created_at: task.master_task?.created_at || undefined,
        publish_delay: task.master_task?.publish_delay || undefined,
        start_date: task.master_task?.start_date || undefined,
        end_date: task.master_task?.end_date || undefined,
        frequencies: task.master_task?.frequencies || undefined,
      },
      detailed_status: undefined,
      is_completed_for_position: false,
      status: undefined,
      lock_date: undefined,
      lock_time: undefined,
    }

    return calculateTaskStatus(taskInput, currentDate)
  }

  // Task is completed for this position - implement proper carry-over logic
  // We need to determine the completion date for carry-over calculations
  let completionDateStr = task.date // Default to task date

  // Use position completion date if available
  if (task.position_completions && task.position_completions.length > 0) {
    const completedAt = task.position_completions[0].completed_at
    console.log('📅 Extracting completion date from position_completions:', {
      taskTitle: task.master_task?.title,
      completed_at_raw: completedAt,
      position_completions_length: task.position_completions.length
    })
    if (completedAt) {
      // Convert UTC timestamp to Australian date
      const completedAtDate = new Date(completedAt)
      const completedAtAustralian = toAustralianTime(completedAtDate)
      completionDateStr = formatAustralianDate(completedAtAustralian)
      console.log('📅 Completion date extracted:', {
        completedAtDate: completedAtDate.toISOString(),
        completedAtAustralian: completedAtAustralian.toISOString(),
        completionDateStr
      })
    }
  } else if (task.completed_at) {
    // Use task completion date
    const completedAtAustralian = toAustralianTime(new Date(task.completed_at))
    completionDateStr = formatAustralianDate(completedAtAustralian)
    console.log('📅 Completion date from task.completed_at:', completionDateStr)
  }

  // Implement proper carry-over logic based on frequency rules
  const frequencies = task.master_task?.frequencies || []
  const currentDateObj = parseAustralianDate(currentDate)
  const completionDateObj = parseAustralianDate(completionDateStr)
  const taskInstanceDateObj = parseAustralianDate(task.date)

  // Helper function to get last Saturday of month
  const getLastSaturdayOfMonth = (date: Date): Date => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0) // Last day of month
    const lastSaturday = new Date(lastDay)

    // Find the last Saturday
    while (lastSaturday.getDay() !== 6) { // 6 = Saturday
      lastSaturday.setDate(lastSaturday.getDate() - 1)
    }

    return lastSaturday
  }

  // Check if we're within the carry-over period based on frequency
  let isWithinCarryOverPeriod = false

  if (frequencies.includes('every_day')) {
    // Every Day: No carry-over. Each day has its own instance.
    // Show "✓ Done" only on the completion date
    isWithinCarryOverPeriod = currentDate === completionDateStr
    console.log('📅 Every Day task carry-over check:', {
      taskTitle: task.master_task?.title,
      currentDate,
      completionDateStr,
      isWithinCarryOverPeriod,
      matches: currentDate === completionDateStr
    })
  } else if (frequencies.includes('once_monthly') ||
    frequencies.some(f => f.includes('month'))) {
    // Monthly tasks: Carry-over until last Saturday of the month when completed
    const lastSaturday = getLastSaturdayOfMonth(completionDateObj)
    const lastSaturdayEndOfDay = new Date(lastSaturday)
    lastSaturdayEndOfDay.setHours(23, 59, 59, 999)

    // Show "✓ Done" from completion date until last Saturday of the month at 23:59
    const currentDateTime = new Date(currentDateObj)
    currentDateTime.setHours(23, 59, 59, 999) // End of current viewing day

    isWithinCarryOverPeriod = currentDateTime <= lastSaturdayEndOfDay && currentDateObj >= completionDateObj
  } else if (frequencies.some(f => f.includes('weekly') ||
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(f))) {
    // Weekly tasks: Carry-over until Saturday of the week when completed
    const completionWeekSaturday = new Date(completionDateObj)
    const daysUntilSaturday = (6 - completionDateObj.getDay() + 7) % 7
    completionWeekSaturday.setDate(completionDateObj.getDate() + daysUntilSaturday)
    completionWeekSaturday.setHours(23, 59, 59, 999)

    const currentDateTime = new Date(currentDateObj)
    currentDateTime.setHours(23, 59, 59, 999)

    isWithinCarryOverPeriod = currentDateTime <= completionWeekSaturday && currentDateObj >= completionDateObj
  } else {
    // For other frequencies (once_off, etc.), show completed status indefinitely until manually changed
    isWithinCarryOverPeriod = currentDateObj >= completionDateObj
  }

  // Debug logging
  if (frequencies.includes('every_day') || frequencies.includes('once_monthly') ||
    frequencies.some(f => f.includes('weekly') || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(f))) {
    const taskType = frequencies.includes('every_day') ? 'Daily' :
      frequencies.includes('once_monthly') ? 'Monthly' : 'Weekly'
    console.log(`🔍 ${taskType} task carry-over check:`, {
      taskTitle: task.master_task?.title,
      currentDate,
      taskInstanceDate: task.date,
      completionDate: completionDateStr,
      isCompleted: task.is_completed_for_position,
      frequencies,
      isWithinCarryOverPeriod,
      willShowCompleted: isWithinCarryOverPeriod
    })
  }

  if (isWithinCarryOverPeriod) {
    console.log('✅ Task is within carry-over period, returning "completed"')
    return 'completed'
  }

  console.log('⚠️ Task is NOT within carry-over period, calculating new status')

  // Carry-over period has ended - calculate status for new task instance
  // Calculate what the status would be if this was a new task for the current viewing date
  const newTaskInput = {
    date: currentDate, // Use current viewing date as the new task date
    due_date: task.due_date || currentDate, // For recurring tasks, due date is the current date
    master_task: {
      due_time: task.master_task?.due_time || undefined,
      created_at: task.master_task?.created_at || undefined,
      publish_delay: task.master_task?.publish_delay || undefined,
      start_date: task.master_task?.start_date || undefined,
      end_date: task.master_task?.end_date || undefined,
      frequencies: task.master_task?.frequencies || undefined,
    },
    detailed_status: undefined, // Don't use old status
    is_completed_for_position: false, // New instance is not completed
    status: undefined,
    lock_date: undefined,
    lock_time: undefined,
  }

  const newTaskStatus = calculateTaskStatus(newTaskInput, currentDate)

  // For completed tasks that have moved beyond carry-over period:
  // - If viewing today: Daily tasks show "due_today", others show "not_due_yet"
  // - If viewing future dates: All tasks show "not_due_yet"
  let finalStatus = newTaskStatus

  if (!isViewingToday) {
    // When viewing future dates, all completed tasks that have moved beyond 
    // carry-over period should show as "not_due_yet" regardless of frequency
    finalStatus = 'not_due_yet'
  }

  // Debug logging for all tasks
  console.log(`🔍 Task post-carry-over status:`, {
    taskTitle: task.master_task?.title,
    currentDate,
    originalTaskDate: task.date,
    completionDate: completionDateStr,
    carryOverEnded: !isWithinCarryOverPeriod,
    isViewingToday,
    frequencies: task.master_task?.frequencies,
    newTaskCalculatedStatus: newTaskStatus,
    finalStatus
  })

  return finalStatus
}





// Calculate status for a specific frequency
const calculateStatusForFrequency = (
  task: ChecklistTask,
  frequency: string,
  viewDate: Date,
  now: Date,
  isViewingToday: boolean
): string => {
  const instanceDate = parseAustralianDate(task.date)
  const dueTimeStr = task?.master_task?.due_time || '17:00'

  // Get appearance, due, and lock dates for this frequency
  const cutoffs = getFrequencyCutoffs(task, frequency, instanceDate)
  if (!cutoffs.appearanceDate) return 'not_due_yet'

  const { appearanceDate, dueDate, lockDate, lockTime } = cutoffs

  // Before appearance date
  if (viewDate < appearanceDate) {
    return 'not_due_yet'
  }

  // On due date - check time if viewing today
  if (viewDate.getTime() === dueDate.getTime()) {
    if (isViewingToday && dueTimeStr) {
      const dueDateTime = createAustralianDateTime(formatAustralianDate(dueDate), dueTimeStr)

      // Check lock time only if lockDate and lockTime exist
      if (lockDate && lockTime) {
        const lockDateTime = createAustralianDateTime(formatAustralianDate(lockDate), lockTime)
        if (now >= lockDateTime) return 'missed'
      }

      if (now >= dueDateTime) return 'overdue'
      return 'due_today'
    } else {
      return 'due_today'
    }
  }

  // After due date
  if (viewDate > dueDate) {
    // Check if task is locked (missed)
    if (lockDate && lockTime && viewDate > lockDate) {
      return 'missed'
    }
    // If no lock date (e.g., once_off tasks), never become missed
    if (!lockDate) {
      return 'overdue'
    }
    return 'overdue'
  }

  // Between appearance and due date
  return 'not_due_yet'
}

// Get appearance, due, and lock dates for a specific frequency
const getFrequencyCutoffs = (task: ChecklistTask, frequency: string, instanceDate: Date) => {
  const dueTimeStr = task?.master_task?.due_time || '17:00'

  // Helper functions for date calculations
  const getWeekMonday = (d: Date) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      console.warn('⚠️ getWeekMonday: Invalid date provided:', d)
      return new Date() // Return current date as fallback
    }
    const result = new Date(d)
    const day = result.getDay()
    const diff = day === 0 ? -6 : 1 - day
    result.setDate(result.getDate() + diff)
    return result
  }

  const getWeekSaturday = (d: Date) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      console.warn('⚠️ getWeekSaturday: Invalid date provided:', d)
      return new Date() // Return current date as fallback
    }
    const result = new Date(d)
    const day = result.getDay()
    const diff = 6 - (day === 0 ? 7 : day)
    result.setDate(result.getDate() + diff)
    return result
  }

  const getLastSaturdayOfMonth = (d: Date) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      console.warn('⚠️ getLastSaturdayOfMonth: Invalid date provided:', d)
      return new Date() // Return current date as fallback
    }
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const day = lastDay.getDay() // 0=Sun..6=Sat
    // Calculate days to go back to reach Saturday
    // If last day is Saturday (6): diff = 0
    // If last day is Sunday (0): diff = 1
    // If last day is Friday (5): diff = 6
    // If last day is Monday (1): diff = 2, etc.
    const diff = day === 6 ? 0 : (day + 1) % 7
    const lastSaturday = new Date(lastDay)
    lastSaturday.setDate(lastDay.getDate() - diff)
    return lastSaturday
  }

  const prevBusinessDay = (d: Date) => {
    const result = new Date(d)
    let attempts = 0
    const maxAttempts = 30 // Prevent infinite loops

    while (!isBusinessDay(result) && attempts < maxAttempts) {
      result.setDate(result.getDate() - 1)
      attempts++
    }

    if (attempts >= maxAttempts) {
      console.warn('⚠️ prevBusinessDay: Max attempts reached, returning original date')
      return new Date(d)
    }

    return result
  }

  const isBusinessDay = (d: Date) => {
    // Validate date first
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      console.warn('⚠️ isBusinessDay: Invalid date provided:', d)
      return false
    }

    const day = d.getDay()
    // Sunday is 0, Saturday is 6
    if (day === 0) return false // Sunday is not a business day

    try {
      // Treat Monday-Saturday as working days unless it is a public holiday
      const dateStr = formatAustralianDate(d)
      return !UI_HOLIDAY_SET.has(dateStr)
    } catch (error) {
      console.warn('⚠️ isBusinessDay: Error formatting date:', error, d)
      return false
    }
  }

  switch (frequency) {
    case 'once_off':
    case 'once_off_sticky': {
      // For once_off tasks, use the due_date from master_task (required field)
      let dueDate: Date

      if (task.master_task?.due_date) {
        dueDate = parseAustralianDate(task.master_task.due_date)
      } else {
        // Fallback if due_date is missing (should not happen for properly configured once_off tasks)
        console.warn('Once-off task missing due_date, using instance date as fallback:', task.master_task?.title)
        dueDate = instanceDate
      }

      // For once_off tasks:
      // - Appear: Immediately after "Active" status (on or after due date)
      // - Due: Admin-entered due_date (required)
      // - Carry: Same instance appears every day until Done
      // - Lock: Never auto-lock (keep appearing indefinitely until Done)

      // Appearance date is the earlier of instance date or due date
      const appearanceDate = instanceDate <= dueDate ? instanceDate : dueDate

      return {
        appearanceDate,
        dueDate,
        lockDate: null, // Once-off tasks never auto-lock
        lockTime: null
      }
    }

    case 'every_day': {
      return {
        appearanceDate: instanceDate,
        dueDate: instanceDate,
        lockDate: instanceDate,
        lockTime: '23:59'
      }
    }

    case 'once_weekly': {
      const weekMon = getWeekMonday(instanceDate)
      const weekSat = getWeekSaturday(instanceDate)

      let appearanceDate = new Date(weekMon)
      let dueDate = new Date(weekSat)

      // Adjust for business days
      while (!isBusinessDay(appearanceDate) && appearanceDate <= weekSat) {
        appearanceDate.setDate(appearanceDate.getDate() + 1)
      }
      while (!isBusinessDay(dueDate) && dueDate >= weekMon) {
        dueDate.setDate(dueDate.getDate() - 1)
      }

      return {
        appearanceDate,
        dueDate,
        lockDate: dueDate,
        lockTime: '23:59'
      }
    }

    case 'monday':
    case 'tuesday':
    case 'wednesday':
    case 'thursday':
    case 'friday':
    case 'saturday': {
      const weekdayMap: Record<string, number> = {
        monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      }

      const targetWeekday = weekdayMap[frequency]
      const weekMon = getWeekMonday(instanceDate)
      const weekSat = getWeekSaturday(instanceDate)

      // Calculate the target date for this weekday in the same week as instanceDate
      const targetDate = new Date(weekMon)
      targetDate.setDate(weekMon.getDate() + (targetWeekday - 1))

      // For specific weekday tasks:
      // - Appear: On the target weekday
      // - Due: On the target weekday  
      // - Carry: Until Saturday of that week
      // - Lock: At 23:59 on Saturday (or earlier if Saturday is holiday)

      let appearanceDate = new Date(targetDate)
      let dueDate = new Date(targetDate)

      // Handle holiday adjustments for appearance/due date
      if (!isBusinessDay(targetDate)) {
        // If target weekday is a holiday:
        if (targetWeekday === 1) { // Monday
          // For Monday: appear on next latest non-PH weekday forward
          while (!isBusinessDay(appearanceDate) && appearanceDate <= weekSat) {
            appearanceDate.setDate(appearanceDate.getDate() + 1)
          }
        } else { // Tuesday-Saturday
          // For Tue-Sat: appear on nearest earlier non-PH weekday in same week
          let earlierDate = new Date(targetDate)
          while (!isBusinessDay(earlierDate) && earlierDate >= weekMon) {
            earlierDate.setDate(earlierDate.getDate() - 1)
          }

          if (earlierDate >= weekMon && isBusinessDay(earlierDate)) {
            appearanceDate = earlierDate
          } else {
            // No earlier non-PH weekday, use next latest non-PH weekday forward
            while (!isBusinessDay(appearanceDate) && appearanceDate <= weekSat) {
              appearanceDate.setDate(appearanceDate.getDate() + 1)
            }
          }
        }
        dueDate = new Date(appearanceDate) // Due date follows appearance date after PH adjustment
      }

      // Lock date: Saturday of the same week (or earlier if Saturday is holiday)
      let lockDate = new Date(weekSat)
      while (!isBusinessDay(lockDate) && lockDate >= weekMon) {
        lockDate.setDate(lockDate.getDate() - 1)
      }

      return {
        appearanceDate,
        dueDate,
        lockDate,
        lockTime: '23:59'
      }
    }

    case 'start_of_every_month':
    case 'start_every_month': // alias support
    case 'start_of_month':
    case 'start_certain_months':
    case 'every_month':
    case 'certain_months':
    case 'start_of_month_jan':
    case 'start_of_month_feb':
    case 'start_of_month_mar':
    case 'start_of_month_apr':
    case 'start_of_month_may':
    case 'start_of_month_jun':
    case 'start_of_month_jul':
    case 'start_of_month_aug':
    case 'start_of_month_sep':
    case 'start_of_month_oct':
    case 'start_of_month_nov':
    case 'start_of_month_dec': {
      // First business day of the month
      const monthStart = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
      let appearanceDate = new Date(monthStart)

      // Move to first business day
      while (!isBusinessDay(appearanceDate)) {
        appearanceDate.setDate(appearanceDate.getDate() + 1)
      }

      // Due 5 business days later
      let dueDate = new Date(appearanceDate)
      let businessDaysAdded = 0
      while (businessDaysAdded < 4) {
        dueDate.setDate(dueDate.getDate() + 1)
        if (isBusinessDay(dueDate)) {
          businessDaysAdded++
        }
      }

      // Lock at end of month: last Saturday of the month (PH-adjusted to previous business day)
      const lastSaturday = getLastSaturdayOfMonth(instanceDate)
      const lockDate = prevBusinessDay(lastSaturday)

      return {
        appearanceDate,
        dueDate,
        lockDate,
        lockTime: '23:59'
      }
    }

    case 'end_of_month':
    case 'end_certain_months': {
      // Last business day of the month
      const monthEnd = new Date(instanceDate.getFullYear(), instanceDate.getMonth() + 1, 0)
      let appearanceDate = new Date(monthEnd)

      // Move to last business day
      while (!isBusinessDay(appearanceDate)) {
        appearanceDate.setDate(appearanceDate.getDate() - 1)
      }

      // Due 5 business days later (into next month if needed)
      let dueDate = new Date(appearanceDate)
      let businessDaysAdded = 0
      while (businessDaysAdded < 4) {
        dueDate.setDate(dueDate.getDate() + 1)
        if (isBusinessDay(dueDate)) {
          businessDaysAdded++
        }
      }

      // Lock at the same time as due date for end-of-month tasks
      const lockDate = new Date(dueDate)

      return {
        appearanceDate,
        dueDate,
        lockDate,
        lockTime: '23:59'
      }
    }

    case 'once_monthly': {
      // Once monthly tasks: Due on the last Saturday of the month
      const lastSaturday = getLastSaturdayOfMonth(instanceDate)

      // Appearance date: First business day of the month
      const monthStart = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
      let appearanceDate = new Date(monthStart)
      while (!isBusinessDay(appearanceDate)) {
        appearanceDate.setDate(appearanceDate.getDate() + 1)
      }

      // Due date: Last Saturday of the month (adjusted for business days)
      let dueDate = new Date(lastSaturday)
      while (!isBusinessDay(dueDate)) {
        dueDate.setDate(dueDate.getDate() - 1)
      }

      // Lock date: Same as due date
      const lockDate = new Date(dueDate)

      return {
        appearanceDate,
        dueDate,
        lockDate,
        lockTime: '23:59'
      }
    }

    default: {
      // Default behavior for unknown frequencies
      return {
        appearanceDate: instanceDate,
        dueDate: instanceDate,
        lockDate: instanceDate,
        lockTime: '23:59'
      }
    }
  }
}

const renderBadgesWithTruncation = (
  items: string[],
  maxVisible: number = 2,
  type: 'responsibility' | 'category' = 'responsibility',
  colorFn?: (value: string) => string
) => {
  // For categories: if there are 2 or more items, show all as emoji-only badges
  if (type === 'category') {
    return items.map((item, index) => {
      const config = getCategoryConfig(item)
      return (
        <Badge key={index} className={`text-xs ${config.color}`} title={config.label}>
          {config.emoji}
        </Badge>
      )
    })
  }

  // For responsibilities: if there are 2 or more items, show all as abbreviation badges
  if (type === 'responsibility' && items.length >= 2) {
    return items.map((item, index) => {
      const colorClass = colorFn ? colorFn(item) : getResponsibilityColor(item)
      const abbreviation = getResponsibilityAbbreviation(item)
      const fullName = formatResponsibility(item)
      return (
        <Badge key={index} className={`text-xs ${colorClass}`} title={fullName}>
          {abbreviation}
        </Badge>
      )
    })
  }

  // For single item, show full format
  if (items.length <= maxVisible) {
    return items.map((item, index) => {
      if (type === 'responsibility') {
        const colorClass = colorFn ? colorFn(item) : getResponsibilityColor(item)
        return (
          <Badge key={index} className={`text-xs ${colorClass}`}>
            {formatResponsibility(item)}
          </Badge>
        )
      } else {
        const config = getCategoryConfig(item)
        return (
          <Badge key={index} className={`text-xs ${config.color}`}>
            {config.label}
          </Badge>
        )
      }
    })
  }

  // This should not be reached with the new logic, but keeping for safety
  const visibleItems = items.slice(0, maxVisible)
  const hiddenItems = items.slice(maxVisible)

  return (
    <>
      {visibleItems.map((item, index) => {
        if (type === 'responsibility') {
          const colorClass = colorFn ? colorFn(item) : getResponsibilityColor(item)
          return (
            <Badge key={index} className={`text-xs ${colorClass}`}>
              {formatResponsibility(item)}
            </Badge>
          )
        } else {
          const config = getCategoryConfig(item)
          return (
            <Badge key={index} className={`text-xs ${config.color}`}>
              {config.label}
            </Badge>
          )
        }
      })}
      {type === 'responsibility' && hiddenItems.length > 0 && (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
          +{hiddenItems.length}
        </Badge>
      )}
    </>
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

// Helper to render shared responsibilities with user icon and count
const renderSharedResponsibilities = (
  responsibilities: string[] = [],
  currentRoleKebab: string,
  maxVisible: number = 2
) => {
  const totalResponsibilities = responsibilities?.length || 0
  if (totalResponsibilities <= 1) {
    return null
  }

  return (
    <div className="justify-center flex gap-2">
      <Users className="h-5 w-5 text-blue-500" />
      <span className="text-sm text-gray-700">({totalResponsibilities})</span>
    </div>
  )
}

// Helper function to render frequency with additional details
const renderFrequencyWithDetails = (task: ChecklistTask) => {
  // Use frequencies array
  const frequencies = task.master_task.frequencies || []

  if (frequencies.length === 0) {
    return <span className="text-gray-400 text-xs">No frequency set</span>
  }

  return (
    <div className="justify-center space-y-2">
      {/* Frequencies */}
      <div className="justify-center flex flex-wrap gap-1">
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
    </div>
  )
}

// Helpers for sorting by Due Time then Frequency
const parseDueTimeToMinutes = (time?: string | null) => {
  if (!time || typeof time !== 'string') return 23 * 60 + 59 // push undefined to end
  const parts = time.split(':')
  if (parts.length < 2) return 23 * 60 + 59
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return 23 * 60 + 59
  return h * 60 + m
}

// --- Timing helpers for filtering and Publish column ---
const OPENING_MIN = 9 * 60 + 30 // 09:30
const ANYTIME_MIN = 16 * 60 + 30 // 16:30
const CUTOFF_MIN = 16 * 60 + 55 // 16:55
const CLOSING_MIN = 17 * 60 // 17:00

const mapTimingToBucket = (timing: string): 'opening' | 'anytime_during_day' | 'before_order_cut_off' | 'closing' => {
  const t = (timing || '').toLowerCase()
  if (['opening', 'start_of_day', 'before_opening'].includes(t)) return 'opening'
  if (['closing', 'end_of_day', 'after_closing', 'evening'].includes(t)) return 'closing'
  if (['anytime_during_day', 'during_business_hours', 'morning', 'afternoon', 'lunch_time'].includes(t)) return 'anytime_during_day'
  if (t === 'before_order_cut_off') return 'before_order_cut_off'
  return 'anytime_during_day'
}

const getTimingBucket = (task: ChecklistTask): 'opening' | 'anytime_during_day' | 'before_order_cut_off' | 'closing' => {
  const timing = task?.master_task?.timing || ''
  // If specific_time is defined, use due_time to decide bucket per business rules
  if (timing === 'specific_time' && task?.master_task?.due_time) {
    const mins = parseDueTimeToMinutes(task.master_task.due_time)
    if (mins < OPENING_MIN) return 'opening'
    if (mins < ANYTIME_MIN) return 'anytime_during_day'
    if (mins < CUTOFF_MIN) return 'before_order_cut_off'
    // from cutoff to closing and beyond -> closing
    return 'closing'
  }
  // Non-specific times map by timing groups
  return mapTimingToBucket(timing)
}

const getTimingInitial = (task: ChecklistTask): string => {
  const b = getTimingBucket(task)
  if (b === 'opening') return 'O'
  if (b === 'anytime_during_day') return 'A'
  if (b === 'before_order_cut_off') return 'B'
  return 'C'
}

const getPublishTooltip = (task: ChecklistTask): string => {
  try {
    // Prefer created_at (ISO) then publish_delay (date) as the publish anchor
    const createdIso = task?.master_task?.created_at
    const publishDelay = task?.master_task?.publish_delay // YYYY-MM-DD
    let d: Date | null = null
    if (createdIso) {
      d = toAustralianTime(new Date(createdIso))
    } else if (publishDelay) {
      // combine publishDelay date with 09:00 as a neutral time
      const dateOnly = parseAustralianDate(publishDelay)
      d = toAustralianTime(dateOnly)
    }
    if (!d) return ''
    const datePart = formatAustralianDate(d)
    const timePart = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} ${timePart}`
  } catch {
    return ''
  }
}

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

const getFrequencyRankForDay = (frequencies: string[] = [], dateStr: string) => {
  if (!frequencies || frequencies.length === 0) return 9999
  const lower = frequencies.map(f => (f || '').toLowerCase())

  const date = parseAustralianDate(dateStr)
  const dowNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dow = date.getDay() // 0-6
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const monKey = monthKeys[date.getMonth()]

  let rank = 9999
  const update = (r: number) => { if (r < rank) rank = r }

  // Based on requirements: Once Off, Every Day, Once Weekly, Monday ~ Saturday, Once Monthly, Start of Every Month, Start of Month (Jan) ~ Start of Month (Dec), End of Every Month, End of Month (Jan) ~ End of Month (Dec)

  // 1) Once Off
  if (lower.includes('once_off') || lower.includes('once_off_sticky')) update(1)
  // 2) Every Day
  if (lower.includes('every_day')) update(2)
  // 3) Once Weekly
  if (lower.includes('once_weekly') || lower.includes('weekly')) update(3)
  // 4-9) Monday ~ Saturday (specific weekdays)
  if (lower.includes('monday')) update(4)
  if (lower.includes('tuesday')) update(5)
  if (lower.includes('wednesday')) update(6)
  if (lower.includes('thursday')) update(7)
  if (lower.includes('friday')) update(8)
  if (lower.includes('saturday')) update(9)
  if (lower.includes('sunday')) update(10)
  if (lower.includes('specific_weekdays')) update(11)
  // 12) Once Monthly
  if (lower.includes('once_monthly')) update(12)
  // 13) Start of Every Month
  if (lower.includes('start_of_every_month') || lower.includes('start_every_month')) update(13)
  if (lower.includes('start_certain_months')) update(14)
  // 15-26) Start of Month (Jan..Dec) - all months, not just current
  if (lower.includes('start_of_month_jan')) update(15)
  if (lower.includes('start_of_month_feb')) update(16)
  if (lower.includes('start_of_month_mar')) update(17)
  if (lower.includes('start_of_month_apr')) update(18)
  if (lower.includes('start_of_month_may')) update(19)
  if (lower.includes('start_of_month_jun')) update(20)
  if (lower.includes('start_of_month_jul')) update(21)
  if (lower.includes('start_of_month_aug')) update(22)
  if (lower.includes('start_of_month_sep')) update(23)
  if (lower.includes('start_of_month_oct')) update(24)
  if (lower.includes('start_of_month_nov')) update(25)
  if (lower.includes('start_of_month_dec')) update(26)
  if (lower.includes('every_month')) update(27)
  if (lower.includes('certain_months')) update(28)
  // 29) End of Every Month
  if (lower.includes('end_of_every_month') || lower.includes('end_every_month')) update(29)
  if (lower.includes('end_certain_months')) update(30)
  // 31-42) End of Month (Jan..Dec) - all months, not just current
  if (lower.includes('end_of_month_jan')) update(31)
  if (lower.includes('end_of_month_feb')) update(32)
  if (lower.includes('end_of_month_mar')) update(33)
  if (lower.includes('end_of_month_apr')) update(34)
  if (lower.includes('end_of_month_may')) update(35)
  if (lower.includes('end_of_month_jun')) update(36)
  if (lower.includes('end_of_month_jul')) update(37)
  if (lower.includes('end_of_month_aug')) update(38)
  if (lower.includes('end_of_month_sep')) update(39)
  if (lower.includes('end_of_month_oct')) update(40)
  if (lower.includes('end_of_month_nov')) update(41)
  if (lower.includes('end_of_month_dec')) update(42)

  return rank
}

// Simple Header Component (sorting disabled)
const SortableHeader = ({
  children,
  className = ""
}: {
  children: React.ReactNode
  className?: string
}) => {
  const isCentered = className.includes('text-center')
  return (
    <TableHead className={`transition-colors ${className}`}>
      <div className={`flex items-center ${isCentered ? 'justify-center' : 'justify-left'}`}>
        <span>{children}</span>
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
        type="button"
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
              type="button"
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
        type="button"
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

export default function RoleChecklistPage() {
  const { user, isLoading, signOut, isAdmin } = usePositionAuth()
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawRole = params.role as string
  const userRole = isAdmin ? 'admin' : 'viewer'

  // Validate and decode role parameter
  if (!rawRole || typeof rawRole !== 'string') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Role</h1>
          <p className="text-gray-600">The role parameter is missing or invalid.</p>
        </div>
      </div>
    )
  }

  // Decode URL-encoded role parameter and validate
  let role: string
  try {
    role = decodeURIComponent(rawRole)
    // Additional validation to ensure it's a valid role format
    if (role.includes('[') || role.includes(']') || role.includes('%')) {
      throw new Error('Invalid role format')
    }
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Role Format</h1>
          <p className="text-gray-600">The role parameter contains invalid characters.</p>
        </div>
      </div>
    )
  }

  // Kebab-case form of current role for comparisons
  const currentRoleKebab = useMemo(() => toKebabCase(role), [role])

  const [currentDate, setCurrentDate] = useState(() => {
    // Use URL date if present, otherwise default to Australian today
    const urlDate = searchParams.get("date")
    if (urlDate) return urlDate
    return getAustralianToday()
  })

  // Helper to check if we're viewing today's date
  const isViewingToday = useMemo(() => {
    return currentDate === getAustralianToday()
  }, [currentDate])

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedResponsibility, setSelectedResponsibility] = useState("all")
  const [selectedTiming, setSelectedTiming] = useState("all") // Default to "all"
  const [selectedFrequency, setSelectedFrequency] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasks, setTasks] = useState<ChecklistTask[]>([])
  const [loading, setLoading] = useState(true) // Initial page load
  const [tasksLoading, setTasksLoading] = useState(false) // Task reloading
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false) // Track if we've loaded at least once
  const [taskCounts, setTaskCounts] = useState({
    total: 0,
    done: 0,
    not_due_yet: 0,
    due_today: 0,
    overdue: 0,
    missed: 0
  })
  const [selectedTask, setSelectedTask] = useState<ChecklistTask | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set())

  // Linked documents state
  const [taskLinkedDocuments, setTaskLinkedDocuments] = useState<Record<string, any[]>>({})

  // Bulk action states
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [setBulkDeleteConfirmModal] = useState(false)
  const [setBulkActionLoading] = useState(false)

  // Load public holidays for current year to enable PH-aware UI lock/appearance
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const year = new Date(currentDate).getFullYear().toString()
        const holidays = await publicHolidaysApi.getAll({ year })
        const set = new Set<string>()
          ; (holidays || []).forEach((h: any) => {
            if (h?.date) set.add(h.date)
          })
        UI_HOLIDAY_SET = set
        // Also set holidays in the task status calculator
        setHolidays(set)
        // Bump refresh key to re-render with holiday-aware status
        setRefreshKey((k) => k + 1)
      } catch (e) {
        console.warn('Failed to load public holidays for UI:', e)
      }
    }
    loadHolidays()
  }, [currentDate])

  // Custom order is now managed from Master Tasks Management page only





  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [tasksPerPage, setTasksPerPage] = useState(100)

  // Sorting disabled: rely on default due_time + frequency or custom order

  // Handle auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  // Get responsibilities from positions table (ordered by display_order, excluding Administrator)
  const [responsibilitiesFromDb, setResponsibilitiesFromDb] = useState<string[]>([])
  const [positions, setPositions] = useState<Array<{ id: string, name: string, display_order?: number }>>([])

  useEffect(() => {
    const loadResponsibilities = async () => {
      try {
        const positionsData = await positionsApi.getAll()
        const nonAdmin = (positionsData || [])
          .filter((p: any) => p.name !== 'Administrator')
          .sort((a: any, b: any) => {
            const ao = a.display_order ?? 9999
            const bo = b.display_order ?? 9999
            if (ao !== bo) return ao - bo
            return (a.displayName || a.name).localeCompare(b.displayName || b.name)
          })

        // Store positions for sorting (needed for all users)
        setPositions(nonAdmin)

        // Only set responsibilities dropdown for admin users
        if (isAdmin) {
          const mapped = nonAdmin
            .map((p: any) => toKebabCase(p.displayName || p.name))
            .filter((v: string) => !!v && v.trim() !== '')
          setResponsibilitiesFromDb(mapped)
        }
      } catch (e) {
        console.error('Failed to load responsibilities from DB:', e)
        setResponsibilitiesFromDb([])
        setPositions([])
      }
    }
    loadResponsibilities()
  }, [isAdmin])

  // Add global error handler for debugging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error)
    }
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Load tasks when date, refresh key, role, or responsibility changes
  useEffect(() => {
    console.log('🔄 LOAD TASKS useEffect triggered - dependency changed')
    console.log('📊 Dependencies:', { refreshKey, isLoading, user: !!user, role, isAdmin, currentDate })
    console.log('📊 Current tasks count:', tasks.length)

    const loadTasks = async () => {
      // Don't load if auth is still loading
      if (isLoading) {
        console.log('Skipping task load - auth still loading')
        return
      }

      // If no user or role, set loading to false and return
      if (!user || !role) {
        console.log('Skipping task load - no user or role:', 'user:', !!user, 'role:', role)
        setLoading(false)
        return
      }

      // Additional check to ensure user is properly authenticated
      if (!user.isAuthenticated) {
        console.log('User not authenticated, skipping task load')
        setLoading(false)
        return
      }

      console.log('🚀 Starting task load for role:', role, 'date:', currentDate)
      console.log('⏳ Setting task loading to true...')
      console.log('📊 hasInitiallyLoaded:', hasInitiallyLoaded)

      // Use different loading states for initial load vs task reload
      if (!hasInitiallyLoaded) {
        console.log('🔄 First load - using full page loading')
        setLoading(true) // Initial load - show full page loading
      } else {
        console.log('🔄 Subsequent load - using task overlay loading')
        setTasksLoading(true) // Task reload - show overlay
      }
      try {
        // Normalize role to ensure it's in the kebab-case format
        const normalizedRole = toKebabCase(role);

        // Build query parameters
        const params = new URLSearchParams({
          role: normalizedRole,
          date: currentDate
        })

        // Add admin mode for admins
        if (isAdmin) {
          params.append('admin_mode', 'true')
          // Note: responsibility filtering is now handled client-side only
        }

        console.log('Fetching tasks with params:', params.toString())
        console.log('📅 Current date being used for API call:', currentDate)
        console.log('User details:', {
          id: user.id,
          role: user.role,
          isAuthenticated: user.isAuthenticated,
          displayName: user.displayName
        })

        const data = await authenticatedGet(`/api/checklist?${params.toString()}`)

        console.log('Raw API response:', data)
        console.log('Response type:', typeof data)
        console.log('Response keys:', data ? Object.keys(data) : 'null')

        if (!data || !data.success) {
          console.warn('API reported failure:', data?.error)
          console.warn('Full response object:', JSON.stringify(data, null, 2))
          // Avoid throwing to prevent Next.js unhandled error; show toast and keep UI usable
          setTasks([])
          const message = data?.error || 'Failed to fetch tasks'
          toastError('Error', message)
          return
        }

        console.log('Tasks received:', data.data?.length || 0)
        console.log('📋 Setting tasks in state...')
        const newTasks = data.data || []

        // Debug logging for completed tasks
        const completedTasks = newTasks.filter((task: ChecklistTask) =>
          task.is_completed_for_position === true
        )
        if (completedTasks.length > 0) {
          console.log('🎯 Completed tasks from API:', completedTasks.map((task: ChecklistTask) => ({
            title: task.master_task?.title,
            id: task.id,
            is_completed_for_position: task.is_completed_for_position,
            completed_at: task.completed_at,
            position_completions: task.position_completions,
            detailed_status: task.detailed_status,
            frequencies: task.master_task?.frequencies
          })))
        }

        // Debug logging for Saturday tasks
        const saturdayTasks = newTasks.filter((task: ChecklistTask) =>
          task.master_task?.frequencies?.includes('saturday')
        )
        if (saturdayTasks.length > 0) {
          console.log('Saturday tasks from API:', saturdayTasks.map((task: ChecklistTask) => ({
            title: task.master_task?.title,
            frequencies: task.master_task?.frequencies,
            date: task.date,
            status: task.status
          })))
        }

        setTasks(newTasks)
        console.log('✅ Tasks set in state successfully, new count:', newTasks.length)

        // Mark as initially loaded after first successful load
        if (!hasInitiallyLoaded) {
          console.log('✅ Marking as initially loaded')
          setHasInitiallyLoaded(true)
        }

        // Calculate task counts using backend's detailed status
        const counts = {
          total: data.data.length,
          done: data.data.filter((t: ChecklistTask) => t.status === 'completed').length,
          not_due_yet: 0,
          due_today: 0,
          overdue: 0,
          missed: 0
        }

        data.data.forEach((task: ChecklistTask) => {
          if (task.status !== 'completed') {
            // Always use dynamic calculation to handle time-sensitive status properly
            const status = getTaskStatusWithCarryOver(task, currentDate, isViewingToday)

            switch (status) {
              case 'not_due_yet':
                counts.not_due_yet++
                break
              case 'due_today':
                counts.due_today++
                break
              case 'overdue':
                counts.overdue++
                break
              case 'missed':
                counts.missed++
                break
              default:
                counts.due_today++ // fallback
            }
          }
        })

        setTaskCounts(counts)
      } catch (error) {
        console.error('Error loading tasks:', error)
        setTasks([])

        // More specific error handling
        if (error instanceof Error) {
          if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
            toastError("Loading Error", "Failed to load page resources. Please refresh the page.")
          } else if (error.message.includes('Network')) {
            toastError("Network Error", "Please check your internet connection and try again.")
          } else {
            toastError("Error", `Failed to load tasks: ${error.message}`)
          }
        } else {
          toastError("Error", "Failed to load tasks. Please try again.")
        }
      } finally {
        console.log('🏁 Finally block - resetting loading states')
        setLoading(false)
        setTasksLoading(false)
        console.log('✅ Loading states reset')
      }
    }

    loadTasks()
  }, [refreshKey, isLoading, user, role, isAdmin, currentDate])

  // Load linked documents for all tasks
  useEffect(() => {
    const loadLinkedDocuments = async () => {
      if (tasks.length === 0) return

      try {
        // Get unique master task IDs
        const masterTaskIds = [...new Set(tasks.map(task => task.master_task_id))]

        // Fetch linked documents for each master task
        const documentsMap: Record<string, any[]> = {}

        await Promise.all(
          masterTaskIds.map(async (masterTaskId) => {
            try {
              const response = await fetch(`/api/resource-hub/task-links/${masterTaskId}`)
              if (response.ok) {
                const data = await response.json()
                if (data.success && data.data) {
                  documentsMap[masterTaskId] = data.data
                }
              }
            } catch (error) {
              console.error(`Error loading documents for task ${masterTaskId}:`, error)
            }
          })
        )

        setTaskLinkedDocuments(documentsMap)
      } catch (error) {
        console.error('Error loading linked documents:', error)
      }
    }

    loadLinkedDocuments()
  }, [tasks])

  useEffect(() => {
    console.log('🔄 URL params useEffect triggered')
    const dateParam = searchParams.get("date")
    console.log('📅 Date param from URL:', dateParam, 'Current date:', currentDate)

    // Only update from URL if it's different and not empty
    if (dateParam && dateParam !== currentDate) {
      console.log('📅 URL date param changed, updating currentDate from', currentDate, 'to', dateParam)
      setCurrentDate(dateParam)
    }

    // Handle responsibility filter from URL parameter (for admin navigation from calendar)
    const responsibilityParam = searchParams.get("responsibility_filter")
    if (responsibilityParam && isAdmin && responsibilityParam !== selectedResponsibility) {
      console.log('🎯 Updating responsibility filter from URL:', responsibilityParam)
      setSelectedResponsibility(responsibilityParam)
    }
  }, [searchParams, isAdmin]) // Keep minimal dependencies to prevent loops

  const handleDateChange = (date: string) => {
    try {
      console.log('🗓️ handleDateChange called with:', date)
      console.log('📅 Current date before change:', currentDate)

      // Only update if the date is actually different
      if (date === currentDate) {
        console.log('📅 Date unchanged, skipping update')
        return
      }

      console.log('🔄 About to update URL and trigger state change...')

      // Update the URL - this will trigger the searchParams useEffect which will update the state
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set('date', date)
      router.replace(`${window.location.pathname}?${newSearchParams.toString()}`, { scroll: false })

      console.log('✅ URL updated, state change will follow via useEffect')
    } catch (error) {
      console.error('❌ Error in handleDateChange:', error)
    }
  }

  const handleTaskComplete = async (taskId: string) => {
    console.log('🔄 handleTaskComplete called with taskId:', taskId)

    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) {
      console.log('⚠️ Task already processing, skipping:', taskId)
      return
    }

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update - include position_completions array for proper carry-over logic
    const completedAtTimestamp = australianNowUtcISOString()
    const userDisplayName = user?.displayName || user?.position?.displayName || 'Unknown'

    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          // Create a new position completion entry for optimistic update
          const newPositionCompletion: PositionCompletion = {
            position_name: role, // Current role/position
            completed_by: userDisplayName,
            completed_at: completedAtTimestamp,
            is_completed: true
          }

          return {
            ...task,
            status: 'completed',
            completed_at: completedAtTimestamp,
            is_completed_for_position: true,
            position_completions: [newPositionCompletion],
            detailed_status: 'completed' as const // Clear cached status to force recalculation
          }
        }
        return task
      })
    )

    try {
      console.log('📡 Sending completion request for taskId:', taskId)
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'complete'
      })

      console.log('📡 Completion API response:', result)

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to complete task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Completed", "Task has been marked as complete.")

      // Broadcast event so homepage cards refresh their counts
      try {
        console.log('🔔 Broadcasting tasks-changed event:', { date: currentDate, role })
        window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { date: currentDate, role } }))
        // Also broadcast a general task update event for other components
        console.log('🔔 Broadcasting task-status-changed event:', { taskId, date: currentDate, role, action: 'complete' })
        window.dispatchEvent(new CustomEvent('task-status-changed', {
          detail: {
            taskId: taskId,
            date: currentDate,
            role,
            action: 'complete',
            timestamp: Date.now()
          }
        }))
      } catch (error) {
        console.error('Error broadcasting events:', error)
      }
    } catch (error) {
      console.error('Error completing task:', error)
      // Revert optimistic update on error
      setRefreshKey((prev) => prev + 1)
      toastError("Error", error instanceof Error ? error.message : "Failed to complete task. Please try again.")
    } finally {
      // Remove from processing set
      setProcessingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleTaskUndo = async (taskId: string) => {
    console.log('🔄 handleTaskUndo called with taskId:', taskId)

    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) {
      console.log('⚠️ Task already processing, skipping:', taskId)
      return
    }

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update - clear position_completions array
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? {
            ...task,
            status: 'pending',
            completed_at: undefined,
            completed_by: undefined,
            is_completed_for_position: false,
            position_completions: [], // Clear position completions
            detailed_status: undefined // Clear cached status to force recalculation
          }
          : task
      )
    )

    try {
      console.log('📡 Sending undo request for taskId:', taskId)
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'undo'
      })

      console.log('📡 Undo API response:', result)

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to undo task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Reopened", "Task has been reopened.")

      // Broadcast event so homepage cards refresh their counts
      try {
        console.log('🔔 Broadcasting tasks-changed event (undo):', { date: currentDate, role })
        window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { date: currentDate, role } }))
        // Also broadcast a general task update event for other components
        console.log('🔔 Broadcasting task-status-changed event (undo):', { taskId, date: currentDate, role, action: 'undo' })
        window.dispatchEvent(new CustomEvent('task-status-changed', {
          detail: {
            taskId: taskId,
            date: currentDate,
            role,
            action: 'undo',
            timestamp: Date.now()
          }
        }))
      } catch (error) {
        console.error('Error broadcasting events:', error)
      }
    } catch (error) {
      console.error('Error undoing task:', error)
      // Revert optimistic update on error
      setRefreshKey((prev) => prev + 1)
      toastError("Error", error instanceof Error ? error.message : "Failed to undo task. Please try again.")
    } finally {
      // Remove from processing set
      setProcessingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleFinish = () => {
    signOut()
    router.push("/")
  }

  const handleViewDetails = (task: ChecklistTask) => {
    setSelectedTask(task)
    setIsDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedTask(null)
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

  const handleBulkDelete = () => {
    if (selectedTasks.size === 0) {
      toastError('No Selection', 'Please select tasks to delete')
      return
    }
    setBulkDeleteConfirmModal(true)
  }

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirmModal(false)
    setBulkActionLoading(true)

    try {
      const selectedTaskIds = Array.from(selectedTasks)

      // Delete all selected tasks using the DELETE endpoint
      const deletePromises = selectedTaskIds.map(async (id) => {
        const response = await fetch(`/api/task-instances/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to delete task ${id}`)
        }

        return response.json()
      })

      await Promise.all(deletePromises)

      // Remove from UI
      setTasks(tasks.filter(t => !selectedTasks.has(t.id)))
      setSelectedTasks(new Set())

      toastSuccess('Bulk Delete Complete', `Successfully deleted ${selectedTaskIds.length} task(s)`)

      // Refresh to ensure consistency
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error('Error in bulk delete:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toastError('Bulk Delete Failed', `Failed to delete tasks: ${errorMessage}`)
      // Refresh data to ensure consistency
      setRefreshKey((prev) => prev + 1)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Helper function to get the effective status for filtering and summary
  const getEffectiveTaskStatus = useCallback((task: ChecklistTask) => {
    // For admin viewing all responsibilities, we need to check if any position has completed the task
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []

      // Check if any position has a valid completion within carry-over period
      const hasValidCompletion = completions.some(completion => {
        if (!completion.is_completed) return false

        const mockTask = {
          ...task,
          is_completed_for_position: completion.is_completed,
          completed_at: completion.completed_at,
          position_completions: [completion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)
        return status === 'completed'
      })

      if (hasValidCompletion) {
        return 'completed'
      } else {
        // No valid completions - preserve original task dates for accurate status calculation
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          position_completions: [],
          detailed_status: undefined // Clear cached status to force recalculation
          // Keep original task.date and task.due_date to maintain proper status calculation context
        }
        return getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
      }
    }

    // For admin with specific responsibility filter
    if (isAdmin && selectedResponsibility !== 'all') {
      const completions = task.position_completions || []
      const relevantCompletion = completions.find(c =>
        formatResponsibility(c.position_name) === selectedResponsibility
      )

      if (relevantCompletion && relevantCompletion.is_completed) {
        const mockTask = {
          ...task,
          is_completed_for_position: relevantCompletion.is_completed,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)
        return status
      } else {
        // No completion for this position - preserve original task dates for accurate status calculation
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          position_completions: [],
          detailed_status: undefined // Clear cached status to force recalculation
          // Keep original task.date and task.due_date to maintain proper status calculation context
        }
        return getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
      }
    }

    // For regular users, use the standard status calculation
    return getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
  }, [isAdmin, selectedResponsibility, currentDate, isViewingToday])

  // Apply filters and sorting to tasks
  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      // Search filter - search by description only
      if (searchTerm && !task.master_task.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Responsibility filter (for admin mode)
      if (isAdmin && selectedResponsibility !== "all") {
        if (!task.master_task.responsibility.includes(selectedResponsibility)) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== "all" && !task.master_task.categories.includes(selectedCategory)) {
        return false
      }

      // Timing filter (uses due_time when timing is specific_time)
      if (selectedTiming !== "all") {
        const bucket = getTimingBucket(task)
        if (bucket !== selectedTiming) {
          return false
        }
      }

      // Frequency filter
      if (selectedFrequency !== "all") {
        if (!task.master_task.frequencies.includes(selectedFrequency)) {
          return false
        }
      }

      // Get effective status for this task considering the current filter context
      const effectiveStatus = getEffectiveTaskStatus(task)

      // Visibility check: hide tasks before appearance window
      if (effectiveStatus === 'not_visible') return false

      // Status filter - after visibility check
      if (selectedStatus !== "all") {
        // Normalize both the task status and the selected filter to canonical values
        const normalize = (s: string) => {
          if (s === 'done') return 'completed'
          if (s === 'pending' || s === 'not_due') return 'not_due_yet'
          if (s === 'completed') return 'completed'
          if (s === 'not_due_yet') return 'not_due_yet'
          if (s === 'due_today') return 'due_today'
          if (s === 'overdue') return 'overdue'
          if (s === 'missed') return 'missed'
          return s
        }

        const filterStatus = normalize(effectiveStatus)
        const wantedStatus = normalize(selectedStatus)

        return filterStatus === wantedStatus
      }
      return true
    })

    // Sort by custom_order first (as set by administrator in Master Tasks Management)
    // When custom_order >= 999999 (RESET_VALUE), use default 4-level hierarchical sorting
    return [...filtered].sort((a, b) => {
      const RESET_VALUE = 999999 // Same value used in master-tasks management

      // 1. Primary sort: custom_order from master_tasks table (only when < RESET_VALUE)
      const aCustomOrder = a.master_task.custom_order
      const bCustomOrder = b.master_task.custom_order

      // Check if custom_order is administrator-defined (< RESET_VALUE) vs default/reset (>= RESET_VALUE)
      const aHasCustomOrder = typeof aCustomOrder === 'number' && aCustomOrder < RESET_VALUE
      const bHasCustomOrder = typeof bCustomOrder === 'number' && bCustomOrder < RESET_VALUE

      // If both tasks have administrator-defined custom_order, sort by it
      if (aHasCustomOrder && bHasCustomOrder) {
        return aCustomOrder - bCustomOrder
      }

      // If only one has administrator-defined custom_order, prioritize it
      if (aHasCustomOrder && !bHasCustomOrder) {
        return -1
      }
      if (bHasCustomOrder && !aHasCustomOrder) {
        return 1
      }

      // Default 4-level hierarchical sorting for tasks without administrator-defined custom_order
      // Level 1: Due Time (Timing) - Earlier times appear first, default 17:00 if no due time
      const aMin = parseDueTimeToMinutes(a.master_task.due_time || '17:00')
      const bMin = parseDueTimeToMinutes(b.master_task.due_time || '17:00')
      if (aMin !== bMin) return aMin - bMin

      // Level 2: Frequency Priority - Based on the specified hierarchy
      const aRank = getFrequencyRankForDay(a.master_task.frequencies || [], currentDate)
      const bRank = getFrequencyRankForDay(b.master_task.frequencies || [], currentDate)
      if (aRank !== bRank) return aRank - bRank

      // Level 3: Position Order (Responsibility) - Uses first responsibility in array
      const aResponsibility = (a.master_task.responsibility || [])[0] || ''
      const bResponsibility = (b.master_task.responsibility || [])[0] || ''

      if (aResponsibility !== bResponsibility) {
        // Find the positions for these responsibilities
        const aPosition = positions.find(p => nameToResponsibilityValue(p.name) === aResponsibility)
        const bPosition = positions.find(p => nameToResponsibilityValue(p.name) === bResponsibility)

        const aOrder = aPosition?.display_order || 999
        const bOrder = bPosition?.display_order || 999

        if (aOrder !== bOrder) return aOrder - bOrder
      }

      // Level 4: Task Description - Alphabetical sorting (case-insensitive)
      const aDesc = (a.master_task.description || '').toLowerCase()
      const bDesc = (b.master_task.description || '').toLowerCase()
      if (aDesc !== bDesc) return aDesc.localeCompare(bDesc)

      return 0
    })
  }, [tasks, searchTerm, selectedResponsibility, selectedCategory, selectedStatus, selectedTiming, selectedFrequency, currentDate, isAdmin, positions, isViewingToday, getEffectiveTaskStatus])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedTasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, endIndex)

  // Calculate summary counts based on "All Responsibilities" view (ignoring current filters)
  useEffect(() => {
    const counts = {
      total: 0,
      done: 0,
      not_due_yet: 0,
      due_today: 0,
      overdue: 0,
      missed: 0,
    }

    // Filter tasks using "All Responsibilities" logic for summary counts
    const allResponsibilitiesTasks = tasks.filter((task) => {
      // Create a mock getEffectiveTaskStatus function that always uses "all" responsibilities
      const getEffectiveTaskStatusForAll = (task: ChecklistTask) => {
        if (isAdmin) {
          // For admin viewing all responsibilities, check if any position has completed the task
          const completions = task.position_completions || []

          // Check if any position has a valid completion within carry-over period
          const hasValidCompletion = completions.some(completion => {
            if (!completion.is_completed) return false

            const mockTask = {
              ...task,
              is_completed_for_position: completion.is_completed,
              completed_at: completion.completed_at,
              position_completions: [completion]
            }
            const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)
            return status === 'completed'
          })

          if (hasValidCompletion) {
            return 'completed'
          } else {
            // No valid completions - preserve original task dates for accurate status calculation
            const cleanTask = {
              ...task,
              is_completed_for_position: false,
              completed_at: undefined,
              position_completions: [],
              detailed_status: undefined // Clear cached status to force recalculation
              // Keep original task.date and task.due_date to maintain proper status calculation context
            }
            return getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
          }
        }

        // For regular users, use the standard status calculation
        return getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
      }

      const effectiveStatus = getEffectiveTaskStatusForAll(task)

      // Visibility check: hide tasks before appearance window
      if (effectiveStatus === 'not_visible') return false

      return true
    })

    counts.total = allResponsibilitiesTasks.length

    allResponsibilitiesTasks.forEach(task => {
      // Use the same logic as above for status calculation
      const getEffectiveTaskStatusForAll = (task: ChecklistTask) => {
        if (isAdmin) {
          const completions = task.position_completions || []

          const hasValidCompletion = completions.some(completion => {
            if (!completion.is_completed) return false

            const mockTask = {
              ...task,
              is_completed_for_position: completion.is_completed,
              completed_at: completion.completed_at,
              position_completions: [completion]
            }
            const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)
            return status === 'completed'
          })

          if (hasValidCompletion) {
            return 'completed'
          } else {
            // No valid completions - preserve original task dates for accurate status calculation
            const cleanTask = {
              ...task,
              is_completed_for_position: false,
              completed_at: undefined,
              position_completions: [],
              detailed_status: undefined // Clear cached status to force recalculation
              // Keep original task.date and task.due_date to maintain proper status calculation context
            }
            return getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
          }
        }

        return getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
      }

      let status = getEffectiveTaskStatusForAll(task)
      // Normalize for counts
      if (status === 'done') status = 'completed'
      if (status === 'pending' || status === 'not_due') status = 'not_due_yet'

      if (status === 'completed') counts.done += 1
      else if (status === 'not_due_yet') counts.not_due_yet += 1
      else if (status === 'due_today') counts.due_today += 1
      else if (status === 'overdue') counts.overdue += 1
      else if (status === 'missed') counts.missed += 1
    })

    setTaskCounts(counts)
  }, [tasks, currentDate, isAdmin, isViewingToday])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedResponsibility, selectedCategory, selectedStatus, selectedTiming, selectedFrequency, currentDate])

  // Get unique categories for filter (use full catalog when empty)
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>()
    tasks.forEach(task => {
      ; (task.master_task.categories || [])
        .filter(cat => !!cat && String(cat).trim() !== '')
        .forEach(cat => categories.add(cat))
    })
    const list = Array.from(categories)
    if (list.length === 0) {
      // Fallback to full category list from constants if no tasks or no categories loaded
      return [
        'stock-control',
        'compliance',
        'cleaning',
        'pharmacy-services',
        'fos-operations',
        'dispensary-operations',
        'general-pharmacy-operations',
        'business-management',
      ]
    }
    return list.sort()
  }, [tasks])

  // Show loading spinner for authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Loading user profile...
          </p>
        </div>
      </div>
    )
  }

  // Show full-page loading spinner for initial load
  if (loading && user && user.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Loading checklist...
          </p>
        </div>
      </div>
    )
  }

  // Only show access denied after auth is complete and no user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">Please log in to access your checklist.</p>
        </div>
      </div>
    )
  }

  // Helper function to calculate due date for a task
  const getTaskDueDate = (task: ChecklistTask): Date | null => {
    try {
      const instanceDate = parseAustralianDate(task.date)
      const frequencies = task.master_task?.frequencies || []

      // Get the primary frequency (first one in the array)
      const frequency = frequencies[0]
      if (!frequency) return null

      // Get the cutoffs for this frequency
      const cutoffs = getFrequencyCutoffs(task, frequency, instanceDate)
      return cutoffs.dueDate || null
    } catch (error) {
      console.warn('Error calculating due date:', error)
      return null
    }
  }

  // Helper function to format due date for display
  const formatDueDate = (dueDate: Date): string => {
    // Format as "Sat, 4 Oct"
    return formatInTimeZone(dueDate, AUSTRALIAN_TIMEZONE, 'EEE, d MMM')
  }

  // Helper function to get status badge by status string
  const getStatusBadgeByStatus = (status: string, task?: ChecklistTask) => {
    console.log('🏷️ getStatusBadgeByStatus called with status:', status)
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            ✓ Done
          </Badge>
        )
      case "not_due_yet":
      case "pending":
        // When viewing today and status is "not_due_yet", show the due date
        if (isViewingToday && task) {
          const dueDate = getTaskDueDate(task)
          if (dueDate) {
            // Check if the due date is today
            const today = getAustralianNow()
            const dueDateStr = formatInTimeZone(dueDate, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
            const todayStr = formatInTimeZone(today, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')

            // If due date is today, show "Due Today" badge instead
            if (dueDateStr === todayStr) {
              return (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                  ⏰ Due Today
                </Badge>
              )
            }

            // Otherwise, show the formatted due date
            const formattedDueDate = formatDueDate(dueDate)
            return (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                📅 Due – {formattedDueDate}
              </Badge>
            )
          }
        }
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            📅 Not Due Yet
          </Badge>
        )
      case "due_today":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            ⏰ Due Today
          </Badge>
        )
      case "overdue":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            ⚠️ Overdue
          </Badge>
        )
      case "missed":
        return (
          <Badge className="bg-gray-400 text-white border-gray-400">
            ❌ Missed
          </Badge>
        )
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            📅 Not Due Yet
          </Badge>
        )
    }
  }

  const getStatusBadge = (task: ChecklistTask) => {
    console.log('🎯 getStatusBadge called for task:', task.master_task?.title, {
      isAdmin,
      selectedResponsibility,
      taskId: task.id,
      positionCompletions: task.position_completions,
      currentDate,
      isViewingToday
    })

    // Special handling for PAST dates (before today) and "Every Day" tasks
    const today = getAustralianToday()
    const isViewingPastDate = currentDate < today
    if (isViewingPastDate && task.master_task?.frequencies?.includes('every_day')) {
      // For admin view with "All Responsibilities" filter
      if (isAdmin && selectedResponsibility === 'all') {
        const completions = task.position_completions || []
        const validCompletions = completions.filter(completion => {
          if (!completion.is_completed) return false
          const mockTask = {
            ...task,
            is_completed_for_position: completion.is_completed,
            completed_at: completion.completed_at,
            position_completions: [completion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, currentDate, false)
          return status === 'completed'
        })

        if (validCompletions.length > 0) {
          const maxVisible = 2
          const visibleCompletions = validCompletions.slice(0, maxVisible)
          const hiddenCount = validCompletions.length - maxVisible
          return (
            <div className="flex flex-wrap gap-1">
              {visibleCompletions.map((completion, index) => (
                <Badge key={index} className="bg-green-100 text-green-800 border-green-200 text-xs">
                  ✓ {formatResponsibility(completion.position_name)}
                </Badge>
              ))}
              {hiddenCount > 0 && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                  +{hiddenCount}
                </Badge>
              )}
            </div>
          )
        } else {
          return (
            <Badge className="bg-gray-400 text-white border-gray-400">
              ❌ Missed
            </Badge>
          )
        }
      }

      // For admin with specific responsibility filter or regular user
      const completions = task.position_completions || []
      let relevantCompletion = null
      if (isAdmin && selectedResponsibility !== 'all') {
        relevantCompletion = completions.find(c =>
          formatResponsibility(c.position_name) === selectedResponsibility
        )
      } else {
        relevantCompletion = completions.find(c => c.is_completed)
      }

      if (relevantCompletion && relevantCompletion.is_completed) {
        const mockTask = {
          ...task,
          is_completed_for_position: relevantCompletion.is_completed,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, currentDate, false)
        if (status === 'completed') {
          return (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              ✓ Done
            </Badge>
          )
        }
      }

      return (
        <Badge className="bg-gray-400 text-white border-gray-400">
          ❌ Missed
        </Badge>
      )
    }

    // Regular logic for current/future dates or non-"Every Day" tasks
    // For admin view with "All Responsibilities" filter
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []
      console.log('👥 Admin all view - completions:', completions)

      if (completions.length === 0) {
        // No completions - treat as new task instance, but preserve original task dates
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          position_completions: []
        }
        const status = getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
        console.log('❌ No completions, treating as new task, status:', status)
        console.log('🔍 Original task object completion data:', {
          is_completed_for_position: task.is_completed_for_position,
          completed_at: task.completed_at,
          status: task.status,
          detailed_status: task.detailed_status
        })
        return getStatusBadgeByStatus(status, task)
      }

      // Filter completions based on carry-over periods
      console.log('🔍 Filtering completions for admin view:', {
        taskTitle: task.master_task?.title,
        currentDate,
        isViewingToday,
        totalCompletions: completions.length
      })
      const validCompletions = completions.filter(completion => {
        // Create a mock task with this position's completion status and completion date
        const mockTask = {
          ...task,
          is_completed_for_position: completion.is_completed,
          completed_at: completion.completed_at,
          position_completions: [completion] // Include the completion data
        }
        const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)
        console.log(`🔍 Checking completion for ${completion.position_name}:`, {
          isCompleted: completion.is_completed,
          completedAt: completion.completed_at,
          currentDate,
          isViewingToday,
          status,
          isValid: status === 'completed'
        })
        return status === 'completed' // Only show if still within carry-over period
      })

      console.log('✅ Valid completions after filtering:', validCompletions)

      if (validCompletions.length === 0) {
        // No valid completions within carry-over period - treat as new task instance
        // Create a clean task object without completion data to get proper new task status
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          completed_by: undefined,
          position_completions: [],
          status: undefined, // Clear the status
          detailed_status: undefined // Clear the detailed status
        }
        const status = getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
        console.log('❌ No valid completions, treating as new task, status:', status)
        return getStatusBadgeByStatus(status, task)
      }

      // Show position completion badges with truncation (only valid ones)
      const maxVisible = 2
      const visibleCompletions = validCompletions.slice(0, maxVisible)
      const hiddenCount = validCompletions.length - maxVisible

      return (
        <div className="flex flex-wrap gap-1">
          {visibleCompletions.map((completion, index) => (
            <Badge key={index} className="bg-green-100 text-green-800 border-green-200 text-xs">
              ✓ {formatResponsibility(completion.position_name)}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
              +{hiddenCount}
            </Badge>
          )}
        </div>
      )
    }

    // For specific position view (admin with specific filter or regular user)
    // Check if this is an admin viewing a specific responsibility filter
    console.log('🔍 Admin specific responsibility check:', {
      isAdmin,
      selectedResponsibility,
      taskTitle: task.master_task?.title,
      currentDate,
      isViewingToday
    })

    if (isAdmin && selectedResponsibility !== 'all') {
      console.log('🔍 ENTERING admin specific responsibility logic:', {
        taskTitle: task.master_task?.title,
        isAdmin,
        selectedResponsibility,
        conditionMet: isAdmin && selectedResponsibility !== 'all'
      })

      // Admin viewing specific responsibility - need to check if task is completed for that position
      const completions = task.position_completions || []
      console.log('📋 Position completions:', completions.map(c => ({
        position: c.position_name,
        formatted: formatResponsibility(c.position_name),
        isCompleted: c.is_completed,
        completedAt: c.completed_at
      })))

      const relevantCompletion = completions.find(c =>
        formatResponsibility(c.position_name) === selectedResponsibility
      )

      console.log('🎯 Relevant completion found:', {
        selectedResponsibility,
        relevantCompletion: relevantCompletion ? {
          position: relevantCompletion.position_name,
          formatted: formatResponsibility(relevantCompletion.position_name),
          isCompleted: relevantCompletion.is_completed,
          completedAt: relevantCompletion.completed_at
        } : null
      })

      if (relevantCompletion && relevantCompletion.is_completed) {
        // Task is completed for this position - check if still within carry-over period
        const mockTask = {
          ...task,
          is_completed_for_position: true,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, currentDate, isViewingToday)

        console.log('🔍 Admin specific responsibility - completion check:', {
          taskTitle: task.master_task?.title,
          selectedResponsibility,
          relevantCompletion: relevantCompletion.position_name,
          completedAt: relevantCompletion.completed_at,
          currentDate,
          isViewingToday,
          status,
          isWithinCarryOver: status === 'completed'
        })

        if (status === 'completed') {
          // Still within carry-over period
          console.log('✅ Within carry-over period, showing Done badge')
          return getStatusBadgeByStatus(status, task)
        } else {
          // Beyond carry-over period - treat as new task instance, preserve original task dates
          console.log('❌ Beyond carry-over period, calculating new task status')
          const cleanTask = {
            ...task,
            is_completed_for_position: false,
            completed_at: undefined,
            completed_by: undefined,
            position_completions: [],
            status: undefined,
            detailed_status: undefined
          }
          const newTaskStatus = getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
          console.log('🔄 New task status:', newTaskStatus)
          return getStatusBadgeByStatus(newTaskStatus, cleanTask)
        }
      } else {
        // Task is not completed for this position - use normal status calculation, preserve original task dates
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          completed_by: undefined,
          position_completions: [],
          status: undefined,
          detailed_status: undefined
        }
        const status = getTaskStatusWithCarryOver(cleanTask, currentDate, isViewingToday)
        return getStatusBadgeByStatus(status, task)
      }
    }

    // For regular user (individual position view)
    console.log('👤 ENTERING regular user path:', {
      taskTitle: task.master_task?.title,
      isCompleted: task.is_completed_for_position,
      currentDate,
      isViewingToday,
      isAdmin,
      selectedResponsibility,
      reason: 'Neither admin all view nor admin specific view matched'
    })
    const status = getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
    console.log('👤 Regular user status:', status)
    return getStatusBadgeByStatus(status, task)
  }

  const allTasksCompleted = filteredAndSortedTasks.length > 0 && filteredAndSortedTasks.every((task) =>
    getTaskStatusWithCarryOver(task, currentDate, isViewingToday) === "completed"
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />
      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="pharmacy-gradient rounded-lg p-4 lg:p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                  {isAdmin ? "Daily Checklist Overview" : `${formatResponsibility(role)} Checklist`} —{" "}
                  {(() => {
                    const date = parseAustralianDate(currentDate)
                    return formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'EEEE, d MMMM yyyy')
                  })()}
                </h1>
                <p className="text-white/90 text-sm lg:text-base">
                  {(() => {
                    const statusCounts = {
                      not_due_yet: 0,
                      due_today: 0,
                      overdue: 0,
                      missed: 0,
                      completed: 0
                    }

                    filteredAndSortedTasks.forEach(task => {
                      let status = getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
                      // Normalize to match summary buckets
                      if (status === 'done') status = 'completed'
                      if (status === 'pending' || status === 'not_due') status = 'not_due_yet'
                      statusCounts[status as keyof typeof statusCounts]++
                    })

                    const parts = [`${filteredAndSortedTasks.length} tasks`]

                    if (statusCounts.completed > 0) parts.push(`${statusCounts.completed} completed`)
                    if (statusCounts.not_due_yet > 0) parts.push(`${statusCounts.not_due_yet} not due yet`)
                    if (statusCounts.due_today > 0) parts.push(`${statusCounts.due_today} due today`)
                    if (statusCounts.overdue > 0) parts.push(`${statusCounts.overdue} overdue`)
                    if (statusCounts.missed > 0) parts.push(`${statusCounts.missed} missed`)

                    return parts.join(' • ')
                  })()}
                  {totalPages > 1 && (
                    <span className="ml-2">
                      • Page {currentPage} of {totalPages}
                    </span>
                  )}
                </p>
              </div>
              {/* Checklist Management Button for Administrators */}
              {userRole === 'admin' && (
                <div className="flex sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button
                    asChild
                    variant="outline"
                    className="h-8 bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
                  >
                    <Link href="/admin/master-tasks">
                      <Settings className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-600">Master Tasks Management</span>
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="mb-6">
          <DateNavigator currentDate={currentDate} onDateChange={handleDateChange} isLoading={tasksLoading} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-4">
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

              {/* Responsibility Filter - Only for Admins */}
              {isAdmin && (
                <div className="flex justify-start w-full">
                  <Select value={selectedResponsibility} onValueChange={setSelectedResponsibility}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Responsibilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Responsibilities</SelectItem>
                      {responsibilitiesFromDb
                        .filter((responsibility) => !!responsibility && responsibility.trim() !== "")
                        .map(responsibility => (
                          <SelectItem key={responsibility} value={responsibility}>
                            {formatResponsibility(responsibility)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex justify-start w-full">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(category => {
                      const config = getCategoryConfig(category)
                      return (
                        <SelectItem key={category} value={category}>
                          {config.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency Filter */}
              <div className="flex justify-start w-full">
                <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Frequencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frequencies</SelectItem>
                    {TASK_FREQUENCIES.map(frequency => (
                      <SelectItem key={frequency.value} value={frequency.value}>{frequency.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="flex justify-start w-full">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="not_due_yet">Not Due Yet</SelectItem>
                    <SelectItem value="due_today">Due Today</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <Card className="card-surface mb-6 gap-4">
          <CardHeader>
            <div className="flex flex-col xl:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 gap-4">
                <CardTitle className="text-lg lg:text-xl mb-1">
                  Tasks ({filteredAndSortedTasks.length === 0 ? '0' : `${startIndex + 1}-${Math.min(endIndex, filteredAndSortedTasks.length)}`} of {filteredAndSortedTasks.length})
                  {totalPages > 1 && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - Page {currentPage} of {totalPages}
                    </span>
                  )}
                </CardTitle>
                {/* Per Page Selector */}
                <div className="flex items-center gap-2">
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

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Timing Toggle Buttons */}
                <div className="flex flex-col sm:flex-row space-x-1 bg-gray-100 px-2 py-1 rounded-lg gap-1">
                  <button
                    onClick={() => setSelectedTiming("all")}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedTiming === "all"
                      ? "bg-white text-[var(--color-primary)] shadow-sm"
                      : "bg-gray-50 border border-white text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    View All
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row space-x-1 bg-gray-100 px-2 py-1 rounded-lg gap-1">
                  <div className="flex space-x-1 gap-1">
                    <button
                      onClick={() => setSelectedTiming("opening")}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedTiming === "opening"
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "bg-gray-50 border border-white text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Opening
                    </button>
                    <button
                      onClick={() => setSelectedTiming("anytime_during_day")}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedTiming === "anytime_during_day"
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "bg-gray-50 border border-white text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Anytime During Day
                    </button>
                  </div>
                  <div className="flex space-x-1 gap-1">
                    <button
                      onClick={() => setSelectedTiming("before_order_cut_off")}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedTiming === "before_order_cut_off"
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "bg-gray-50 border border-white text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Before Order Cut Off
                    </button>
                    <button
                      onClick={() => setSelectedTiming("closing")}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedTiming === "closing"
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "bg-gray-50 border border-white text-gray-600 hover:text-gray-900"
                        }`}
                    >
                      Closing
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </CardHeader>
          <CardContent className="p-0">
            {filteredAndSortedTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[var(--color-text-secondary)] text-lg">No tasks found for the selected filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden xl:block overflow-x-auto px-4">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-[3%] py-4 bg-gray-50">New</TableHead>
                        <TableHead className={isAdmin ? "w-[53] py-4 bg-gray-50" : "w-[57] py-4 bg-gray-50"}>
                          Title & Description
                        </TableHead>
                        <TableHead className="text-center w-[4%] py-4 bg-gray-50">Policy</TableHead>
                        {isAdmin && (
                          <TableHead className="text-center w-[10%] py-4 bg-gray-50">
                            Responsibility
                          </TableHead>
                        )}
                        {!isAdmin && (
                          <TableHead className="text-center w-[4%] py-4 bg-gray-50">
                            Shared
                          </TableHead>
                        )}
                        <TableHead className="text-center w-[4%] py-4 bg-gray-50">
                          Category
                        </TableHead>
                        <TableHead className="text-center w-[9%] py-4 bg-gray-50">
                          Frequencies
                        </TableHead>
                        <TableHead className="text-center w-[5%] py-4 bg-gray-50">
                          Due Time
                        </TableHead>
                        <TableHead className="text-center w-[7%] py-4 bg-gray-50">Status</TableHead>
                        <TableHead className={isAdmin ? "text-center w-[5%] py-4 bg-gray-50" : "text-center w-[7%] py-4 bg-gray-50"}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTasks.map((task, index) => (
                        <TableRow
                          key={`${task.id}-${refreshKey}`}
                          className="hover:bg-gray-50"
                        >
                          {/* Publish column */}
                          <TableCell className="py-3 text-center">
                            <div className="flex justify-center">
                              {task.is_new ? (
                                <span title={getPublishTooltip(task)} className="relative inline-flex">
                                  <span className="absolute inline-flex h-5 w-5 rounded-full bg-blue-400 animate-ping"></span>
                                  <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">N</span>
                                </span>
                              ) : (
                                <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-300 text-[10px] font-bold border border-gray-100">
                                  {getTimingInitial(task)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-1">
                            <div className="max-w-full">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  {task.master_task.title && task.master_task.title.trim() && (
                                    <div className="font-medium truncate">{task.master_task.title}</div>
                                  )}
                                  {task.master_task.description && (
                                    <div className="text-sm text-gray-600 truncate">
                                      {task.master_task.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center py-1">
                            <div className="text-center max-w-full">
                              {taskLinkedDocuments[task.master_task_id]?.length > 0 && (() => {
                                const documents = taskLinkedDocuments[task.master_task_id]
                                const docCount = documents.length
                                const gridColsClass =
                                  docCount === 1 ? 'grid-cols-1' : docCount === 2 ? 'grid-cols-2' : 'grid-cols-3'
                                const buttonSizeClass =
                                  docCount === 1 ? 'h-8 w-8' : docCount === 2 ? 'h-7 w-6' : docCount === 3 ? 'h-7 w-5' : 'h-5 w-5'
                                const iconSizeClass =
                                  docCount === 1 ? 'h-6 w-6' : docCount === 2 ? 'h-4 w-4' : 'h-3 w-3'
                                return (
                                  <div className={`grid ${gridColsClass} gap-1 justify-items-center mx-auto w-fit`}>
                                    {documents.map((doc) => (
                                      <Button
                                        key={doc.id}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(doc.document_url, '_blank')}
                                        title={docCount === 1 ? 'View Instructions' : `View Instructions - ${doc.title}`}
                                        className={`hover:bg-cyan-200 text-cyan-600 ${buttonSizeClass} p-0`}
                                      >
                                        <BookOpen className={iconSizeClass} />
                                      </Button>
                                    ))}
                                  </div>
                                )
                              })()}
                            </div>
                          </TableCell>

                          {isAdmin && (
                            <TableCell className="py-1">
                              <div className="max-w-full overflow-hidden">
                                <div className="justify-center flex flex-wrap gap-1">
                                  {renderBadgesWithTruncation(task.master_task.responsibility, 2, 'responsibility')}
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {/* Shared Responsibilities cell */}
                          {!isAdmin && (
                            <TableCell className="py-3 text-center">
                              <div className="flex justify-center">
                                {renderSharedResponsibilities(task.master_task.responsibility, currentRoleKebab, 2)}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-center py-1">
                            <div className="justify-center max-w-full overflow-hidden">
                              <div className="justify-center flex flex-wrap gap-1">
                                {renderBadgesWithTruncation(task.master_task.categories, 2, 'category')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-1 text-center">
                            {renderFrequencyWithDetails(task)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center text-sm">
                              <Clock className="w-3 h-3 mr-1 text-gray-400" />
                              {task.master_task.due_time ? (
                                <span className="text-sm font-medium">
                                  {task.master_task.due_time.substring(0, 5)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">No due time</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="justify-center flex items-center gap-2">
                              {getStatusBadge(task)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="justify-center flex gap-2">
                              {/* Hide Done/Undo buttons for admins; show only details */}
                              {isAdmin ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewDetails(task)}
                                    title="View Details"
                                    className="h-8 w-8 p-0"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {(() => {
                                    // Special handling for PAST dates (before today) and "Every Day" tasks
                                    const today = getAustralianToday()
                                    const isViewingPastDate = currentDate < today
                                    if (isViewingPastDate && task.master_task?.frequencies?.includes('every_day')) {
                                      const completions = task.position_completions || []
                                      const relevantCompletion = completions.find(c => c.is_completed)
                                      let wasCompletedOnThisDate = false

                                      if (relevantCompletion && relevantCompletion.is_completed) {
                                        // For "Every Day" tasks on past dates, check if the completion happened on the viewing date
                                        // by comparing the completion date with the viewing date, ignoring carry-over periods
                                        const completedAt = relevantCompletion.completed_at
                                        if (completedAt) {
                                          // Convert UTC timestamp to Australian date
                                          const completedAtDate = new Date(completedAt)
                                          const completedAtAustralian = toAustralianTime(completedAtDate)
                                          const completionDateStr = formatAustralianDate(completedAtAustralian)

                                          // Check if the task was completed on the viewing date
                                          wasCompletedOnThisDate = completionDateStr === currentDate
                                        }
                                      }

                                      if (wasCompletedOnThisDate) {
                                        return (
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                              toastWarning("Historical Task", "This task was completed on this date. To complete today's task, please go to today's page.")
                                            }}
                                            className="font-medium bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                                            title="Task was completed on this date"
                                          >
                                            ✓ Done
                                          </Button>
                                        )
                                      } else {
                                        return (
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={true}
                                            className="font-medium bg-gray-400 text-gray-600 border-gray-400 cursor-not-allowed"
                                            title="Task was not completed on this date and is now locked"
                                          >
                                            Locked
                                          </Button>
                                        )
                                      }
                                    }

                                    // Regular logic for current dates or non-"Every Day" tasks
                                    // Check if task is still within carry-over period
                                    const dynamicStatus = getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
                                    if (dynamicStatus === 'completed') {
                                      // Show "✓ Done" button for completed tasks
                                      const isNotToday = !isViewingToday && !isAdmin
                                      const isDisabled = processingTasks.has(task.id)

                                      const getUndoButtonStyle = () => {
                                        if (isNotToday) {
                                          return "border-green-300 bg-green-100 text-green-700 opacity-60"
                                        }
                                        return "border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400"
                                      }

                                      return (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (isNotToday) {
                                              toastWarning("Cannot Undo Task", "You can only undo tasks for today. Please go to today's page.")
                                              return
                                            }
                                            handleTaskUndo(task.id)
                                          }}
                                          disabled={isDisabled}
                                          className={`font-medium ${getUndoButtonStyle()}`}
                                          title={isNotToday ? "You can only undo tasks for today. Please go to today's page." : "Undo task completion"}
                                        >
                                          {processingTasks.has(task.id) ? (
                                            <span className="flex items-center">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-1"></div>
                                              Processing...
                                            </span>
                                          ) : (
                                            <span>✓ Done</span>
                                          )}
                                        </Button>
                                      )
                                    } else {
                                      // Show "Done ?" or "Locked" button for incomplete tasks
                                      const isNewTaskInstance = task.is_completed_for_position && dynamicStatus !== 'completed'
                                      const isLocked = dynamicStatus === 'missed' || (task.can_complete === false && !isNewTaskInstance)
                                      const isNotToday = !isViewingToday && !isAdmin
                                      const isDisabled = processingTasks.has(task.id) || isLocked

                                      const getButtonTitle = () => {
                                        if (isLocked) return "Task is locked and cannot be completed"
                                        if (isNotToday) return "You can only complete tasks for today. Please go to today's page."
                                        return "Mark task as done"
                                      }

                                      const getButtonText = () => {
                                        if (isLocked) return "Locked"
                                        return "Done ?"
                                      }

                                      const getButtonStyle = () => {
                                        if (isLocked) {
                                          return "bg-gray-400 text-gray-600 border-gray-400 cursor-not-allowed"
                                        }
                                        if (isNotToday) {
                                          return "bg-green-200 text-green-700 border-green-300 hover:bg-green-300 opacity-60"
                                        }
                                        return "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                                      }

                                      return (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => {
                                            if (isNotToday) {
                                              toastWarning("Cannot Complete Task", "You can only complete tasks for today. Please go to today's page.")
                                              return
                                            }
                                            handleTaskComplete(task.id)
                                          }}
                                          disabled={isDisabled}
                                          className={`font-medium ${getButtonStyle()}`}
                                          title={getButtonTitle()}
                                        >
                                          {processingTasks.has(task.id) ? (
                                            <span className="flex items-center">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                              Processing...
                                            </span>
                                          ) : (
                                            <span>{getButtonText()}</span>
                                          )}
                                        </Button>
                                      )
                                    }
                                  })()}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDetails(task)}
                                    title="View Details"
                                    className="hover:bg-gray-100"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card Layout */}
                <div className="xl:hidden space-y-4 px-4">
                  {paginatedTasks.map((task) => (
                    <Card key={`${task.id}-${refreshKey}`} className="border border-gray-200">
                      <CardContent className="px-4">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            {/* Publish badge */}
                            <div className="flex justify-start">
                              {task.is_new ? (
                                <span title={getPublishTooltip(task)} className="relative inline-flex">
                                  <span className="absolute inline-flex h-5 w-5 rounded-full bg-blue-400 opacity-60 animate-ping"></span>
                                  <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-lg shadow-blue-300 ring-2 ring-blue-300">N</span>
                                </span>
                              ) : (
                                <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold border border-gray-300">
                                  {getTimingInitial(task)}
                                </span>
                              )}
                            </div>
                            <div className="flex justify-end gap-2">
                              {/* Admin sees only Details button */}
                              {isAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewDetails(task)}
                                  title="View Details"
                                  className="hover:bg-gray-100"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="ml-1">Details</span>
                                </Button>
                              ) : (
                                <>
                                  {/* Non-admin action buttons */}
                                  {(() => {
                                    // Special handling for "Every Day" tasks on past dates
                                    const frequencies = task.master_task?.frequencies || []
                                    const isEveryDayTask = frequencies.includes('every_day')
                                    const taskDate = parseAustralianDate(task.date)
                                    const currentDateObj = parseAustralianDate(currentDate)
                                    const isPastDate = currentDateObj < taskDate

                                    if (isEveryDayTask && isPastDate && task.is_completed_for_position) {
                                      // For "Every Day" tasks on past dates that are completed, show historical completion
                                      return (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={true}
                                          className="font-medium border-green-300 bg-green-100 text-green-700 opacity-60 cursor-not-allowed"
                                          title="Historical completion - cannot be undone"
                                        >
                                          <span>✓ Done</span>
                                        </Button>
                                      )
                                    }

                                    // Use the same logic as desktop layout
                                    const dynamicStatus = getTaskStatusWithCarryOver(task, currentDate, isViewingToday)
                                    if (dynamicStatus === 'completed') {
                                      // Show "✓ Done" button for completed tasks
                                      const isNotToday = !isViewingToday && !isAdmin
                                      const isDisabled = processingTasks.has(task.id)

                                      const getUndoButtonStyle = () => {
                                        if (isNotToday) {
                                          return "border-green-300 bg-green-100 text-green-700 opacity-60"
                                        }
                                        return "border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400"
                                      }

                                      return (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            if (isNotToday) {
                                              toastWarning("Cannot Undo Task", "You can only undo tasks for today. Please go to today's page.")
                                              return
                                            }
                                            handleTaskUndo(task.id)
                                          }}
                                          disabled={isDisabled}
                                          className={`font-medium ${getUndoButtonStyle()}`}
                                          title={isNotToday ? "You can only undo tasks for today. Please go to today's page." : "Undo task completion"}
                                        >
                                          {processingTasks.has(task.id) ? (
                                            <span className="flex items-center">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-1"></div>
                                              Processing...
                                            </span>
                                          ) : (
                                            <span>✓ Done</span>
                                          )}
                                        </Button>
                                      )
                                    } else {
                                      // Show "Done ?" or "Locked" button for incomplete tasks
                                      const isNewTaskInstance = task.is_completed_for_position && dynamicStatus !== 'completed'
                                      const isLocked = dynamicStatus === 'missed' || (task.can_complete === false && !isNewTaskInstance)
                                      const isNotToday = !isViewingToday && !isAdmin
                                      const isDisabled = processingTasks.has(task.id) || isLocked

                                      const getButtonTitle = () => {
                                        if (isLocked) return "Task is locked and cannot be completed"
                                        if (isNotToday) return "You can only complete tasks for today. Please go to today's page."
                                        return "Mark task as done"
                                      }

                                      const getButtonText = () => {
                                        if (isLocked) return "Locked"
                                        return "Done ?"
                                      }

                                      const getButtonStyle = () => {
                                        if (isLocked) {
                                          return "bg-gray-400 text-gray-600 border-gray-400 cursor-not-allowed"
                                        }
                                        if (isNotToday) {
                                          return "bg-green-200 text-green-700 border-green-300 hover:bg-green-300 opacity-60"
                                        }
                                        return "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                                      }

                                      return (
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => {
                                            if (isNotToday) {
                                              toastWarning("Cannot Complete Task", "You can only complete tasks for today. Please go to today's page.")
                                              return
                                            }
                                            handleTaskComplete(task.id)
                                          }}
                                          disabled={isDisabled}
                                          className={`font-medium ${getButtonStyle()}`}
                                          title={getButtonTitle()}
                                        >
                                          {processingTasks.has(task.id) ? (
                                            <span className="flex items-center">
                                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                              Processing...
                                            </span>
                                          ) : (
                                            <span>{getButtonText()}</span>
                                          )}
                                        </Button>
                                      )
                                    }
                                  })()}

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDetails(task)}
                                    title="View Details"
                                    className="hover:bg-gray-100"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span className="ml-1">Details</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Title and Description */}
                          <div>
                            {task.master_task.title && task.master_task.title.trim() && (
                              <h3 className="font-medium text-base truncate flex items-center gap-2">
                                <span className="truncate">{task.master_task.title}</span>
                              </h3>
                            )}
                            {task.master_task.description && (
                              <p className="text-sm text-gray-600 mt-1 truncate">{task.master_task.description}</p>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="space-y-3 text-sm grid sm:grid-cols-2 gap-2">
                            {isAdmin && (
                              <div>
                                <span className="text-gray-500">Responsibility:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {renderBadgesWithTruncation(task.master_task.responsibility, 3, 'responsibility')}
                                </div>
                              </div>
                            )}
                            {!isAdmin && (
                              <div>
                                <span className="text-gray-500">Shared Status:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {renderSharedResponsibilities(task.master_task.responsibility, currentRoleKebab, 3)}
                                </div>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Categories:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {renderBadgesWithTruncation(task.master_task.categories, 3, 'category')}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 text-sm grid sm:grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Frequencies:</span>
                              <div className="mt-1">
                                {renderFrequencyWithDetails(task)}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-gray-500">Due Time:</span>
                                <div className="mt-1 font-medium">
                                  {task.master_task.due_time ? (
                                    <span>{task.master_task.due_time}</span>
                                  ) : (
                                    <span className="text-gray-500">No due time</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500">Status:</span>
                                <div className="mt-1">
                                  {getStatusBadge(task)}
                                </div>
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Finish Button - Auto-logout when all tasks completed (only for non-admin users) */}
        {!isAdmin && allTasksCompleted && (
          <div className="text-center mb-6">
            <Card className="card-surface inline-block">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-green-600 mb-2">All Tasks Completed! 🎉</h3>
                <p className="text-[var(--color-text-secondary)] mb-4">
                  Great job! You've completed all your tasks for today.
                </p>
                <Button type="button" onClick={handleFinish} className="bg-green-600 hover:bg-green-700 text-white">
                  <LogOut className="h-4 w-4 mr-2" />
                  Finish & Logout
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Footer */}
        <div className="p-4 bg-white rounded-lg border border-[var(--color-border)]">
          <div className="sm:flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              Summary for {parseAustralianDate(currentDate).toLocaleDateString("en-AU")}
            </span>
            <div className="xs:col-flex items-center space-x-4">
              <span className="text-green-600">
                {taskCounts.done} Done
              </span>
              <span className="text-blue-600">
                {taskCounts.not_due_yet} Not Due Yet
              </span>
              <span className="text-orange-600">
                {taskCounts.due_today} Due Today
              </span>
              <span className="text-red-600">
                {taskCounts.overdue} Overdue
              </span>
              <span className="text-gray-700">
                {taskCounts.missed} Missed
              </span>
            </div>
          </div>
        </div>

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onTaskUpdate={() => setRefreshKey((prev) => prev + 1)}
            currentDate={currentDate}
            isAdmin={isAdmin}
          />
        )}
      </main>
    </div>
  )
}
