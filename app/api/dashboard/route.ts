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

// Simple in-memory cache for KPI and overdue data
const kpiCache = new Map()
const overdueCache = new Map()
const KPI_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const OVERDUE_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes (shorter for more frequent updates)

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

    // Generate task occurrences for the extended date range to track when tasks first became missed
    const allTaskOccurrences = await generateTaskOccurrences(extendedStartDateStr, endDateStr, positionId)

    // Filter to get only the last 7 days for main dashboard stats
    const taskOccurrences = allTaskOccurrences.filter(occ => occ.date >= startDateStr)

    // Handle case where no task occurrences exist
    if (!taskOccurrences || taskOccurrences.length === 0) {
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

    // Calculate metrics directly from task occurrence data for better performance
    // This avoids multiple API calls and provides faster loading
    const completedTasks = tasksWithDynamicStatus.filter(task => task.dynamicStatus === 'completed')
    const completedTasksAcrossPositions = completedTasks.length
    const totalTasksAcrossPositions = tasksWithDynamicStatus.length

    // Calculate new tasks (tasks that appeared today and are not completed)
    const todayTasksForNewCount = tasksWithDynamicStatus.filter(task => task.instance_date === todayStr)
    const newTasksAcrossPositions = todayTasksForNewCount.filter(task =>
      task.dynamicStatus !== 'completed' && task.dynamicStatus !== 'missed'
    ).length



    // Filter today's tasks for additional calculations
    const todayTasksFiltered = tasksWithDynamicStatus.filter(task => task.instance_date === todayStr)

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
    const todayOverdueTasksActual = todayTasksFiltered.filter(t => t.dynamicStatus === 'overdue')

    // Get overdue count with caching for better performance
    let todayOverdueAcrossPositions = 0

    // Check cache first - include current 10-minute window for frequent updates
    const currentTenMinutes = Math.floor(Date.now() / (10 * 60 * 1000))
    const overdueCacheKey = `overdue-${todayStr}-${currentTenMinutes}`
    const cachedOverdue = overdueCache.get(overdueCacheKey)

    if (cachedOverdue && (Date.now() - cachedOverdue.timestamp) < OVERDUE_CACHE_DURATION) {
      todayOverdueAcrossPositions = cachedOverdue.count
    } else {
      try {
        const { data: positions } = await supabaseAdmin
          .from('positions')
          .select('id, name')
        const nonAdminPositions = (positions || []).filter(p => (p.name || '') !== 'Administrator')

        // Build absolute origin for internal fetches
        const origin = (() => {
          try { return new URL(request.url).origin } catch { return '' }
        })()

        // Get overdue count for each position using the same API the homepage uses
        const perPositionOverdueCounts = await Promise.all(
          nonAdminPositions.map(async (pos) => {
            try {
              const roleParam = pos.name
              const urlStr = origin ? `${origin}/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
                : `/api/checklist/counts?role=${encodeURIComponent(roleParam)}&date=${todayStr}`
              const res = await fetch(urlStr)
              if (!res.ok) {
                console.warn(`Dashboard API: Failed to fetch overdue count for ${pos.name}:`, res.status)
                return 0
              }
              const json = await res.json().catch(() => null)
              if (json && json.success && json.data && typeof json.data.overdue === 'number') {

                return json.data.overdue as number
              }
              return 0
            } catch (inner) {
              console.error(`Dashboard API: Error fetching overdue count for ${pos.name}:`, inner)
              return 0
            }
          })
        )

        todayOverdueAcrossPositions = perPositionOverdueCounts.reduce((a, b) => a + b, 0)

        // Cache the result
        overdueCache.set(overdueCacheKey, {
          count: todayOverdueAcrossPositions,
          timestamp: Date.now()
        })

      } catch (error) {
        console.error('Dashboard API: Error calculating overdue tasks:', error)
        // Fallback to simple count if calculation fails
        todayOverdueAcrossPositions = todayOverdueTasksActual.length
      }
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

    // Calculate on-time completion rate and average time using actual completed task instances
    // Query database directly for accurate KPI calculations with caching
    let onTimeCompletionRate = 0
    let avgTimeToComplete = 0

    // Check cache first - use a more specific cache key that includes current hour
    // This ensures the average time updates as new tasks are completed
    const currentHour = new Date().getHours()
    const cacheKey = `kpi-${startDateStr}-${endDateStr}-${currentHour}`
    const cachedKPI = kpiCache.get(cacheKey)
    if (cachedKPI && (Date.now() - cachedKPI.timestamp) < KPI_CACHE_DURATION) {
      onTimeCompletionRate = cachedKPI.onTimeCompletionRate
      avgTimeToComplete = cachedKPI.avgTimeToComplete
    } else {
      try {
        // Fetch completed task instances with minimal data for better performance
        const { data: completedInstances, error: completedError } = await supabaseAdmin
          .from('task_instances')
          .select(`
          id,
          master_task_id,
          instance_date,
          completed_at
        `)
          .eq('status', 'done')
          .gte('instance_date', startDateStr)
          .lte('instance_date', endDateStr)
          .not('completed_at', 'is', null)

        // Fetch master task data separately for better performance
        let masterTasksData = {}
        if (!completedError && completedInstances && completedInstances.length > 0) {
          const masterTaskIds = [...new Set(completedInstances.map(i => i.master_task_id))]
          const { data: masterTasks } = await supabaseAdmin
            .from('master_tasks')
            .select('id, due_time')
            .in('id', masterTaskIds)

          if (masterTasks) {
            masterTasksData = masterTasks.reduce((acc, task) => {
              acc[task.id] = task
              return acc
            }, {})
          }
        }

        if (completedError) {
          console.error('Dashboard API: Error fetching completed instances:', completedError)
        }

        if (!completedError && completedInstances && completedInstances.length > 0) {
          // Calculate on-time completion rate
          const onTimeCompletions = completedInstances.filter(instance => {
            try {
              // Get due_time from the separate master tasks data
              const masterTask = masterTasksData[instance.master_task_id]
              const dueTime = masterTask?.due_time || '23:59:59'
              const ausDueDateTime = createAustralianDateTime(instance.instance_date as string, dueTime)
              const ausDueDateTimeUtc = fromAustralianTime(ausDueDateTime)
              const completedUtc = new Date(instance.completed_at as string)
              return completedUtc <= ausDueDateTimeUtc
            } catch (error) {
              console.error('Error calculating on-time completion:', error)
              return false
            }
          })

          onTimeCompletionRate = Math.round((onTimeCompletions.length / completedInstances.length) * 100 * 100) / 100

          // Calculate average time to complete (in hours)
          const completionTimes = completedInstances
            .map(instance => {
              try {
                // Task becomes available at start of instance_date (00:00) in Australia/Sydney
                const availableAus = createAustralianDateTime(instance.instance_date as string, '00:00')
                const availableUtc = fromAustralianTime(availableAus)
                // completed_at stored in UTC
                const completedUtc = new Date(instance.completed_at as string)

                const hoursToComplete = (completedUtc.getTime() - availableUtc.getTime()) / (1000 * 60 * 60)
                return Math.abs(hoursToComplete)
              } catch (error) {
                console.error('Error calculating completion time:', error)
                return 0
              }
            })
            .filter(time => time > 0) // Filter out invalid times

          avgTimeToComplete = completionTimes.length > 0
            ? Math.round((completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length) * 100) / 100
            : 0

          // Cache the results
          kpiCache.set(cacheKey, {
            onTimeCompletionRate,
            avgTimeToComplete,
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error('Dashboard API: Error calculating KPIs from completed instances:', error)
      }
    }

    // Use aggregated new tasks count from per-position API calls
    const newSince9am = newTasksAcrossPositions

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
        totalTasks: totalTasksAcrossPositions, // Use per-position aggregated count
        completedTasks: completedTasksAcrossPositions, // Use per-position aggregated count
        onTimeCompletionRate,
        avgTimeToCompleteHours: avgTimeToComplete,
        newSince9am,
        missedLast7Days: missedTasksLast7Days.length,
        // Show current operational overdue count (aligns with homepage checklists and widget description)
        overdueTasks: todayOverdueAcrossPositions
      },
      today: {
        total: todayTasksFiltered.length,
        completed: todayTasksFiltered.filter(t => t.dynamicStatus === 'completed').length,
        pending: todayTasksFiltered.filter(t => ['not_due_yet', 'due_today', 'pending'].includes(t.dynamicStatus)).length,
        // Align with checklist widget: use aggregated per-position overdue for today's operational view
        overdue: todayOverdueAcrossPositions,
        missed: todayTasksFiltered.filter(t => t.dynamicStatus === 'missed').length
      },
      categories,
      recentTasks
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dashboard API: Unexpected error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}