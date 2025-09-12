import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAustralianNow, getAustralianToday, formatAustralianDate, createAustralianDateTime, fromAustralianTime, australianNowUtcISOString, parseAustralianDate } from '@/lib/timezone-utils'
import { getSystemSettings } from '@/lib/system-settings'
import { generateTaskOccurrences } from '@/lib/task-occurrence-generator'

// Use service role client to bypass RLS (we enforce auth/authorization in code)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to map position ID to responsibility value
async function getResponsibilityFromPositionId(positionId: string): Promise<string | null> {
  const { data: position } = await supabaseAdmin
    .from('positions')
    .select('name')
    .eq('id', positionId)
    .single()

  if (!position) return null

  // The responsibility values in the database are the display names, not the value keys
  // So we return the position name directly
  return position.name
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const dateRange = searchParams.get('date_range') || '7' // days

    // Calculate date range for the past N days (inclusive)
    // If today is Sept 11 and dateRange is 7, we want Sept 5-11 (7 days total)
    const todayStr = getAustralianToday()
    const endDate = parseAustralianDate(todayStr) // Use today as end date
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - (parseInt(dateRange) - 1)) // -6 for 7 days total

    // For missed task tracking, we need to look back further to find when tasks first became missed
    const extendedStartDate = new Date(endDate)
    extendedStartDate.setDate(endDate.getDate() - (parseInt(dateRange) + 30 - 1)) // Look back 30 extra days

    const startDateStr = formatAustralianDate(startDate)
    const endDateStr = formatAustralianDate(endDate)
    const extendedStartDateStr = formatAustralianDate(extendedStartDate)

    console.log('Dashboard API: Date range:', { startDateStr, endDateStr, todayStr, extendedStartDateStr })

    // Generate task occurrences for the extended date range to track when tasks first became missed
    const allTaskOccurrences = await generateTaskOccurrences(extendedStartDateStr, endDateStr, positionId)

    // Filter to get only the last 7 days for main dashboard stats
    const taskOccurrences = allTaskOccurrences.filter(occ => occ.date >= startDateStr)

    console.log('Dashboard API: Generated task occurrences:', taskOccurrences.length)

    // Handle case where no task occurrences exist
    if (!taskOccurrences || taskOccurrences.length === 0) {
      console.log('Dashboard API: No task occurrences from generator; falling back to per-position counts for overdue')

      // Fallback: compute today's overdue across positions to match homepage cards
      let todayOverdueAcrossPositions = 0
      try {
        const { data: positions } = await supabaseAdmin
          .from('positions')
          .select('id, name')
        const nonAdminPositions = (positions || []).filter(p => (p.name || '') !== 'Administrator')

        // Build absolute origin for internal fetches (more reliable than nextUrl as base)
        const origin = (() => {
          try { return new URL(request.url).origin } catch { return '' }
        })()

        const perPositionOverdueCounts = await Promise.all(
          nonAdminPositions.map(async (pos) => {
            try {
              const roleParam = pos.name
              const urlStr = origin ? `${origin}/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
                : `/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
              const res = await fetch(urlStr)
              if (!res.ok) return 0
              const json = await res.json().catch(() => null)
              if (json && json.success && json.data && typeof json.data.overdue === 'number') {
                return json.data.overdue as number
              }
              return 0
            } catch (inner) {
              console.warn('Dashboard API: fallback per-position counts fetch failed for position', pos?.name, inner)
              return 0
            }
          })
        )
        todayOverdueAcrossPositions = perPositionOverdueCounts.reduce((a, b) => a + b, 0)
      } catch (e) {
        console.warn('Dashboard API: Fallback overdue computation failed:', e)
      }

      return NextResponse.json({
        summary: {
          totalTasks: 0,
          completedTasks: 0,
          onTimeCompletionRate: 0,
          avgTimeToCompleteHours: 0,
          newSince9am: 0,
          missedLast7Days: 0,
          overdueTasks: todayOverdueAcrossPositions
        },
        today: {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: todayOverdueAcrossPositions,
          missed: 0
        },
        categories: {},
        recentTasks: []
      })
    }

    // Convert task occurrences to the format expected by the rest of the function
    const tasksWithDynamicStatus = taskOccurrences.map(occurrence => ({
      id: `${occurrence.masterTaskId}:${occurrence.date}`,
      master_task_id: occurrence.masterTaskId,
      instance_date: occurrence.date,
      due_date: occurrence.date,
      status: occurrence.status === 'completed' ? 'done' : 'not_due',
      completed_at: occurrence.completedAt,
      created_at: null,
      lock_date: null,
      lock_time: null,
      detailed_status: null,
      dynamicStatus: occurrence.status,
      master_tasks: {
        title: occurrence.title,
        categories: occurrence.categories,
        due_time: occurrence.dueTime
      }
    }))

    // Filter tasks by their dynamic status
    const completedTasks = tasksWithDynamicStatus.filter(task => task.dynamicStatus === 'completed')
    const todayTasks = tasksWithDynamicStatus.filter(task => task.instance_date === todayStr)

    // Convert ALL task occurrences (extended range) to find when tasks first became overdue
    const allTasksWithDynamicStatus = allTaskOccurrences.map(occurrence => ({
      id: `${occurrence.masterTaskId}:${occurrence.date}`,
      master_task_id: occurrence.masterTaskId,
      instance_date: occurrence.date,
      due_date: occurrence.date,
      status: occurrence.status === 'completed' ? 'done' : 'not_due',
      completed_at: occurrence.completedAt,
      created_at: null,
      lock_date: null,
      lock_time: null,
      detailed_status: null,
      dynamicStatus: occurrence.status,
      master_tasks: {
        title: occurrence.title,
        categories: occurrence.categories,
        due_time: occurrence.dueTime
      }
    }))

    // Sort all tasks by date to find first occurrence of overdue/missed status
    const sortedAllTasks = allTasksWithDynamicStatus.sort((a, b) => a.instance_date.localeCompare(b.instance_date))

    // For "Overdue Tasks" metric: Count overdue tasks across all positions individually
    // This counts shared tasks multiple times (once per position) unlike checklist which counts them once

    // For today's section: show actual overdue tasks today (for operational purposes)
    const todayOverdueTasksActual = todayTasks.filter(t => t.dynamicStatus === 'overdue')

    // For overdue count, use per-position counting by making internal API calls
    // This matches exactly how the homepage cards work and ensures consistency
    let todayOverdueAcrossPositions = 0
    try {
      const { data: positions } = await supabaseAdmin
        .from('positions')
        .select('id, name')
      const nonAdminPositions = (positions || []).filter(p => (p.name || '') !== 'Administrator')

      // Build absolute origin for internal fetches
      const origin = (() => {
        try { return new URL(request.url).origin } catch { return '' }
      })()

      const perPositionOverdueCounts = await Promise.all(
        nonAdminPositions.map(async (pos) => {
          try {
            const roleParam = pos.name
            const urlStr = origin ? `${origin}/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
              : `/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
            const res = await fetch(urlStr)
            if (!res.ok) return 0
            const json = await res.json().catch(() => null)
            if (json && json.success && json.data && typeof json.data.overdue === 'number') {
              return json.data.overdue as number
            }
            return 0
          } catch (inner) {
            return 0
          }
        })
      )
      todayOverdueAcrossPositions = perPositionOverdueCounts.reduce((a, b) => a + b, 0)
    } catch (e) {
      // Fallback to unified count if per-position fails
      const allCurrentlyOverdueTasks = allTasksWithDynamicStatus.filter(t => t.dynamicStatus === 'overdue')
      todayOverdueAcrossPositions = allCurrentlyOverdueTasks.length
    }

    // For "Missed Tasks (7 days)" metric: Count ALL missed tasks within the last 7 days
    // Among tasks that are assigned to today's checklist based on their frequency
    // Example: 39 missed on Sept 10 + 39 missed on Sept 11 = 78 total (for tasks that also appear today)
    const todayMasterIds = new Set(
      allTaskOccurrences
        .filter(occ => occ.date === todayStr)
        .map(occ => occ.masterTaskId)
    )
    const missedTasksLast7Days = tasksWithDynamicStatus.filter(task =>
      task.dynamicStatus === 'missed' &&
      task.instance_date >= startDateStr &&
      todayMasterIds.has(task.master_task_id)
    )

    console.log('Dashboard API: Date range for filtering:', { startDateStr, endDateStr })
    console.log('Dashboard API: All occurrences (extended) count:', allTaskOccurrences.length)
    console.log('Dashboard API: Window occurrences (7d) count:', tasksWithDynamicStatus.length)
    console.log('Dashboard API: Today overdue tasks (actual):', todayOverdueTasksActual.length, '| all currently overdue across positions:', todayOverdueAcrossPositions)
    console.log('Dashboard API: Missed tasks (7 days, appear-today) count:', missedTasksLast7Days.length)

    // On-time completion rate (completed_at must be on/before AUS due date AND due time)
    const onTimeCompletions = completedTasks.filter(task => {
      if (!task.completed_at || !task.due_date) return false
      try {
        // Prefer task-specific due_time if present; otherwise fall back to 23:59:59
        const dueTime = task.master_tasks?.due_time || '23:59:59'
        const ausDueDateTime = createAustralianDateTime(task.due_date as string, dueTime)
        const ausDueDateTimeUtc = fromAustralianTime(ausDueDateTime)
        const completedUtc = new Date(task.completed_at as string)
        return completedUtc <= ausDueDateTimeUtc
      } catch (error) {
        console.error('Error calculating on-time completion:', error)
        return false
      }
    })

    const onTimeCompletionRate = completedTasks.length > 0
      ? Math.round((onTimeCompletions.length / completedTasks.length) * 100 * 100) / 100
      : 0

    // Average time to complete (in hours)
    const completionTimes = completedTasks
      .filter(task => task.completed_at && task.instance_date)
      .map(task => {
        try {
          // Task becomes available at start of instance_date (00:00) in Australia/Sydney
          const availableAus = createAustralianDateTime(task.instance_date as string, '00:00')
          const availableUtc = fromAustralianTime(availableAus)
          // completed_at stored in UTC
          const completedUtc = new Date(task.completed_at as string)

          const hoursToComplete = (completedUtc.getTime() - availableUtc.getTime()) / (1000 * 60 * 60)
          return Math.abs(hoursToComplete)
        } catch (error) {
          console.error('Error calculating completion time:', error)
          return 0
        }
      })

    const avgTimeToComplete = completionTimes.length > 0
      ? Math.round((completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length) * 100) / 100
      : 0

    // Tasks created since 9am today
    const nineAmToday = createAustralianDateTime(todayStr, '09:00')
    const nineAmTodayUtc = fromAustralianTime(nineAmToday)
    const newSince9am = tasksWithDynamicStatus.filter(task => {
      if (!task.created_at) return false
      try {
        const createdUtc = new Date(task.created_at as string)
        return createdUtc >= nineAmTodayUtc
      } catch (error) {
        return false
      }
    }).length

    // Category breakdown
    const categories: Record<string, { total: number; completed: number; missed: number; overdue: number }> = {}
    tasksWithDynamicStatus.forEach(task => {
      const category = task.master_tasks?.categories?.[0] || 'general'
      if (!categories[category]) {
        categories[category] = { total: 0, completed: 0, missed: 0, overdue: 0 }
      }
      categories[category].total++
      if (task.dynamicStatus === 'completed') categories[category].completed++
      if (task.dynamicStatus === 'missed') categories[category].missed++
      if (task.dynamicStatus === 'overdue') categories[category].overdue++
    })

    // Recent tasks (last 5 completed or missed)
    const recentTasks = tasksWithDynamicStatus
      .filter(task => ['completed', 'missed'].includes(task.dynamicStatus))
      .sort((a, b) => {
        const aTime = a.completed_at || a.created_at || '1970-01-01'
        const bTime = b.completed_at || b.created_at || '1970-01-01'
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      .slice(0, 5)
      .map(task => ({
        id: task.id,
        title: task.master_tasks?.title || 'Unknown Task',
        status: task.dynamicStatus,
        date: task.instance_date || task.due_date,
        completedAt: task.completed_at
      }))

    const response = {
      summary: {
        totalTasks: tasksWithDynamicStatus.length,
        completedTasks: completedTasks.length,
        onTimeCompletionRate,
        avgTimeToCompleteHours: avgTimeToComplete,
        newSince9am,
        missedLast7Days: missedTasksLast7Days.length,
        // Show current operational overdue count (aligns with homepage checklists and widget description)
        overdueTasks: todayOverdueAcrossPositions
      },
      today: {
        total: todayTasks.length,
        completed: todayTasks.filter(t => t.dynamicStatus === 'completed').length,
        pending: todayTasks.filter(t => ['not_due_yet', 'due_today', 'pending'].includes(t.dynamicStatus)).length,
        // Align with checklist widget: use aggregated per-position overdue for today's operational view
        overdue: todayOverdueAcrossPositions,
        missed: todayTasks.filter(t => t.dynamicStatus === 'missed').length
      },
      categories,
      recentTasks
    }

    console.log('Dashboard API: Returning response:', {
      totalTasks: response.summary.totalTasks,
      completedTasks: response.summary.completedTasks,
      missedTasks: response.summary.missedLast7Days,
      overdueTasks: response.summary.overdueTasks,
      todayOverdue: response.today.overdue,
      todayTotal: response.today.total
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dashboard API: Unexpected error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}