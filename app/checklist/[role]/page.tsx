'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Check, X, Eye, LogOut, Settings, ChevronRight, Search, Clock, Users } from 'lucide-react'
import Link from 'next/link'
import { toastError, toastSuccess } from '@/hooks/use-toast'
import { toKebabCase } from '@/lib/responsibility-mapper'
import { authenticatedGet, authenticatedPost, positionsApi } from '@/lib/api-client'
import TaskDetailModal from '@/components/checklist/TaskDetailModal'
import { getAustralianNow, getAustralianToday, formatAustralianDate, parseAustralianDate, createAustralianDateTime, australianNowUtcISOString, toAustralianTime } from '@/lib/timezone-utils'

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
  master_task: {
    id: string
    title: string
    description?: string
    timing: string
    due_time?: string
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

// Calculate dynamic task status using frequency rules + completion + selected AU date
// Implements the 36-frequency specification (PH/weekend aware) for display and visibility
const calculateDynamicTaskStatus = (task: ChecklistTask, currentDate: string): string => {
  try {
    // Completed takes precedence
    if (task.is_completed_for_position || task.status === 'completed') return 'completed'

    const now = getAustralianNow()
    const todayStr = getAustralianToday()
    const today = parseAustralianDate(todayStr)
    const instanceDate = parseAustralianDate(task.date)

    // Selected date to evaluate status on (AU format expected)
    const viewDate = parseAustralianDate(currentDate || todayStr)
    const isViewingToday = viewDate.getTime() === today.getTime()

    // Visibility window anchor (never show before creation/publish/start; hide after end)
    let visibilityStart: Date | null = null
    let visibilityEnd: Date | null = null
    try {
      const createdAtIso = task?.master_task?.created_at
      const publishDelay = task?.master_task?.publish_delay // YYYY-MM-DD
      const startDate = task?.master_task?.start_date // YYYY-MM-DD
      const endDate = task?.master_task?.end_date // YYYY-MM-DD

      const dates: Date[] = []
      if (createdAtIso) {
        const createdAtAU = toAustralianTime(new Date(createdAtIso))
        dates.push(parseAustralianDate(formatAustralianDate(createdAtAU)))
      }
      if (publishDelay) dates.push(parseAustralianDate(publishDelay))
      if (startDate) dates.push(parseAustralianDate(startDate))
      if (dates.length > 0) visibilityStart = new Date(Math.max(...dates.map(d => d.getTime())))
      if (endDate) visibilityEnd = parseAustralianDate(endDate)
    } catch { }

    if (visibilityStart && viewDate < visibilityStart) return 'not_visible'
    if (visibilityEnd && viewDate > visibilityEnd) return 'not_visible'

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

    // Minimal holiday cache via client; if not available, status still works with weekend rules
    const win: any = typeof window !== 'undefined' ? window : {}
    win.__ph_holidays_cache = win.__ph_holidays_cache || new Set<string>()
    win.__ph_holidays_years = win.__ph_holidays_years || new Set<number>()

    const ensureHolidaysLoaded = () => {
      try {
        const year = instanceDate.getFullYear()
        const years = [year - 1, year, year + 1]
        const toLoad = years.filter((y) => !win.__ph_holidays_years.has(y))
        if (toLoad.length === 0) return Promise.resolve()
        return Promise.all(
          toLoad.map((y: number) => fetch(`/api/public-holidays?year=${y}`).then(r => (r.ok ? r.json() : [])).catch(() => []))
        ).then((all) => {
          all.flat().forEach((h: any) => { if (h?.date) win.__ph_holidays_cache.add(String(h.date)) })
          years.forEach((y) => win.__ph_holidays_years.add(y))
        })
      } catch { }
      return Promise.resolve()
    }

    const isHoliday = (d: Date) => win.__ph_holidays_cache?.has(ymd(d)) === true
    const isSunday = (d: Date) => d.getDay() === 0
    const isSaturday = (d: Date) => d.getDay() === 6
    const isBusinessDay = (d: Date) => !isSunday(d) && !isHoliday(d)
    const nextBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() + 1) } while (!isBusinessDay(x)); return x }
    const prevBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() - 1) } while (!isBusinessDay(x)); return x }
    const getWeekMonday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setDate(x.getDate() + diff); return x }
    const getWeekSaturday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = 6 - (day === 0 ? 7 : day); x.setDate(x.getDate() + diff); return x }
    const getLastSaturdayOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); while (x.getDay() !== 6) x.setDate(x.getDate() - 1); return x }
    const addBusinessDays = (d: Date, n: number) => { let x = new Date(d); let added = 0; while (added < n) { x = nextBusinessDay(x); added++ } return x }

    // Per-frequency windows (appearance, due, lock)
    const dueTimeStr: string | undefined = task?.master_task?.due_time || undefined
    const computeCutoffs = (freq: string) => {
      const r: any = { frequency: freq }
      const weekMon = getWeekMonday(instanceDate)
      const weekSat = getWeekSaturday(instanceDate)
      const clampAppearance = (d: Date) => {
        if (visibilityStart && d < visibilityStart) return new Date(visibilityStart)
        return d
      }
      switch (freq) {
        case 'once_off':
        case 'once_off_sticky': {
          const dueDate = (task as any).master_task?.due_date ? parseAustralianDate((task as any).master_task.due_date) : instanceDate
          // Once-off: never auto-miss/lock; stays overdue after due_time until completed
          r.appearance = clampAppearance(instanceDate); r.dueDate = dueDate; r.dueTime = dueTimeStr; r.lockDate = null; r.lockTime = null; r.carryEnd = null; return r
        }
        case 'every_day': {
          r.appearance = clampAppearance(instanceDate); r.dueDate = instanceDate; r.dueTime = dueTimeStr; r.lockDate = instanceDate; r.lockTime = '23:59'; r.carryEnd = instanceDate; return r
        }
        case 'once_weekly': {
          let appear = new Date(weekMon)
          if (isHoliday(appear)) { appear.setDate(appear.getDate() + 1); while (!isBusinessDay(appear) && appear <= weekSat) appear.setDate(appear.getDate() + 1) }
          let due = new Date(weekSat); while (!isBusinessDay(due) && due >= weekMon) due.setDate(due.getDate() - 1)
          r.appearance = clampAppearance(appear); r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; r.carryEnd = due; return r
        }
        case 'monday': case 'tuesday': case 'wednesday': case 'thursday': case 'friday': case 'saturday': {
          const idx: any = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
          const sched = new Date(weekMon); sched.setDate(weekMon.getDate() + (idx[freq] - 1))
          let due = new Date(sched)
          if (idx[freq] === 1) { while (!isBusinessDay(due) && due <= weekSat) due.setDate(due.getDate() + 1) }
          else {
            let shifted = new Date(due); while (!isBusinessDay(shifted) && shifted >= weekMon) shifted.setDate(shifted.getDate() - 1)
            if (!isBusinessDay(due)) { if (shifted < weekMon) { shifted = new Date(due); while (!isBusinessDay(shifted) && shifted <= weekSat) shifted.setDate(shifted.getDate() + 1) } due = shifted }
          }
          let carryEnd = new Date(weekSat); while (!isBusinessDay(carryEnd) && carryEnd >= weekMon) carryEnd.setDate(carryEnd.getDate() - 1)
          r.appearance = clampAppearance(due); r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = carryEnd; r.lockTime = '23:59'; r.carryEnd = carryEnd; return r
        }
        case 'start_of_every_month': case 'start_of_month_jan': case 'start_of_month_feb': case 'start_of_month_mar': case 'start_of_month_apr': case 'start_of_month_may': case 'start_of_month_jun': case 'start_of_month_jul': case 'start_of_month_aug': case 'start_of_month_sep': case 'start_of_month_oct': case 'start_of_month_nov': case 'start_of_month_dec': {
          const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
          let appear = new Date(first); if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1); if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2); while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
          const due = addBusinessDays(appear, 5)
          let carryEnd = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
          r.appearance = clampAppearance(appear); r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = carryEnd; r.lockTime = '23:59'; r.carryEnd = carryEnd; return r
        }
        case 'once_monthly': {
          const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
          let appear = new Date(first); if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1); if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2); while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
          let due = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(due)) due = prevBusinessDay(due)
          r.appearance = clampAppearance(appear); r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; r.carryEnd = due; return r
        }
        case 'end_of_every_month': case 'end_of_month_jan': case 'end_of_month_feb': case 'end_of_month_mar': case 'end_of_month_apr': case 'end_of_month_may': case 'end_of_month_jun': case 'end_of_month_jul': case 'end_of_month_aug': case 'end_of_month_sep': case 'end_of_month_oct': case 'end_of_month_nov': case 'end_of_month_dec': {
          let due = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(due)) due = prevBusinessDay(due)
          const lastDay = new Date(instanceDate.getFullYear(), instanceDate.getMonth() + 1, 0)
          const mondays: Date[] = []; for (let d = 1; d <= lastDay.getDate(); d++) { const t = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), d); if (t.getDay() === 1) mondays.push(t) }
          const hasFive = (start: Date, end: Date) => { let cur = new Date(start), c = 0; while (cur <= end) { if (isBusinessDay(cur)) c++; cur.setDate(cur.getDate() + 1) } return c >= 5 }
          let appear = mondays[0] || new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
          for (let i = mondays.length - 1; i >= 0; i--) { if (hasFive(mondays[i], due)) { appear = mondays[i]; break } }
          while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
          let carryEnd = getWeekSaturday(appear); if (carryEnd > due) carryEnd = due; while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
          r.appearance = clampAppearance(appear); r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; r.carryEnd = carryEnd; return r
        }
        default: { r.appearance = clampAppearance(instanceDate); r.dueDate = instanceDate; r.dueTime = dueTimeStr; r.lockDate = instanceDate; r.lockTime = '23:59'; r.carryEnd = instanceDate; return r }
      }
    }

    // Fire-and-forget to keep holidays fresh
    ensureHolidaysLoaded()

    const frequencies: string[] = task.master_task?.frequencies || []
    if (!Array.isArray(frequencies) || frequencies.length === 0) return 'due_today'

    // Priority includes not_visible so tasks before appearance don't display
    const priority: Record<string, number> = { not_visible: 0, not_due_yet: 1, due_today: 2, overdue: 3, missed: 4 }
    let best: string | null = null

    for (const f of frequencies) {
      const c = computeCutoffs(f)
      const appear: Date = c.appearance
      const due: Date = c.dueDate
      const lockDate: Date | null = c.lockDate || null
      const dueMoment = typeof c.dueTime === 'string' && c.dueTime ? createAustralianDateTime(ymd(due), c.dueTime) : null
      const lockMoment = lockDate ? createAustralianDateTime(ymd(lockDate), c.lockTime || '23:59') : null

      let st: string = 'not_due_yet'

      if (viewDate < appear) {
        st = 'not_visible'
      } else if (ymd(viewDate) === ymd(due)) {
        // On due date, show Due Today by default; if viewing today, time-of-day can make it Overdue or Missed
        if (isViewingToday) {
          if (lockMoment && now >= lockMoment) st = 'missed'
          else if (dueMoment && now >= dueMoment) st = 'overdue'
          else st = 'due_today'
        } else {
          st = 'due_today'
        }
      } else if (viewDate > due) {
        if (lockDate && viewDate > lockDate) st = 'missed'
        else st = 'overdue'
      } else {
        // Between appearance and day before due
        st = 'not_due_yet'
      }

      if (!best || priority[st] > priority[best]) best = st
    }

    return best || 'due_today'
  } catch (error) {
    console.error('Error calculating dynamic task status:', error, task)
    return task.is_completed_for_position || task.status === 'completed' ? 'completed' : 'due_today'
  }
}

