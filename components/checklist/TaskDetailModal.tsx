'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Clock, User, Calendar, CheckCircle, XCircle, AlertTriangle, Tag, FileText, Settings, Hash } from 'lucide-react'
import { toDisplayFormat } from '@/lib/responsibility-mapper'
import { getAustralianNow, getAustralianToday, parseAustralianDate, createAustralianDateTime, toAustralianTime, formatAustralianDate } from '@/lib/timezone-utils'

interface TaskDetailModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  currentDate?: string // selected date (YYYY-MM-DD in AU format expected by page)
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

  // Advanced cutoff hooks and helpers must be declared before any conditional returns
  const [holidays, setHolidays] = useState<Set<string>>(new Set())
  const [holidaysLoaded, setHolidaysLoaded] = useState(false)

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

  useEffect(() => {
    if (!isOpen || !task?.date) return
    const year = new Date(task.date).getFullYear()
    const years = [year - 1, year, year + 1]
    Promise.all(
      years.map(y =>
        fetch(`/api/public-holidays?year=${y}`)
          .then(r => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    ).then(all => {
      const s = new Set<string>()
      all.flat().forEach((h: any) => {
        if (h?.date) s.add(String(h.date))
      })
      setHolidays(s)
      setHolidaysLoaded(true)
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

  // Dynamic status calculation mirroring page logic with full frequency handling and selected date
  const calculateDynamicTaskStatus = (t: any, dateStr: string): string => {
    try {
      // Completed takes precedence
      if (t.is_completed_for_position || t.status === 'completed') return 'completed'

      const now = getAustralianNow()
      const todayStr = getAustralianToday()
      const today = parseAustralianDate(todayStr)
      const instanceDate = parseAustralianDate(t.date)

      // Selected date to evaluate status on (AU format expected)
      const viewDate = parseAustralianDate(dateStr || todayStr)
      const isViewingToday = viewDate.getTime() === today.getTime()

      // Visibility window anchor (never show before creation/publish/start; hide after end)
      let visibilityStart: Date | null = null
      let visibilityEnd: Date | null = null
      try {
        const createdAtIso = t?.master_task?.created_at
        const publishDelay = t?.master_task?.publish_delay // YYYY-MM-DD
        const startDate = t?.master_task?.start_date // YYYY-MM-DD
        const endDate = t?.master_task?.end_date // YYYY-MM-DD

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

      // Use holidays loaded in this modal; fall back to Sunday-only if not available
      const isHolidayLocal = (d: Date) => holidays.has(ymd(d)) === true
      const isSunday = (d: Date) => d.getDay() === 0
      const isBusinessDay = (d: Date) => !isSunday(d) && !isHolidayLocal(d)
      const nextBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() + 1) } while (!isBusinessDay(x)); return x }
      const prevBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() - 1) } while (!isBusinessDay(x)); return x }
      const getWeekMonday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setDate(x.getDate() + diff); return x }
      const getWeekSaturday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = 6 - (day === 0 ? 7 : day); x.setDate(x.getDate() + diff); return x }
      const getLastSaturdayOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); while (x.getDay() !== 6) x.setDate(x.getDate() - 1); return x }
      const addBusinessDays = (d: Date, n: number) => { let x = new Date(d); let added = 0; while (added < n) { x = nextBusinessDay(x); added++ } return x }

      // Per-frequency windows (appearance, due, lock)
      const dueTimeStr: string | undefined = t?.master_task?.due_time || undefined
      const computeCutoffs = (freq: string) => {
        const r: any = { frequency: freq }
        const weekMon = getWeekMonday(instanceDate)
        const weekSat = getWeekSaturday(instanceDate)
        switch (freq) {
          case 'once_off':
          case 'once_off_sticky': {
            const dueDate = (t as any).master_task?.due_date ? parseAustralianDate((t as any).master_task.due_date) : instanceDate
            r.appearance = instanceDate; r.dueDate = dueDate; r.dueTime = dueTimeStr; r.lockDate = dueDate; r.lockTime = '23:59'; r.carryEnd = dueDate; return r
          }
          case 'every_day': {
            r.appearance = instanceDate; r.dueDate = instanceDate; r.dueTime = dueTimeStr; r.lockDate = instanceDate; r.lockTime = '23:59'; r.carryEnd = instanceDate; return r
          }
          case 'once_weekly': {
            let appear = new Date(weekMon)
            if (isHolidayLocal(appear)) { appear.setDate(appear.getDate() + 1); while (!isBusinessDay(appear) && appear <= weekSat) appear.setDate(appear.getDate() + 1) }
            let due = new Date(weekSat); while (!isBusinessDay(due) && due >= weekMon) due.setDate(due.getDate() - 1)
            r.appearance = appear; r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; r.carryEnd = due; return r
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
            r.appearance = due; r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = carryEnd; r.lockTime = '23:59'; r.carryEnd = carryEnd; return r
          }
          case 'start_of_every_month': case 'start_of_month_jan': case 'start_of_month_feb': case 'start_of_month_mar': case 'start_of_month_apr': case 'start_of_month_may': case 'start_of_month_jun': case 'start_of_month_jul': case 'start_of_month_aug': case 'start_of_month_sep': case 'start_of_month_oct': case 'start_of_month_nov': case 'start_of_month_dec': {
            const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
            let appear = new Date(first); if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1); if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2); while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
            const due = addBusinessDays(appear, 5)
            let carryEnd = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
            r.appearance = appear; r.carryStart = appear; r.carryEnd = carryEnd; r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = carryEnd; r.lockTime = '23:59'; return r
          }
          case 'once_monthly': {
            const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
            let appear = new Date(first); if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1); if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2); while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
            let due = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(due)) due = prevBusinessDay(due)
            r.appearance = appear; r.carryStart = appear; r.carryEnd = due; r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; return r
          }
          case 'end_of_every_month': case 'end_of_month_jan': case 'end_of_month_feb': case 'end_of_month_mar': case 'end_of_month_apr': case 'end_of_month_may': case 'end_of_month_jun': case 'end_of_month_jul': case 'end_of_month_aug': case 'end_of_month_sep': case 'end_of_month_oct': case 'end_of_month_nov': case 'end_of_month_dec': {
            let due = getLastSaturdayOfMonth(instanceDate); while (!isBusinessDay(due)) due = prevBusinessDay(due)
            const lastDay = new Date(instanceDate.getFullYear(), instanceDate.getMonth() + 1, 0)
            const mondays: Date[] = []; for (let d = 1; d <= lastDay.getDate(); d++) { const t2 = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), d); if (t2.getDay() === 1) mondays.push(t2) }
            const hasFive = (start: Date, end: Date) => { let cur = new Date(start), c = 0; while (cur <= end) { if (isBusinessDay(cur)) c++; cur.setDate(cur.getDate() + 1) } return c >= 5 }
            let appear = mondays[0] || new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
            for (let i = mondays.length - 1; i >= 0; i--) { if (hasFive(mondays[i], due)) { appear = mondays[i]; break } }
            while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
            let carryEnd = getWeekSaturday(appear); if (carryEnd > due) carryEnd = due; while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
            r.appearance = appear; r.carryStart = appear; r.carryEnd = carryEnd; r.dueDate = due; r.dueTime = dueTimeStr; r.lockDate = due; r.lockTime = '23:59'; return r
          }
          default: { r.appearance = instanceDate; r.dueDate = instanceDate; r.dueTime = dueTimeStr; r.lockDate = instanceDate; r.lockTime = '23:59'; r.carryEnd = instanceDate; return r }
        }
      }

      const frequencies: string[] = t.master_task?.frequencies || []
      if (!Array.isArray(frequencies) || frequencies.length === 0) return 'due_today'

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
          st = 'not_due_yet'
        }

        if (!best || priority[st] > priority[best]) best = st
      }

      return best || 'due_today'
    } catch (e) {
      console.error('Modal status calc error', e)
      return t.status === 'completed' ? 'completed' : 'due_today'
    }
  }

  const status = calculateDynamicTaskStatus(task, (typeof window === 'undefined' ? task?.date : undefined) || (typeof currentDate === 'string' && currentDate ? currentDate : task?.date || ''))

  // Business-day helpers and cutoff calculators (non-hook)
  const isSunday = (d: Date) => d.getDay() === 0
  const isHoliday = (d: Date) => holidays.has(formatYMD(d))
  const isBusinessDay = (d: Date) => !isSunday(d) && !isHoliday(d)
  const nextBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() + 1) } while (!isBusinessDay(x)); return x }
  const prevBusinessDay = (d: Date) => { const x = new Date(d); do { x.setDate(x.getDate() - 1) } while (!isBusinessDay(x)); return x }
  const getWeekMonday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setDate(x.getDate() + diff); return x }
  const getWeekSaturday = (d: Date) => { const x = new Date(d); const day = x.getDay(); const diff = 6 - (day === 0 ? 7 : day); x.setDate(x.getDate() + diff); return x }
  const getLastSaturdayOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); while (x.getDay() !== 6) x.setDate(x.getDate() - 1); return x }
  const addBusinessDays = (d: Date, n: number) => { let x = new Date(d); let added = 0; while (added < n) { x = nextBusinessDay(x); added++ } return x }

  const nowAU = getAustralianNow()
  const dueTimeStr: string | undefined = task?.master_task?.due_time || undefined

  const formatAUDate = (d?: Date | null) =>
    d ? d.toLocaleDateString('en-AU', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'
  const formatAUTime = (d?: Date | null) =>
    d ? d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  function computeFrequencyCutoffs(freq: string) {
    const instanceDate = parseAustralianDate(task.date)
    const weekSat = getWeekSaturday(instanceDate)
    const weekMon = getWeekMonday(instanceDate)

    const r: any = { frequency: freq }

    switch (freq) {
      case 'once_off':
      case 'once_off_sticky': {
        const dueDate = (task as any).master_task?.due_date ? parseAustralianDate((task as any).master_task.due_date) : instanceDate
        r.appearance = instanceDate
        r.dueDate = dueDate
        r.dueTime = dueTimeStr
        r.lockDate = null
        r.carryStart = instanceDate
        r.carryEnd = null
        return r
      }
      case 'every_day': {
        r.appearance = instanceDate
        r.dueDate = instanceDate
        r.dueTime = dueTimeStr
        r.lockDate = instanceDate
        r.lockTime = '23:59'
        return r
      }
      case 'once_weekly': {
        let appear = new Date(weekMon)
        while (!isBusinessDay(appear) && appear <= weekSat) { appear.setDate(appear.getDate() + 1) }
        let due = new Date(weekSat)
        while (!isBusinessDay(due) && due >= weekMon) { due.setDate(due.getDate() - 1) }
        r.appearance = appear
        r.carryStart = appear
        r.carryEnd = due
        r.dueDate = due
        r.dueTime = dueTimeStr
        r.lockDate = due
        r.lockTime = '23:59'
        return r
      }
      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday': {
        const targetIdx: number = ({ monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 } as any)[freq]
        const sched = new Date(weekMon)
        sched.setDate(weekMon.getDate() + (targetIdx - 1))
        let due = new Date(sched)
        if (targetIdx === 1) {
          while (!isBusinessDay(due) && due <= weekSat) due.setDate(due.getDate() + 1)
        } else {
          let shifted = new Date(due)
          while (!isBusinessDay(shifted) && shifted >= weekMon) shifted.setDate(shifted.getDate() - 1)
          if (!isBusinessDay(due)) {
            if (shifted < weekMon) {
              shifted = new Date(due)
              while (!isBusinessDay(shifted) && shifted <= weekSat) shifted.setDate(shifted.getDate() + 1)
            }
            due = shifted
          }
        }
        let carryEnd = new Date(weekSat)
        while (!isBusinessDay(carryEnd) && carryEnd >= weekMon) carryEnd.setDate(carryEnd.getDate() - 1)
        r.appearance = due
        r.dueDate = due
        r.dueTime = dueTimeStr
        r.carryStart = due
        r.carryEnd = carryEnd
        r.lockDate = carryEnd
        r.lockTime = '23:59'
        return r
      }
      case 'start_of_every_month':
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
        const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
        let appear = new Date(first)
        if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1)
        if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2)
        while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
        const due = addBusinessDays(appear, 5)
        let carryEnd = getLastSaturdayOfMonth(instanceDate)
        while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
        r.appearance = appear
        r.carryStart = appear
        r.carryEnd = carryEnd
        r.dueDate = due
        r.dueTime = dueTimeStr
        r.lockDate = carryEnd
        r.lockTime = '23:59'
        return r
      }
      case 'once_monthly': {
        const first = new Date(instanceDate.getFullYear(), instanceDate.getMonth(), 1)
        let appear = new Date(first)
        if (appear.getDay() === 0) appear.setDate(appear.getDate() + 1)
        if (appear.getDay() === 6) appear.setDate(appear.getDate() + 2)
        while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
        let due = getLastSaturdayOfMonth(instanceDate)
        while (!isBusinessDay(due)) due = prevBusinessDay(due)
        r.appearance = appear
        r.carryStart = appear
        r.carryEnd = due
        r.dueDate = due
        r.dueTime = dueTimeStr
        r.lockDate = due
        r.lockTime = '23:59'
        return r
      }
      case 'end_of_every_month':
      case 'end_of_month_jan':
      case 'end_of_month_feb':
      case 'end_of_month_mar':
      case 'end_of_month_apr':
      case 'end_of_month_may':
      case 'end_of_month_jun':
      case 'end_of_month_jul':
      case 'end_of_month_aug':
      case 'end_of_month_sep':
      case 'end_of_month_oct':
      case 'end_of_month_nov':
      case 'end_of_month_dec': {
        let due = getLastSaturdayOfMonth(instanceDate)
        while (!isBusinessDay(due)) due = prevBusinessDay(due)
        let appear = new Date(due)
        appear.setDate(appear.getDate() - ((appear.getDay() + 6) % 7))
        const hasFiveDays = (start: Date, end: Date) => { let cur = new Date(start); let count = 0; while (cur <= end) { if (isBusinessDay(cur)) count++; cur.setDate(cur.getDate() + 1) } return count >= 5 }
        while (!hasFiveDays(appear, due)) appear.setDate(appear.getDate() - 7)
        while (!isBusinessDay(appear)) appear = nextBusinessDay(appear)
        let carryEnd = getWeekSaturday(appear)
        if (carryEnd > due) carryEnd = due
        while (!isBusinessDay(carryEnd)) carryEnd = prevBusinessDay(carryEnd)
        r.appearance = appear
        r.carryStart = appear
        r.carryEnd = carryEnd
        r.dueDate = due
        r.dueTime = dueTimeStr
        r.lockDate = due
        r.lockTime = '23:59'
        return r
      }
      default: {
        r.appearance = instanceDate
        r.dueDate = instanceDate
        r.dueTime = dueTimeStr
        r.lockDate = instanceDate
        r.lockTime = '23:59'
        return r
      }
    }
  }

  const frequencyCutoffs = Array.isArray(task?.master_task?.frequencies)
    ? task.master_task.frequencies.map((f: string) => computeFrequencyCutoffs(f))
    : []

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
                    <Badge className={
                      status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                        status === 'overdue' ? 'bg-red-100 text-red-800 border-red-200' :
                          status === 'missed' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                            status === 'not_due_yet' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-orange-100 text-orange-800 border-orange-200'
                    }>
                      {status === 'completed' ? '✅ Completed' :
                        status === 'overdue' ? '⚠️ Overdue' :
                          status === 'missed' ? '❌ Missed' :
                            status === 'not_due_yet' ? '📅 Not Due Yet' :
                              '⏰ Due Today'}
                    </Badge>
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
                    <p className="text-purple-700 font-semibold">
                      {new Date(task.date).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="bg-purple-50 px-4 py-3 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-800">Timing</span>
                    </div>
                    <p className="text-purple-700 font-semibold">
                      {task.master_task?.timing?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Not specified'}
                    </p>
                  </div>
                  <div className="bg-purple-50 px-4 py-3 rounded-lg border border-purple-200">
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
                  status === 'not_due_yet' ? 'bg-blue-50 border-blue-200' :
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
                    ) : status === 'not_due_yet' ? (
                      <Clock className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-orange-600" />
                    )}
                    <span className={`font-semibold text-lg ${status === 'completed' ? 'text-green-800' :
                      status === 'not_due_yet' ? 'text-blue-800' :
                        status === 'overdue' ? 'text-red-800' :
                          status === 'missed' ? 'text-gray-800' :
                            'text-orange-800'
                      }`}>
                      Current Status: {
                        status === 'completed' ? 'Completed' :
                          status === 'not_due_yet' ? 'Not Due Yet' :
                            status === 'overdue' ? 'Overdue' :
                              status === 'missed' ? 'Missed' :
                                'Due Today'
                      }
                    </span>
                  </div>

                  {task.status === 'completed' && task.completed_at && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {task.position_completions.map((completion: any, index: number) => (
                        <div key={index} className="bg-white px-4 py-3 rounded-lg border border-green-200">
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

                  {status !== 'completed' && (
                    <p className="text-sm ${status === 'overdue' ? 'text-red-700' : status === 'missed' ? 'text-gray-700' : status === 'not_due_yet' ? 'text-blue-700' : 'text-orange-700'}">
                      {status === 'overdue' && 'This task is overdue.'}
                      {status === 'missed' && 'This task was missed and is locked.'}
                      {status === 'not_due_yet' && 'This task is not due yet.'}
                      {status === 'due_today' && 'This task is due today.'}
                    </p>
                  )}
                </div>

                {/* Timing & Cutoffs (per frequency) */}
                {Array.isArray(frequencyCutoffs) && frequencyCutoffs.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      <span>Timing & Cutoffs (Australia/Sydney)s</span>
                    </CardTitle>

                    {!holidaysLoaded && (
                      <div className="text-sm text-gray-600">Loading holiday data for precise cutoffs...</div>
                    )}

                    {frequencyCutoffs.map((fc: any, idx: number) => (
                      <div key={idx} className="bg-pink-50 px-4 py-3 rounded-lg border border-pink-200">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                          Frequency: {fc.frequency?.replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase())}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm gap-8">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Appearance:</span>
                              <span className="text-gray-900 font-medium">{formatAUDate(fc.appearance)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Carry window:</span>
                              <span className="text-gray-900 font-medium">
                                {fc.carryStart ? formatAUDate(fc.carryStart) : '—'}
                                {' '} - {' '}
                                {fc.carryEnd ? formatAUDate(fc.carryEnd) : (fc.carryEnd === null ? 'Indefinite' : '—')}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Due Date & Due TIme:</span>
                              <span className="text-gray-900 font-medium">{formatAUDate(fc.dueDate)}, </span>
                              {fc.dueTime ? fc.dueTime : '—'}
                              {fc.dueDate && fc.dueTime && (
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs border ${nowAU >= new Date(`${formatYMD(fc.dueDate)}T${fc.dueTime}:00`)
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                  {nowAU >= new Date(`${formatYMD(fc.dueDate)}T${fc.dueTime}:00`) ? 'Passed' : 'Upcoming'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Lock cutoff:</span>
                              <span className="text-gray-900 font-medium">
                                {fc.lockDate ? `${formatAUDate(fc.lockDate)} 11:59 PM` : 'Never locks'}
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