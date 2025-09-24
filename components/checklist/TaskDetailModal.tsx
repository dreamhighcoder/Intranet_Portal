'use client'

import { useState, useEffect } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Calendar, CheckCircle, XCircle, AlertTriangle, Tag, FileText, Settings, Hash } from 'lucide-react'
import { toDisplayFormat } from '@/lib/responsibility-mapper'
import { getAustralianNow, getAustralianToday, parseAustralianDate, createAustralianDateTime, toAustralianTime, formatAustralianDate, formatAustralianDateDisplay } from '@/lib/timezone-utils'
import { calculateTaskStatus, setHolidays } from '@/lib/task-status-calculator'
import { publicHolidaysApi } from '@/lib/api-client'

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

interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  currentDate: string // selected date (YYYY-MM-DD in AU format expected by page)
  onTaskUpdate: () => void
  isAdmin?: boolean
  selectedResponsibility?: string
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
  currentDate,
  onTaskUpdate,
  isAdmin = false,
  selectedResponsibility = 'all'
}: TaskDetailModalProps) {
  const [completionLog, setCompletionLog] = useState<CompletionLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [holidaysLoaded, setHolidaysLoaded] = useState(false)
  const [localHolidaySet, setLocalHolidaySet] = useState<Set<string>>(new Set())

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

  // Load holidays for the shared status calculator
  useEffect(() => {
    if (!isOpen || !task?.date) return
    const year = new Date(task.date).getFullYear()
    const years = [year - 1, year, year + 1]
    Promise.all(
      years.map(y =>
        publicHolidaysApi.getAll({ year: y.toString() })
          .then(holidays => holidays || [])
          .catch(() => [])
      )
    ).then(all => {
      const s = new Set<string>()
      all.flat().forEach((h: any) => {
        if (h?.date) s.add(String(h.date))
      })
      setHolidays(s) // Set holidays in the shared calculator
      setLocalHolidaySet(s) // Set holidays in the local state for modal calculations
      setHolidaysLoaded(true) // Mark holidays as loaded
    })
  }, [isOpen, task?.date])

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

  // Format responsibility function (matches main page exactly)
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

    // Assistant/Technician variants with /s suffix
    const assistantMatch = key.match(/^(pharmacy-assistant|dispensary-technician|daa-packer)-s$/)
    if (assistantMatch) {
      const base = assistantMatch[1].split('-').map(toTitle).join(' ')
      return `${base}/s`
    }

    // Default: split on hyphens, title-case each word
    return key.split('-').map(toTitle).join(' ')
  }

  // Helper function to get status badge by status string (matches main page exactly)
  const getStatusBadgeByStatus = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            ✓ Done
          </Badge>
        )
      case "not_due_yet":
      case "pending":
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
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Unknown
          </Badge>
        )
    }
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

  // Helper functions for the timing & cutoffs section
  
  const nowAU = getAustralianNow()

  const formatAUDate = (date: Date | string) => {
    if (!date) return '—'
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return formatAustralianDateDisplay(dateObj)
  }

  const formatYMD = (date: Date | string) => {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date) : date
    // Keep ISO-like YYYY-MM-DD for building Date strings used in comparisons
    return formatAustralianDate(dateObj)
  }

  // Generate frequency cutoffs from task data
  const generateFrequencyCutoffs = (task: any) => {
    if (!task?.master_task?.frequencies || !Array.isArray(task.master_task.frequencies)) {
      return []
    }

    const frequencies = task.master_task.frequencies
    const instanceDate = parseAustralianDate(task.date || currentDate)
    const cutoffs: any[] = []

    // Helper function to check if a date is a business day (not Sunday or holiday)
    const isBusinessDay = (d: Date): boolean => {
      const day = d.getDay()
      if (day === 0) return false // Sunday is not a business day
      const dateStr = formatAustralianDate(d)
      return !localHolidaySet.has(dateStr)
    }

    // Helper function to find the previous business day
    const findPreviousBusinessDay = (d: Date): Date => {
      const result = new Date(d)
      while (!isBusinessDay(result)) {
        result.setDate(result.getDate() - 1)
      }
      return result
    }

    // Helper function to find the next business day
    const findNextBusinessDay = (d: Date): Date => {
      const result = new Date(d)
      while (!isBusinessDay(result)) {
        result.setDate(result.getDate() + 1)
      }
      return result
    }

    // Helper function to add workdays (5 full workdays for start of month tasks)
    // This counts the start date as the first workday
    const addWorkdays = (startDate: Date, workdays: number): Date => {
      const result = new Date(startDate)
      let daysAdded = 0
      
      // If start date is a business day, count it as the first workday
      if (isBusinessDay(result)) {
        daysAdded = 1
      }
      
      // Add remaining workdays
      while (daysAdded < workdays) {
        result.setDate(result.getDate() + 1)
        if (isBusinessDay(result)) {
          daysAdded++
        }
      }
      
      // Result should already be a business day, but ensure it
      return findNextBusinessDay(result)
    }

    // Helper function to get week Saturday
    const getWeekSaturday = (d: Date): Date => {
      const result = new Date(d)
      const day = result.getDay()
      const diff = 6 - (day === 0 ? 7 : day)
      result.setDate(result.getDate() + diff)
      return result
    }

    // Helper function to get last Saturday of month
    const getLastSaturdayOfMonth = (d: Date): Date => {
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const day = lastDay.getDay() // 0=Sun..6=Sat
      // Calculate days to go back to reach Saturday
      const diff = day === 6 ? 0 : (day === 0 ? 1 : (day + 1))
      const lastSaturday = new Date(lastDay)
      lastSaturday.setDate(lastDay.getDate() - diff)
      return lastSaturday
    }

    // Helper function to get week Monday
    const getWeekMonday = (d: Date): Date => {
      const result = new Date(d)
      const day = result.getDay()
      const diff = day === 0 ? -6 : 1 - day
      result.setDate(result.getDate() + diff)
      return result
    }

    frequencies.forEach((frequency: string) => {
      try {
        // For multi-frequency tasks, calculate the appropriate date for each frequency
        let frequencyDate = instanceDate
        
        // Extract month from frequency if it's a month-specific frequency
        const monthMap: { [key: string]: number } = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        }
        
        // Check if this frequency is for a specific month
        // Handle multiple formats: "Start Of Month (Dec)", "Start Of Month Dec", "start_of_month_dec"
        let monthMatch = frequency.match(/\(([A-Za-z]{3})\)/) // Format: "Start Of Month (Dec)"
        if (!monthMatch) {
          monthMatch = frequency.match(/\b([A-Za-z]{3})$/) // Format: "Start Of Month Dec"
        }
        if (!monthMatch) {
          monthMatch = frequency.match(/_([a-z]{3})$/) // Format: "start_of_month_dec"
        }
        
        console.log(`Processing frequency: ${frequency}, monthMatch:`, monthMatch)
        if (monthMatch) {
          const targetMonth = monthMap[monthMatch[1].toLowerCase()]
          console.log(`Target month for ${frequency}: ${targetMonth} (${monthMatch[1].toLowerCase()})`)
          if (targetMonth !== undefined) {
            // Calculate the appropriate year for this frequency
            const currentYear = instanceDate.getFullYear()
            const currentMonth = instanceDate.getMonth()
            
            // If target month is before current month, use next year
            // If target month is current month or after, use current year
            const targetYear = targetMonth < currentMonth ? currentYear + 1 : currentYear
            
            // Create date for the 1st of the target month
            frequencyDate = new Date(targetYear, targetMonth, 1)
            console.log(`Calculated frequencyDate for ${frequency}: ${frequencyDate.toISOString().split('T')[0]}`)
          }
        }
        
        // Calculate appearance date (when task appears)
        let appearance = frequencyDate

        // For "Start of Month" frequencies, appearance date logic:
        // - For current month (when task is created): appearance = creation date
        // - For future months: appearance = 1st of month (adjusted for weekends/holidays)
        if ((frequency.startsWith('start_of_') && (frequency.includes('month') || frequency.includes('every_month'))) ||
            (frequency.toLowerCase().includes('start of month'))) {
          const today = new Date()
          const currentMonth = today.getMonth()
          const currentYear = today.getFullYear()
          const taskMonth = frequencyDate.getMonth()
          const taskYear = frequencyDate.getFullYear()
          
          // If this is the current month and year, use the creation date as appearance
          if (taskMonth === currentMonth && taskYear === currentYear) {
            appearance = instanceDate // Use creation date for current month
          } else {
            // For future months, use 1st of month (adjusted for weekends/holidays)
            const firstOfMonth = new Date(frequencyDate.getFullYear(), frequencyDate.getMonth(), 1)
            // If 1st is weekend, move to Monday
            if (firstOfMonth.getDay() === 6) { // Saturday
              appearance = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 3) // Monday
            } else if (firstOfMonth.getDay() === 0) { // Sunday
              appearance = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 2) // Monday
            } else {
              appearance = firstOfMonth
            }
            // Adjust for holidays
            appearance = findNextBusinessDay(appearance)
          }
        }

        // Helper function to get last Monday of month
        const getLastMondayOfMonth = (d: Date): Date => {
          const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          const day = lastDay.getDay() // 0=Sun..6=Sat
          // Calculate days to go back to reach Monday
          const diff = day === 1 ? 0 : (day === 0 ? 6 : (day - 1))
          const lastMonday = new Date(lastDay)
          lastMonday.setDate(lastDay.getDate() - diff)
          return lastMonday
        }

        // Helper function to count workdays between two dates (inclusive)
        const countWorkdays = (startDate: Date, endDate: Date): number => {
          let count = 0
          const current = new Date(startDate)
          // If start date is after end date, return 0
          if (current > endDate) return 0
          
          while (current <= endDate) {
            if (isBusinessDay(current)) {
              count++
            }
            current.setDate(current.getDate() + 1)
          }
          return count
        }

        // For "End of Month" frequencies, appearance date logic:
        // - For current month (when task is created): appearance = creation date
        // - For future months: appearance = last Monday of month (unless <5 workdays, then Monday prior)
        if ((frequency.includes('end_of_') && frequency.includes('month')) ||
            (frequency.toLowerCase().includes('end of month'))) {
          const today = new Date()
          const currentMonth = today.getMonth()
          const currentYear = today.getFullYear()
          const taskMonth = frequencyDate.getMonth()
          const taskYear = frequencyDate.getFullYear()
          
          // If this is the current month and year, use the creation date as appearance
          if (taskMonth === currentMonth && taskYear === currentYear) {
            appearance = instanceDate // Use creation date for current month
          } else {
            // For future months, calculate proper appearance date
            const lastMonday = getLastMondayOfMonth(frequencyDate)
            const lastSaturday = getLastSaturdayOfMonth(frequencyDate)
            const workdaysFromLastMonday = countWorkdays(lastMonday, lastSaturday)
            
            if (workdaysFromLastMonday >= 5) {
              // Use last Monday if there are at least 5 workdays
              appearance = findNextBusinessDay(lastMonday)
            } else {
              // Use Monday prior (7 days earlier)
              const mondayPrior = new Date(lastMonday)
              mondayPrior.setDate(lastMonday.getDate() - 7)
              appearance = findNextBusinessDay(mondayPrior)
            }
          }
        }

        // Calculate due date and time based on frequency logic
        let dueDate = frequencyDate
        let dueTime = task.master_task?.due_time || '17:00'

        // Calculate proper due date based on frequency
        if (frequency === 'once_weekly') {
          // Due date: Saturday of the same week (or nearest earlier business day if Saturday is holiday)
          const weekSat = getWeekSaturday(frequencyDate)
          dueDate = findPreviousBusinessDay(weekSat)
        } else if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(frequency)) {
          // Due date: That day's date (same as appearance date)
          dueDate = frequencyDate
        } else if (frequency === 'every_day') {
          // Due date: That day's date (same as appearance date)
          dueDate = frequencyDate
        } else if ((frequency.startsWith('start_of_') && (frequency.includes('month') || frequency.includes('every_month'))) ||
                   (frequency.toLowerCase().includes('start of month'))) {
            // Due date: 5 full workdays from 1st of month (cannot fall on PH)
            // Always calculate from 1st of month, not from appearance date
            const firstOfMonth = new Date(frequencyDate.getFullYear(), frequencyDate.getMonth(), 1)
            let monthStart = firstOfMonth
            // If 1st is weekend, move to Monday
            if (firstOfMonth.getDay() === 6) { // Saturday
              monthStart = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 3) // Monday
            } else if (firstOfMonth.getDay() === 0) { // Sunday
              monthStart = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 2) // Monday
            }
          // Adjust for holidays and calculate 5 workdays from there
          const adjustedMonthStart = findNextBusinessDay(monthStart)
          dueDate = addWorkdays(adjustedMonthStart, 5)
        } else if ((frequency.includes('end_of_') && frequency.includes('month')) ||
                   (frequency.toLowerCase().includes('end of month')) ||
                   frequency === 'once_monthly') {
          // Due date: Last Saturday of the month (or nearest earlier business day if Saturday is holiday)
          const lastSat = getLastSaturdayOfMonth(frequencyDate)
          dueDate = findPreviousBusinessDay(lastSat)
        } else {
          // For other frequencies, use the provided due_date if available
          if (task.due_date) {
            dueDate = parseAustralianDate(task.due_date)
          }
        }

        // Calculate lock date based on frequency
        let lockDate: Date | null = null

        // Use similar logic to the task status calculator
        if (['once_off', 'once_off_sticky'].includes(frequency)) {
          lockDate = null // Never locks
        } else if (frequency === 'every_day') {
          lockDate = frequencyDate
        } else if (['once_weekly', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(frequency)) {
          // Lock at end of week (Saturday or nearest earlier business day)
          const weekSat = getWeekSaturday(frequencyDate)
          lockDate = findPreviousBusinessDay(weekSat)
        } else if ((frequency.startsWith('start_of_') && (frequency.includes('month') || frequency.includes('every_month'))) ||
                   (frequency.includes('end_of_') && frequency.includes('month')) ||
                   (frequency.toLowerCase().includes('start of month')) ||
                   (frequency.toLowerCase().includes('end of month')) ||
                   frequency === 'once_monthly') {
          // Lock at end of month (last Saturday or nearest earlier business day)
          const lastSat = getLastSaturdayOfMonth(frequencyDate)
          lockDate = findPreviousBusinessDay(lastSat)
        } else {
          // Unknown frequency, use conservative approach
          lockDate = frequencyDate
        }

        // Calculate carry window based on frequency logic
        let carryStart: Date | null = null
        let carryEnd: Date | null = lockDate

        // Calculate carry window start based on frequency
        if (frequency === 'once_weekly') {
          // Carry window: From Monday (first working day of the week) to Saturday (lock date)
          const weekMon = getWeekMonday(frequencyDate)
          carryStart = findNextBusinessDay(weekMon)
        } else if ((frequency.startsWith('start_of_') && (frequency.includes('month') || frequency.includes('every_month'))) ||
                   (frequency.toLowerCase().includes('start of month')) ||
                   frequency === 'once_monthly') {
          // Carry window: Always from 1st of month (first working day) to last Saturday (lock date)
          // Regardless of when the task was created
          const firstOfMonthCarry = new Date(frequencyDate.getFullYear(), frequencyDate.getMonth(), 1)
          let monthStartCarry = firstOfMonthCarry
          // If 1st is weekend, move to Monday
          if (firstOfMonthCarry.getDay() === 6) { // Saturday
            monthStartCarry = new Date(firstOfMonthCarry.getFullYear(), firstOfMonthCarry.getMonth(), 3) // Monday
          } else if (firstOfMonthCarry.getDay() === 0) { // Sunday
            monthStartCarry = new Date(firstOfMonthCarry.getFullYear(), firstOfMonthCarry.getMonth(), 2) // Monday
          }
          // Adjust for holidays
          carryStart = findNextBusinessDay(monthStartCarry)
        } else if ((frequency.includes('end_of_') && frequency.includes('month')) ||
                   (frequency.toLowerCase().includes('end of month'))) {
          // Carry window: ALWAYS from calculated Monday (last Monday or Monday prior)
          // This is independent of appearance date logic - carry window follows business rule
          const lastMonday = getLastMondayOfMonth(frequencyDate)
          const lastSaturday = getLastSaturdayOfMonth(frequencyDate)
          const workdaysFromLastMonday = countWorkdays(lastMonday, lastSaturday)
          
          if (workdaysFromLastMonday >= 5) {
            // Use last Monday if there are at least 5 workdays
            carryStart = findNextBusinessDay(lastMonday)
          } else {
            // Use Monday prior (7 days earlier)
            const mondayPrior = new Date(lastMonday)
            mondayPrior.setDate(lastMonday.getDate() - 7)
            carryStart = findNextBusinessDay(mondayPrior)
          }
        } else {
          // For other frequencies, use the appearance date (instance date)
          carryStart = appearance
        }

        // Ensure carryStart is never null
        if (!carryStart) {
          carryStart = appearance
        }

        console.log(`Final calculated values for ${frequency}:`, {
          frequency,
          appearance: appearance.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          lockDate: lockDate?.toISOString().split('T')[0],
          carryStart: carryStart?.toISOString().split('T')[0],
          carryEnd: carryEnd?.toISOString().split('T')[0]
        })

        cutoffs.push({
          frequency,
          appearance,
          dueDate,
          dueTime: dueTime.substring(0, 5), // Ensure HH:mm format
          lockDate,
          carryStart,
          carryEnd
        })
      } catch (error) {
        console.error('Error calculating cutoffs for frequency:', frequency, error)
      }
    })

    return cutoffs
  }

  const frequencyCutoffs = generateFrequencyCutoffs(task)

  // Apply carry-over logic to preserve position completion badges during carry-over period
  // This mirrors the exact logic from the main checklist page
  const getTaskStatusWithCarryOver = (task: any, currentDate: string, isViewingToday: boolean = false): string => {
    // If task is not completed for this position, use the calculated status from API
    if (!task.is_completed_for_position) {
      return task.detailed_status || 'not_due_yet'
    }

    // Task is completed for this position - check if we're still within carry-over period
    // We need to determine the completion date for carry-over calculations
    let completionDateStr = task.date // Default to task date

    // Use position completion date if available
    if (task.position_completions && task.position_completions.length > 0) {
      const completedAt = task.position_completions[0].completed_at
      if (completedAt) {
        // Convert UTC timestamp to Australian date
        const completedAtDate = new Date(completedAt)
        const completedAtAustralian = toAustralianTime(completedAtDate)
        completionDateStr = formatAustralianDate(completedAtAustralian)
      }
    } else if (task.completed_at) {
      // Use task completion date
      const completedAtAustralian = toAustralianTime(new Date(task.completed_at))
      completionDateStr = formatAustralianDate(completedAtAustralian)
    }

    // Use the completion date as the task date for carry-over calculations
    const taskInput = {
      date: completionDateStr, // Use completion date instead of original task date
      due_date: task.due_date || undefined,
      master_task: {
        due_time: task.master_task?.due_time || undefined,
        created_at: task.master_task?.created_at || undefined,
        publish_delay: task.master_task?.publish_delay || undefined,
        start_date: task.master_task?.start_date || undefined,
        end_date: task.master_task?.end_date || undefined,
        frequencies: task.master_task?.frequencies || undefined,
      },
      detailed_status: task.detailed_status || undefined,
      is_completed_for_position: task.is_completed_for_position,
      status: task.status || undefined,
      lock_date: task.lock_date || undefined,
      lock_time: task.lock_time || undefined,
    }

    const calculatedStatus = calculateTaskStatus(taskInput, currentDate)

    // Debug logging for daily tasks
    if (task.master_task?.frequencies?.includes('every_day')) {
      console.log(`🔍 Daily task carry-over check (Modal):`, {
        taskTitle: task.master_task?.title,
        currentDate,
        originalTaskDate: task.date,
        completionDate: completionDateStr,
        isCompleted: task.is_completed_for_position,
        frequencies: task.master_task?.frequencies,
        calculatedStatus,
        willShowCompleted: calculatedStatus === 'completed'
      })
    }

    // If the shared calculator says the task is still 'completed', 
    // we're within the carry-over period and should show the completion badge
    if (calculatedStatus === 'completed') {
      return 'completed'
    }

    // Carry-over period has ended - calculate status for new task instance
    // Calculate what the status would be if this was a new task for the current viewing date
    const newTaskInput = {
      date: currentDate, // Use current viewing date as the new task date
      due_date: task.due_date || undefined,
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
    console.log(`🔍 Task post-carry-over status (Modal):`, {
      taskTitle: task.master_task?.title,
      currentDate,
      originalTaskDate: task.date,
      completionDate: completionDateStr,
      carryOverEnded: true,
      isViewingToday,
      frequencies: task.master_task?.frequencies,
      calculatedStatus: newTaskStatus,
      finalStatus
    })

    return finalStatus
  }

  // Calculate status using the exact same complex logic as the main page
  const selectedDate = currentDate || getAustralianToday()
  const todayStr = getAustralianToday()
  const isViewingToday = selectedDate === todayStr

  // Complex status calculation that matches main page getStatusBadge function exactly
  const getComplexTaskStatus = (task: any) => {
    // Special handling for PAST dates (before today) and "Every Day" tasks
    const today = getAustralianToday()
    const isViewingPastDate = selectedDate < today
    if (isViewingPastDate && task.master_task?.frequencies?.includes('every_day')) {
      // For admin view with "All Responsibilities" filter
      if (isAdmin && selectedResponsibility === 'all') {
        const completions = task.position_completions || []
        const validCompletions = completions.filter((completion: any) => {
          if (!completion.is_completed) return false
          const mockTask = {
            ...task,
            is_completed_for_position: completion.is_completed,
            completed_at: completion.completed_at,
            position_completions: [completion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
          return status === 'completed'
        })

        if (validCompletions.length > 0) {
          return 'completed' // Will show multiple completion badges in the UI
        } else {
          return 'missed'
        }
      }

      // For admin with specific responsibility filter or regular user
      const completions = task.position_completions || []
      let relevantCompletion = null
      if (isAdmin && selectedResponsibility !== 'all') {
        relevantCompletion = completions.find((c: any) =>
          formatResponsibility(c.position_name) === selectedResponsibility
        )
      } else {
        relevantCompletion = completions.find((c: any) => c.is_completed)
      }

      if (relevantCompletion && relevantCompletion.is_completed) {
        const mockTask = {
          ...task,
          is_completed_for_position: relevantCompletion.is_completed,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
        if (status === 'completed') {
          return 'completed'
        }
      }

      return 'missed'
    }

    // Regular logic for current/future dates or non-"Every Day" tasks
    // For admin view with "All Responsibilities" filter
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []

      if (completions.length === 0) {
        // No completions - treat as new task instance
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          position_completions: []
        }
        return getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
      }

      // Filter completions based on carry-over periods
      const validCompletions = completions.filter((completion: any) => {
        // Create a mock task with this position's completion status and completion date
        const mockTask = {
          ...task,
          is_completed_for_position: completion.is_completed,
          completed_at: completion.completed_at,
          position_completions: [completion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, isViewingToday)
        return status === 'completed' // Only show if still within carry-over period
      })

      if (validCompletions.length === 0) {
        // No valid completions within carry-over period - treat as new task instance
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          completed_by: undefined,
          position_completions: [],
          status: undefined,
          detailed_status: undefined,
          date: selectedDate
        }
        return getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
      }

      // Has valid completions - return completed status
      return 'completed'
    }

    // For specific position view (admin with specific filter or regular user)
    if (isAdmin && selectedResponsibility !== 'all') {
      // Admin viewing specific responsibility - need to check if task is completed for that position
      const completions = task.position_completions || []
      const relevantCompletion = completions.find((c: any) =>
        formatResponsibility(c.position_name) === selectedResponsibility
      )

      if (relevantCompletion && relevantCompletion.is_completed) {
        // Task is completed for this position - check if still within carry-over period
        const mockTask = {
          ...task,
          is_completed_for_position: true,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, isViewingToday)

        if (status === 'completed') {
          // Still within carry-over period
          return status
        } else {
          // Beyond carry-over period - treat as new task instance
          const cleanTask = {
            ...task,
            is_completed_for_position: false,
            completed_at: undefined,
            completed_by: undefined,
            position_completions: [],
            status: undefined,
            detailed_status: undefined,
            date: selectedDate
          }
          return getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
        }
      } else {
        // Task is not completed for this position - use normal status calculation
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          completed_by: undefined,
          position_completions: [],
          status: undefined,
          detailed_status: undefined,
          date: selectedDate
        }
        return getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
      }
    }

    // For regular user (individual position view)
    return getTaskStatusWithCarryOver(task, selectedDate, isViewingToday)
  }

  const status = getComplexTaskStatus(task)

  // Get completion data for display (matches the complex logic)
  const getCompletionData = () => {
    // Special handling for PAST dates (before today) and "Every Day" tasks
    const today = getAustralianToday()
    const isViewingPastDate = selectedDate < today
    if (isViewingPastDate && task.master_task?.frequencies?.includes('every_day')) {
      if (isAdmin && selectedResponsibility === 'all') {
        const completions = task.position_completions || []
        return completions.filter((completion: any) => {
          if (!completion.is_completed) return false
          const mockTask = {
            ...task,
            is_completed_for_position: completion.is_completed,
            completed_at: completion.completed_at,
            position_completions: [completion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
          return status === 'completed'
        })
      } else if (isAdmin && selectedResponsibility !== 'all') {
        const completions = task.position_completions || []
        const relevantCompletion = completions.find((c: any) =>
          formatResponsibility(c.position_name) === selectedResponsibility
        )
        if (relevantCompletion && relevantCompletion.is_completed) {
          const mockTask = {
            ...task,
            is_completed_for_position: relevantCompletion.is_completed,
            completed_at: relevantCompletion.completed_at,
            position_completions: [relevantCompletion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
          return status === 'completed' ? [relevantCompletion] : []
        }
        return []
      } else {
        // Regular user
        const completions = task.position_completions || []
        const relevantCompletion = completions.find((c: any) => c.is_completed)
        if (relevantCompletion && relevantCompletion.is_completed) {
          const mockTask = {
            ...task,
            is_completed_for_position: relevantCompletion.is_completed,
            completed_at: relevantCompletion.completed_at,
            position_completions: [relevantCompletion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
          return status === 'completed' ? [relevantCompletion] : []
        }
        return []
      }
    }

    // Regular logic for current/future dates or non-"Every Day" tasks
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []
      // Filter completions based on carry-over periods (same as status calculation)
      return completions.filter((completion: any) => {
        const mockTask = {
          ...task,
          is_completed_for_position: completion.is_completed,
          completed_at: completion.completed_at,
          position_completions: [completion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, isViewingToday)
        return status === 'completed'
      })
    } else if (isAdmin && selectedResponsibility !== 'all') {
      const completions = task.position_completions || []
      const relevantCompletion = completions.find((c: any) =>
        formatResponsibility(c.position_name) === selectedResponsibility
      )
      if (relevantCompletion && relevantCompletion.is_completed) {
        const mockTask = {
          ...task,
          is_completed_for_position: true,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, isViewingToday)
        return status === 'completed' ? [relevantCompletion] : []
      }
      return []
    } else {
      // Regular user
      const taskStatus = getTaskStatusWithCarryOver(task, selectedDate, isViewingToday)
      return taskStatus === 'completed' && task.is_completed_for_position ? [task] : []
    }
  }

  const completionData = getCompletionData()

  // Get the appropriate badge for the top of the modal (matches main page exactly)
  const getTopBadge = () => {
    // Special handling for PAST dates (before today) and "Every Day" tasks
    const today = getAustralianToday()
    const isViewingPastDate = selectedDate < today
    if (isViewingPastDate && task.master_task?.frequencies?.includes('every_day')) {
      // For admin view with "All Responsibilities" filter
      if (isAdmin && selectedResponsibility === 'all') {
        const completions = task.position_completions || []
        const validCompletions = completions.filter((completion: any) => {
          if (!completion.is_completed) return false
          const mockTask = {
            ...task,
            is_completed_for_position: completion.is_completed,
            completed_at: completion.completed_at,
            position_completions: [completion]
          }
          const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
          return status === 'completed'
        })

        if (validCompletions.length > 0) {
          // Show position completion badges
          const maxVisible = 2
          const visibleCompletions = validCompletions.slice(0, maxVisible)
          const hiddenCount = validCompletions.length - maxVisible

          return (
            <div className="flex flex-wrap gap-1">
              {visibleCompletions.map((completion: any, index: number) => (
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
          return getStatusBadgeByStatus('missed')
        }
      }

      // For admin with specific responsibility filter or regular user
      const completions = task.position_completions || []
      let relevantCompletion = null
      if (isAdmin && selectedResponsibility !== 'all') {
        relevantCompletion = completions.find((c: any) =>
          formatResponsibility(c.position_name) === selectedResponsibility
        )
      } else {
        relevantCompletion = completions.find((c: any) => c.is_completed)
      }

      if (relevantCompletion && relevantCompletion.is_completed) {
        const mockTask = {
          ...task,
          is_completed_for_position: relevantCompletion.is_completed,
          completed_at: relevantCompletion.completed_at,
          position_completions: [relevantCompletion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, false)
        if (status === 'completed') {
          return getStatusBadgeByStatus('completed')
        }
      }

      return getStatusBadgeByStatus('missed')
    }

    // Regular logic for current/future dates or non-"Every Day" tasks
    // For admin view with "All Responsibilities" filter
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []

      if (completions.length === 0) {
        // No completions - treat as new task instance
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          position_completions: []
        }
        const status = getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
        return getStatusBadgeByStatus(status)
      }

      // Filter completions based on carry-over periods
      const validCompletions = completions.filter((completion: any) => {
        const mockTask = {
          ...task,
          is_completed_for_position: completion.is_completed,
          completed_at: completion.completed_at,
          position_completions: [completion]
        }
        const status = getTaskStatusWithCarryOver(mockTask, selectedDate, isViewingToday)
        return status === 'completed'
      })

      if (validCompletions.length === 0) {
        // No valid completions within carry-over period - treat as new task instance
        const cleanTask = {
          ...task,
          is_completed_for_position: false,
          completed_at: undefined,
          completed_by: undefined,
          position_completions: [],
          status: undefined,
          detailed_status: undefined,
          date: selectedDate
        }
        const status = getTaskStatusWithCarryOver(cleanTask, selectedDate, isViewingToday)
        return getStatusBadgeByStatus(status)
      }

      // Show position completion badges (admin "all" view shows position names, not "Done")
      const maxVisible = 2
      const visibleCompletions = validCompletions.slice(0, maxVisible)
      const hiddenCount = validCompletions.length - maxVisible

      return (
        <div className="flex flex-wrap gap-1">
          {visibleCompletions.map((completion: any, index: number) => (
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

    // For all other cases (admin with specific responsibility or regular user), use standard badge
    return getStatusBadgeByStatus(status)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="task-details-modal overflow-hidden flex flex-col" style={{ maxWidth: "80rem", width: "80vw", maxHeight: "90vh", height: "90vh" }}>
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Task Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4">
          <div className="space-y-6">
            {/* Task Information */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl text-gray-900 flex items-start justify-between">
                  <span className="flex-1">{task.master_task?.title}</span>
                  <div className="ml-2">
                    {getTopBadge()}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                {task.master_task?.description && (
                  <div className="bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Description</span>
                    </div>
                    <p className="text-blue-700 leading-relaxed">{task.master_task.description}</p>
                  </div>
                )}

                {/* Basic Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-purple-50 px-4 py-3 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800">Task Date</span>
                    </div>
                    <p className="text-purple-700 text-sm">
                      {(() => {
                        const date = new Date(task.date)
                        const year = date.getFullYear()
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const day = String(date.getDate()).padStart(2, '0')
                        return `${day}-${month}-${year}`
                      })()}
                    </p>
                  </div>
                  <div className="bg-purple-50 px-4 py-3 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800">Timing</span>
                    </div>
                    <p className="text-purple-700 text-sm">
                      {task.master_task?.timing?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Not specified'}
                    </p>
                  </div>
                  <div className="bg-purple-50 px-4 py-3 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800">Due Time</span>
                    </div>
                    <p className="text-purple-700 text-sm">
                      {task.master_task?.due_time || 'No specific time'}
                    </p>
                  </div>
                </div>

                {/* Responsibilities, Categories and Frequencies */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                  {/* Responsibilities */}
                  {task.master_task?.responsibility && task.master_task.responsibility.length > 0 && (
                    <div className="bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Responsibilities</span>
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
                    <div className="bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <Tag className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Categories</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.master_task.categories.map((category: string, index: number) => {
                          const config = getCategoryConfig(category)
                          return (
                            <Badge key={index} className={`text-xs ${config.color}`}>
                              {config.label}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Frequencies */}
                  {task.master_task?.frequencies && Object.keys(task.master_task.frequencies).length > 0 && (
                    <div className="bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <Settings className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">Frequencies</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.master_task.frequencies.map((frequencies: string, index: number) => (
                          <Badge key={index} variant="outline" className="bg-white border-green-200 text-green-800">
                            {toDisplayFormat(frequencies)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Task Payload */}
                {task.payload && Object.keys(task.payload).length > 0 && (
                  <div className="bg-rose-50 px-4 py-3 rounded-lg border border-rose-200">
                    <div className="flex items-center space-x-2 mb-2">
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
                  <div className="bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
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
            <Card className="border-l-4 border-l-indigo-500 gap-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <span>Completion Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Current Status Summary */}
                <div className={`px-4 py-3 rounded-lg border mb-6 ${status === 'completed' ? 'bg-green-50 border-green-200' :
                  (status === 'not_due_yet' || status === 'pending') ? 'bg-blue-50 border-blue-200' :
                    status === 'overdue' ? 'bg-red-50 border-red-200' :
                      status === 'missed' ? 'bg-gray-100 border' :
                        'bg-orange-50 border-orange-200'
                  }`}>
                  <div className="flex items-center space-x-2 mb-3">
                    {status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : status === 'overdue' ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : status === 'missed' ? (
                      <XCircle className="h-5 w-5 text-gray-700" />
                    ) : (status === 'not_due_yet' || status === 'pending') ? (
                      <Clock className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-orange-600" />
                    )}
                    <span className={`font-semibold text-lg ${status === 'completed' ? 'text-green-800' :
                      (status === 'not_due_yet' || status === 'pending') ? 'text-blue-800' :
                        status === 'overdue' ? 'text-red-800' :
                          status === 'missed' ? 'text-gray-800' :
                            'text-orange-800'
                      }`}>
                      Current Status: {
                        status === 'completed' ? 'Done' :
                          status === 'not_due_yet' || status === 'pending' ? 'Not Due Yet' :
                            status === 'overdue' ? 'Overdue' :
                              status === 'missed' ? 'Missed' :
                                'Due Today'
                      }
                    </span>
                  </div>

                  {status === 'completed' && completionData.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {completionData.map((completion: any, index: number) => (
                        <div key={index} className="bg-white px-4 py-3 rounded-lg border border-green-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                  ✓ {completion.position_name ? formatResponsibility(completion.position_name) : 'Current Position'}
                                </Badge>
                              </div>
                              <div className="text-sm text-green-700 space-y-1">
                                <p>
                                  <span className="font-medium">Completed at:</span>{' '}
                                  {completion.completed_at ? formatInTimeZone(new Date(completion.completed_at), 'Australia/Hobart', 'dd-MM-yyyy HH:mm:ss') : (task.completed_at ? formatInTimeZone(new Date(task.completed_at), 'Australia/Hobart', 'dd-MM-yyyy HH:mm:ss') : 'Unknown')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {status !== 'completed' && (
                    <p className={`text-sm ${status === 'overdue' ? 'text-red-700' : status === 'missed' ? 'text-gray-700' : status === 'not_due_yet' || status === 'pending' ? 'text-blue-700' : 'text-orange-700'}`}>
                      {status === 'overdue' && 'This task is overdue.'}
                      {status === 'missed' && 'This task was missed and is locked.'}
                      {(status === 'not_due_yet' || status === 'pending') && 'This task is not due yet.'}
                      {status === 'due_today' && 'This task is due today.'}
                    </p>
                  )}
                </div>

                {/* Timing & Cutoffs (per frequency) */}
                {Array.isArray(frequencyCutoffs) && frequencyCutoffs.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      <span>Timing & Cutoffs (Australia/Hobart)</span>
                    </CardTitle>

                    {!holidaysLoaded && (
                      <div className="text-sm text-gray-600">Loading holiday data for precise cutoffs...</div>
                    )}

                    {frequencyCutoffs.map((fc: any, idx: number) => (
                      <div key={idx} className="bg-pink-50 px-4 py-3 rounded-lg border border-pink-200">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                          Frequency: {fc.frequency?.replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase())}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm gap-12">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Appearance:</span>
                              <span className="text-gray-900 font-medium">{formatAUDate(fc.appearance)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Carry window:</span>
                              <span className="text-gray-900 font-medium">
                                {formatAUDate(fc.carryStart)}
                                {' '} — {' '}
                                {fc.carryEnd ? formatAUDate(fc.carryEnd) : (fc.carryEnd === null ? 'Indefinite' : '—')}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Due Date & TIme:</span>
                              <div>
                                <span className="text-gray-900 font-medium">{formatAUDate(fc.dueDate)}, </span>
                                <span className="text-gray-900 font-medium">{fc.dueTime ? fc.dueTime : '—'}</span>
                                {fc.dueDate && fc.dueTime && (
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${nowAU >= new Date(`${formatYMD(fc.dueDate)}T${fc.dueTime}:00`)
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                    {nowAU >= new Date(`${formatYMD(fc.dueDate)}T${fc.dueTime}:00`) ? 'Passed' : 'Upcoming'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Lock cutoff:</span>
                              <span className="text-gray-900 font-medium">
                                {fc.lockDate ? `${formatAUDate(fc.lockDate)}, 23:59` : 'Never locks'}
                                {fc.lockDate && (
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${nowAU > new Date(`${formatYMD(fc.lockDate)}T23:59:00`)
                                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                                    : 'bg-green-50 text-green-700 border-green-200'
                                    }`}>
                                    {nowAU > new Date(`${formatYMD(fc.lockDate)}T23:59:00`) ? 'Passed' : 'Upcoming'}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}