const renderBadgesWithTruncation = (
  items: string[],
  maxVisible: number = 2,
  type: 'responsibility' | 'category' = 'responsibility',
  colorFn?: (value: string) => string
) => {
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

  const visibleItems = items.slice(0, maxVisible)
  const hiddenCount = items.length - maxVisible

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
      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
        +{hiddenCount}
      </Badge>
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
    <div className="flex items-center gap-2">
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

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedResponsibility, setSelectedResponsibility] = useState("all")
  const [selectedTiming, setSelectedTiming] = useState("opening") // Default to "opening"
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
        setTasks(newTasks)
        console.log('✅ Tasks set in state successfully, new count:', newTasks.length)

        // Mark as initially loaded after first successful load
        if (!hasInitiallyLoaded) {
          console.log('✅ Marking as initially loaded')
          setHasInitiallyLoaded(true)
        }

        // Calculate task counts
        const counts = {
          total: data.data.length,
          done: data.data.filter((t: ChecklistTask) => t.status === 'completed').length,
          due_today: 0,
          overdue: 0,
          missed: 0
        }

        const now = getAustralianNow()
        const today = currentDate

        data.data.forEach((task: ChecklistTask) => {
          if (task.status !== 'completed') {
            counts.due_today++

            // Check if overdue using Australian timezone
            if (task.master_task?.due_time) {
              const dueTime = createAustralianDateTime(today, task.master_task.due_time)
              if (now > dueTime) {
                counts.overdue++
              }
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
    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) return

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'completed', completed_at: australianNowUtcISOString() }
          : task
      )
    )

    try {
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'complete'
      })

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to complete task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Completed", "Task has been marked as complete.")

      // Broadcast event so homepage cards refresh their counts
      try {
        window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { date: currentDate, role } }))
      } catch { }
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
    // Prevent multiple simultaneous requests for the same task
    if (processingTasks.has(taskId)) return

    // Add to processing set
    setProcessingTasks(prev => new Set(prev).add(taskId))

    // Optimistic update
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'pending', completed_at: undefined, completed_by: undefined }
          : task
      )
    )

    try {
      const result = await authenticatedPost('/api/checklist/complete', {
        taskId,
        action: 'undo'
      })

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to undo task')
      }

      // Refresh to ensure synchronization with database
      setRefreshKey((prev) => prev + 1)
      toastSuccess("Task Reopened", "Task has been reopened.")

      // Broadcast event so homepage cards refresh their counts
      try {
        window.dispatchEvent(new CustomEvent('tasks-changed', { detail: { date: currentDate, role } }))
      } catch { }
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

      // Visibility + Status: hide tasks before appearance window
      const dynamicStatus = calculateDynamicTaskStatus(task, currentDate)
      if (dynamicStatus === 'not_visible') return false

      // Status filter - after visibility check
      if (selectedStatus !== "all") {
        return dynamicStatus === selectedStatus
      }
      return true
    })

    // Always sort by custom_order first (as set by administrator in Master Tasks Management)
    // This ensures tasks are displayed in the order most recently saved by the administrator
    return [...filtered].sort((a, b) => {
      // 1. Primary sort: custom_order from master_tasks table
      const aCustomOrder = a.master_task.custom_order
      const bCustomOrder = b.master_task.custom_order

      // If both tasks have custom_order, sort by it
      if (typeof aCustomOrder === 'number' && typeof bCustomOrder === 'number') {
        return aCustomOrder - bCustomOrder
      }

      // If only one has custom_order, prioritize it (tasks with custom_order come first)
      if (typeof aCustomOrder === 'number' && typeof bCustomOrder !== 'number') {
        return -1
      }
      if (typeof bCustomOrder === 'number' && typeof aCustomOrder !== 'number') {
        return 1
      }

      // Fallback sorting for tasks without custom_order: due_time, then frequency rank, then position display_order, then description
      // 2. Sort by due_time (timing)
      const aMin = parseDueTimeToMinutes(a.master_task.due_time)
      const bMin = parseDueTimeToMinutes(b.master_task.due_time)
      if (aMin !== bMin) return aMin - bMin

      // 3. Sort by frequency rank
      const aRank = getFrequencyRankForDay(a.master_task.frequencies || [], currentDate)
      const bRank = getFrequencyRankForDay(b.master_task.frequencies || [], currentDate)
      if (aRank !== bRank) return aRank - bRank

      // 4. Sort by position display_order (responsibility)
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

      // 5. Sort by task description
      const aDesc = a.master_task.description?.toLowerCase() || ''
      const bDesc = b.master_task.description?.toLowerCase() || ''
      if (aDesc !== bDesc) return aDesc.localeCompare(bDesc)

      return 0
    })
  }, [tasks, searchTerm, selectedResponsibility, selectedCategory, selectedStatus, selectedTiming, currentDate, isAdmin, positions])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedTasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, endIndex)

  // Recalculate summary counts whenever the visible tasks or date change
  useEffect(() => {
    const counts = {
      total: filteredAndSortedTasks.length,
      done: 0,
      not_due_yet: 0,
      due_today: 0,
      overdue: 0,
      missed: 0,
    }
    filteredAndSortedTasks.forEach(task => {
      const status = calculateDynamicTaskStatus(task, currentDate)
      if (status === 'completed') counts.done += 1
      else if (status === 'not_due_yet') counts.not_due_yet += 1
      else if (status === 'due_today') counts.due_today += 1
      else if (status === 'overdue') counts.overdue += 1
      else if (status === 'missed') counts.missed += 1
    })
    setTaskCounts(counts)
  }, [filteredAndSortedTasks, currentDate])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedResponsibility, selectedCategory, selectedStatus, selectedTiming, currentDate])

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

  const getStatusBadge = (task: ChecklistTask) => {
    // For admin view with "All Responsibilities" filter
    if (isAdmin && selectedResponsibility === 'all') {
      const completions = task.position_completions || []

      if (completions.length === 0) {
        // No completions - use dynamic status calculation
        const dynamicStatus = calculateDynamicTaskStatus(task, currentDate)
        return getStatusBadgeByStatus(dynamicStatus)
      }

      // Show position completion badges with truncation
      const maxVisible = 2
      const visibleCompletions = completions.slice(0, maxVisible)
      const hiddenCount = completions.length - maxVisible

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
    const dynamicStatus = calculateDynamicTaskStatus(task, currentDate)
    return getStatusBadgeByStatus(dynamicStatus)
  }

  // Helper function to get status badge by status string
  const getStatusBadgeByStatus = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            ✓ Done
          </Badge>
        )
      case "not_due_yet":
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
          <Badge className="bg-gray-800 text-white border-gray-600">
            ❌ Missed
          </Badge>
        )
      default:
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            ⏰ Due Today
          </Badge>
        )
    }
  }

  const allTasksCompleted = filteredAndSortedTasks.length > 0 && filteredAndSortedTasks.every((task) =>
    calculateDynamicTaskStatus(task, currentDate) === "completed"
  )

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
                  {parseAustralianDate(currentDate).toLocaleDateString("en-AU", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
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
                      const status = calculateDynamicTaskStatus(task, currentDate)
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
                    className="bg-white text-blue-600 hover:bg-gray-100 w-full sm:w-auto"
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
            <div className="flex flex-col lg:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 gap-4">
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
                        <TableHead className="w-[4%] py-3 bg-gray-50 text-center">Publish</TableHead>
                        <TableHead className={isAdmin ? "w-[25%] py-3 bg-gray-50" : "w-[31%] py-3 bg-gray-50"}>
                          Title & Description
                        </TableHead>
                        {isAdmin && (
                          <TableHead className="w-[16%] py-3 bg-gray-50">
                            Responsibility
                          </TableHead>
                        )}
                        {!isAdmin && (
                          <TableHead className="w-[10%] py-3 bg-gray-50 text-center">
                            Shared
                          </TableHead>
                        )}
                        <TableHead className="w-[17%] py-3 bg-gray-50">
                          Category
                        </TableHead>
                        <TableHead className="w-[15%] py-3 bg-gray-50">
                          Frequencies
                        </TableHead>
                        <TableHead className="w-[7%] py-3 bg-gray-50 text-left">
                          Due Time
                        </TableHead>
                        <TableHead className="w-[10%] py-3 bg-gray-50">Status</TableHead>
                        <TableHead className="w-[10%] py-3 bg-gray-50">Actions</TableHead>
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
                                <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">N</span>
                              ) : (
                                <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-300 text-[10px] font-bold border border-gray-100">
                                  {getTimingInitial(task)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
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
                          {isAdmin && (
                            <TableCell className="py-3">
                              <div className="max-w-full overflow-hidden">
                                <div className="flex flex-wrap gap-1">
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
                          <TableCell className="py-3">
                            <div className="max-w-full overflow-hidden">
                              <div className="flex flex-wrap gap-1">
                                {renderBadgesWithTruncation(task.master_task.categories, 2, 'category')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            {renderFrequencyWithDetails(task)}
                          </TableCell>
                          <TableCell className="py-3">
                            {task.master_task.due_time ? (
                              <span className="text-sm font-medium">{task.master_task.due_time}</span>
                            ) : (
                              <span className="text-sm text-gray-500">No due time</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(task)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center space-x-2">
                              {/* Hide Done/Undo buttons for admins; show only details */}
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
                                  {(task.is_completed_for_position || task.status === "completed") ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleTaskUndo(task.id)}
                                      disabled={processingTasks.has(task.id)}
                                      className="border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400 font-medium disabled:opacity-50"
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
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleTaskComplete(task.id)}
                                      disabled={processingTasks.has(task.id)}
                                      className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50"
                                    >
                                      {processingTasks.has(task.id) ? (
                                        <span className="flex items-center">
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                          Processing...
                                        </span>
                                      ) : (
                                        <span>Done ?</span>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDetails(task)}
                                    title="View Details"
                                    className="hover:bg-gray-100"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span className="ml-1"></span>
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
                          {/* Publish badge */}
                          <div className="flex justify-start">
                            {task.is_new ? (
                              <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">N</span>
                            ) : (
                              <span title={getPublishTooltip(task)} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold border border-gray-300">
                                {getTimingInitial(task)}
                              </span>
                            )}
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
                                <span className="text-gray-500">Shared Responsibilities:</span>
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
                            <div className="flex grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-gray-500">Due Time:</span>
                                <div className="mt-1 font-medium">
                                  {task.master_task.due_time ? (
                                    <span>{task.master_task.due_time}</span>
                                  ) : (
                                    <span className="text-gray-400">No due time</span>
                                  )}
                                </div>
                              </div>
                              <div className="items-center space-x-2">
                                <span className="text-sm text-gray-500">Status:</span>
                                <div className="mt-1">
                                  {getStatusBadge(task)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2 grid grid-cols-2 gap-2">
                            {isAdmin ? (
                              // Admin: only show details
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDetails(task)}
                                title="View Details"
                                className="hover:bg-gray-100"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="ml-1">Details</span>
                              </Button>
                            ) : (
                              <>
                                {(task.is_completed_for_position || task.status === "completed") ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTaskUndo(task.id)}
                                    disabled={processingTasks.has(task.id)}
                                    className="flex-1 border-green-300 bg-green-100 text-green-800 hover:bg-green-200 hover:border-green-400 font-medium disabled:opacity-50"
                                  >
                                    {processingTasks.has(task.id) ? (
                                      <span className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-800 mr-1"></div>
                                        Processing...
                                      </span>
                                    ) : (
                                      <span>✓ Done</span>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleTaskComplete(task.id)}
                                    disabled={processingTasks.has(task.id)}
                                    className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 font-medium disabled:opacity-50"
                                  >
                                    {processingTasks.has(task.id) ? (
                                      <span className="flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                        Processing...
                                      </span>
                                    ) : (
                                      <span>Done ?</span>
                                    )}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              Summary for {parseAustralianDate(currentDate).toLocaleDateString("en-AU")}
            </span>
            <div className="flex items-center space-x-4">
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
      </main>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        task={selectedTask}
        currentDate={currentDate}
        onTaskUpdate={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}
