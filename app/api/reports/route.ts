import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getResponsibilityForPosition } from '@/lib/position-utils'
import { 
  createAustralianDateTime, 
  fromAustralianTime, 
  getAustralianDateRange, 
  isAustralianTimePast,
  parseAustralianDate,
  formatAustralianDate,
  toAustralianTime,
  getAustralianNow
} from '@/lib/timezone-utils'
import { NewRecurrenceEngine, NewFrequencyType, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { HolidayChecker } from '@/lib/holiday-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

// Convert string frequencies to NewFrequencyType enum values
function convertStringFrequenciesToEnum(frequencies: string[]): NewFrequencyType[] {
  const frequencyMap: { [key: string]: NewFrequencyType } = {
    'once_off': NewFrequencyType.ONCE_OFF,
    'every_day': NewFrequencyType.EVERY_DAY,
    'once_weekly': NewFrequencyType.ONCE_WEEKLY,
    'weekly': NewFrequencyType.ONCE_WEEKLY, // Legacy mapping
    'monday': NewFrequencyType.MONDAY,
    'tuesday': NewFrequencyType.TUESDAY,
    'wednesday': NewFrequencyType.WEDNESDAY,
    'thursday': NewFrequencyType.THURSDAY,
    'friday': NewFrequencyType.FRIDAY,
    'saturday': NewFrequencyType.SATURDAY,
    'once_monthly': NewFrequencyType.ONCE_MONTHLY,
    'start_of_every_month': NewFrequencyType.START_OF_EVERY_MONTH,
    'start_every_month': NewFrequencyType.START_OF_EVERY_MONTH, // Legacy mapping
    'end_every_month': NewFrequencyType.END_OF_EVERY_MONTH, // Legacy mapping
    'start_of_month_jan': NewFrequencyType.START_OF_MONTH_JAN,
    'start_of_month_feb': NewFrequencyType.START_OF_MONTH_FEB,
    'start_of_month_mar': NewFrequencyType.START_OF_MONTH_MAR,
    'start_of_month_apr': NewFrequencyType.START_OF_MONTH_APR,
    'start_of_month_may': NewFrequencyType.START_OF_MONTH_MAY,
    'start_of_month_jun': NewFrequencyType.START_OF_MONTH_JUN,
    'start_of_month_jul': NewFrequencyType.START_OF_MONTH_JUL,
    'start_of_month_aug': NewFrequencyType.START_OF_MONTH_AUG,
    'start_of_month_sep': NewFrequencyType.START_OF_MONTH_SEP,
    'start_of_month_oct': NewFrequencyType.START_OF_MONTH_OCT,
    'start_of_month_nov': NewFrequencyType.START_OF_MONTH_NOV,
    'start_of_month_dec': NewFrequencyType.START_OF_MONTH_DEC,
    'end_of_every_month': NewFrequencyType.END_OF_EVERY_MONTH,
    'end_of_month_jan': NewFrequencyType.END_OF_MONTH_JAN,
    'end_of_month_feb': NewFrequencyType.END_OF_MONTH_FEB,
    'end_of_month_mar': NewFrequencyType.END_OF_MONTH_MAR,
    'end_of_month_apr': NewFrequencyType.END_OF_MONTH_APR,
    'end_of_month_may': NewFrequencyType.END_OF_MONTH_MAY,
    'end_of_month_jun': NewFrequencyType.END_OF_MONTH_JUN,
    'end_of_month_jul': NewFrequencyType.END_OF_MONTH_JUL,
    'end_of_month_aug': NewFrequencyType.END_OF_MONTH_AUG,
    'end_of_month_sep': NewFrequencyType.END_OF_MONTH_SEP,
    'end_of_month_oct': NewFrequencyType.END_OF_MONTH_OCT,
    'end_of_month_nov': NewFrequencyType.END_OF_MONTH_NOV,
    'end_of_month_dec': NewFrequencyType.END_OF_MONTH_DEC,
    // Additional legacy mappings
    'once_off_sticky': NewFrequencyType.ONCE_OFF,
    'specific_weekdays': NewFrequencyType.ONCE_WEEKLY, // This will need special handling for weekdays
    'monthly': NewFrequencyType.ONCE_MONTHLY // Legacy mapping
  }

  const converted = frequencies
    .map(freq => frequencyMap[freq])
    .filter(Boolean)
  

  
  return converted
}

// Build responsibility variants to match DB values
function buildResponsibilityVariants(name?: string | null, displayName?: string | null): string[] {
  const set = new Set<string>()
  const add = (v?: string | null) => {
    if (!v) return
    const raw = v.trim()
    if (!raw) return
    set.add(raw)
    const lower = raw.toLowerCase()
    set.add(lower)
    const kebab = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    set.add(kebab)
    set.add(kebab.replace(/-/g, '_'))
    set.add(kebab.replace(/-/g, ' '))
  }
  add(name)
  add(displayName)
  return Array.from(set)
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const reportType = searchParams.get('type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const positionId = searchParams.get('position_id')
    const category = searchParams.get('category')

    switch (reportType) {
      case 'completion-rate':
        return await getCompletionRateReport(startDate, endDate, positionId, category)
      
      case 'average-completion-time':
        return await getAverageCompletionTimeReport(startDate, endDate, positionId, category)
      
      case 'missed-tasks':
        return await getMissedTasksReport(startDate, endDate, positionId, category)
      
      case 'missed-by-position':
        return await getMissedTasksByPositionReport(startDate, endDate, category)
      
      case 'outstanding-tasks':
        return await getOutstandingTasksReport(startDate, endDate, positionId, category)
      
      case 'task-summary':
        return await getTaskSummaryReport(startDate, endDate, positionId, category)
      
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Generate task occurrences for the date range using the same logic as checklist API
async function generateTaskOccurrences(startDate: string, endDate: string, positionId?: string | null, category?: string | null) {
  // Get holidays for the recurrence engine
  const { data: holidays } = await supabaseServer
    .from('public_holidays')
    .select('date, name')
    .order('date')

  // Create the recurrence engine
  const holidayChecker = new HolidayChecker(holidays || [])
  const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)

  // Get date range
  const startDateObj = parseAustralianDate(startDate)
  const endDateObj = parseAustralianDate(endDate)
  const dateRange = getAustralianDateRange(startDateObj, endDateObj)

  // Generate task occurrences for each date in the range
  const taskOccurrences: Array<{
    masterTaskId: string
    title: string
    description: string
    categories: string[]
    responsibility: string[]
    date: string
    status: string
    completedAt?: string
    dueTime?: string
  }> = []

  // Process each date in the range
  for (const dateStr of dateRange) {
    // Build master_tasks query for this date
    let taskQuery = supabaseServer
      .from('master_tasks')
      .select(`
        id,
        title,
        description,
        responsibility,
        categories,
        publish_status,
        publish_delay,
        start_date,
        end_date,
        due_date,
        due_time,
        frequencies,
        timing,
        created_at,
        updated_at
      `)
      .eq('publish_status', 'active')

    // Apply position filter if specified
    if (positionId) {
      const responsibilityValue = await getResponsibilityForPosition(positionId)
      if (responsibilityValue) {
        const responsibilityVariants = buildResponsibilityVariants(responsibilityValue, responsibilityValue)
        taskQuery = taskQuery.overlaps('responsibility', responsibilityVariants)
      }
    }

    const { data: masterTasks, error: tasksError } = await taskQuery
    if (tasksError) {
      console.error('Reports: error fetching master tasks', tasksError)
      throw new Error('Failed to fetch master tasks')
    }

    // Apply category filter in memory (after DB query)
    const filteredTasks = (masterTasks || []).filter(task => {
      if (category && category !== 'all') {
        const categories = task.categories || []
        return categories.includes(category)
      }
      return true
    })

    // Filter tasks based on recurrence rules and date (using same logic as checklist API)
    const tasksForDate = filteredTasks.filter(task => {
      try {
        // Server-side visibility window enforcement (same as checklist API)
        let visibilityStart: Date | null = null
        let visibilityEnd: Date | null = null
        try {
          const createdAtIso = task.created_at as string | undefined
          const publishDelay = task.publish_delay as string | undefined // YYYY-MM-DD
          const startDate = (task as any).start_date as string | undefined // YYYY-MM-DD
          const endDate = (task as any).end_date as string | undefined // YYYY-MM-DD

          const startCandidates: Date[] = []
          if (createdAtIso) {
            const createdAtAU = toAustralianTime(new Date(createdAtIso))
            startCandidates.push(parseAustralianDate(formatAustralianDate(createdAtAU)))
          }
          if (publishDelay) startCandidates.push(parseAustralianDate(publishDelay))
          if (startDate) startCandidates.push(parseAustralianDate(startDate))
          if (startCandidates.length > 0) visibilityStart = new Date(Math.max(...startCandidates.map(d => d.getTime())))
          if (endDate) visibilityEnd = parseAustralianDate(endDate)
        } catch {}

        const viewDate = parseAustralianDate(dateStr)
        if (visibilityStart && viewDate < visibilityStart) return false
        if (visibilityEnd && viewDate > visibilityEnd) return false

        // Convert task to NewMasterTask format for new engine
        const masterTask: NewMasterTask = {
          id: task.id,
          title: task.title || '',
          description: task.description || '',
          responsibility: task.responsibility || [],
          categories: task.categories || [],
          // Normalize legacy monthly frequency aliases to engine enums (same as checklist API)
          frequencies: ((task.frequencies || []) as any).map((f: string) =>
            f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
            : f === 'every_month' ? 'once_monthly'
            : f === 'end_every_month' ? 'end_of_every_month'
            : f
          ) as any,
          timing: task.timing || 'anytime_during_day',
          active: task.publish_status === 'active',
          publish_delay: task.publish_delay || undefined,
          due_date: task.due_date || undefined,
          due_time: task.due_time || undefined,
          created_at: task.created_at || undefined,
          start_date: (task as any).start_date || undefined,
          end_date: (task as any).end_date || undefined,
        }

        return recurrenceEngine.shouldTaskAppearOnDate(masterTask, dateStr)
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return true // Default to showing the task if there's an error
      }
    })

    // Get existing task instances for this date
    const masterTaskIds = tasksForDate.map(task => task.id)
    let existingInstances: any[] = []
    let positionCompletions: any[] = []
    
    if (masterTaskIds.length > 0) {
      // Look back for carryover instances (same as checklist API)
      const viewDate = parseAustralianDate(dateStr)
      const searchStartDate = new Date(viewDate)
      searchStartDate.setDate(viewDate.getDate() - 60) // Look back 60 days for any carryover instances
      
      // Get task instances
      const { data, error: instancesError } = await supabaseServer
        .from('task_instances')
        .select('id, master_task_id, status, completed_by, completed_at, created_at, instance_date, due_date')
        .in('master_task_id', masterTaskIds)
        .gte('instance_date', formatAustralianDate(searchStartDate))
        .lte('instance_date', dateStr)

      if (!instancesError && data) {
        existingInstances = data
      }

      // Get position-specific completions if we have instances
      if (existingInstances.length > 0) {
        const instanceIds = existingInstances.map(inst => inst.id)
        const { data: completionsData, error: completionsError } = await supabaseServer
          .from('task_position_completions')
          .select(`
            task_instance_id,
            position_id,
            position_name,
            completed_by,
            completed_at,
            is_completed,
            positions!inner(name)
          `)
          .in('task_instance_id', instanceIds)
          .eq('is_completed', true)

        if (!completionsError && completionsData) {
          positionCompletions = completionsData
        }
      }
    }

    // Create maps for quick lookup (same as checklist API)
    const instanceMap = new Map<string, any>()
    const completionsByInstanceMap = new Map<string, any[]>()
    
    if (existingInstances.length > 0) {
      // For each master task, find the most relevant instance
      const taskInstanceGroups = new Map<string, any[]>()
      
      existingInstances.forEach(instance => {
        const taskId = instance.master_task_id
        if (!taskInstanceGroups.has(taskId)) {
          taskInstanceGroups.set(taskId, [])
        }
        taskInstanceGroups.get(taskId)!.push(instance)
      })
      
      taskInstanceGroups.forEach((instances, taskId) => {
        // Sort instances by relevance (same logic as checklist API)
        const sortedInstances = instances.sort((a, b) => {
          // First priority: completed instances (status = 'done')
          if (a.status === 'done' && b.status !== 'done') return -1
          if (b.status === 'done' && a.status !== 'done') return 1
          
          // Second priority: exact date match (for non-completed instances)
          if (a.instance_date === dateStr && b.instance_date !== dateStr) return -1
          if (b.instance_date === dateStr && a.instance_date !== dateStr) return 1
          
          // Third priority: most recent instance_date
          return new Date(b.instance_date).getTime() - new Date(a.instance_date).getTime()
        })
        
        instanceMap.set(taskId, sortedInstances[0])
      })
    }
    
    if (positionCompletions.length > 0) {
      positionCompletions.forEach(completion => {
        const instanceId = completion.task_instance_id
        if (!completionsByInstanceMap.has(instanceId)) {
          completionsByInstanceMap.set(instanceId, [])
        }
        completionsByInstanceMap.get(instanceId)!.push(completion)
      })
    }

    // Calculate status for each task using the same logic as checklist API
    const now = getAustralianNow()
    
    for (const task of tasksForDate) {
      const existingInstance = instanceMap.get(task.id)
      const taskCompletions = existingInstance ? completionsByInstanceMap.get(existingInstance.id) || [] : []
      
      // Determine if task is completed by any position (for reports, we consider any completion)
      let isCompletedByAnyPosition = false
      if (existingInstance && taskCompletions.length > 0) {
        isCompletedByAnyPosition = true
      }

      // Convert task to NewMasterTask format for status calculation
      const masterTaskForStatus: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        frequencies: ((task.frequencies || []) as any).map((f: string) =>
          f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
          : f === 'every_month' ? 'once_monthly'
          : f === 'end_every_month' ? 'end_of_every_month'
          : f
        ) as any,
        timing: task.timing || 'anytime_during_day',
        active: task.publish_status === 'active',
        publish_delay: task.publish_delay || undefined,
        due_date: task.due_date || undefined,
        due_time: task.due_time || undefined,
        created_at: task.created_at || undefined,
        start_date: (task as any).start_date || undefined,
        end_date: (task as any).end_date || undefined,
      }

      // Calculate proper status using recurrence engine (same as checklist API)
      const statusResult = recurrenceEngine.calculateTaskStatus(masterTaskForStatus, dateStr, now, isCompletedByAnyPosition)
      
      // Map status to match expected format
      let status = 'due_today'
      switch (statusResult.status) {
        case 'completed':
          status = 'done'
          break
        case 'not_due_yet':
          status = 'not_due'
          break
        case 'due_today':
          status = 'due_today'
          break
        case 'overdue':
          status = 'overdue'
          break
        case 'missed':
          status = 'missed'
          break
        default:
          status = 'due_today'
      }

      taskOccurrences.push({
        masterTaskId: task.id,
        title: task.title || '',
        description: task.description || '',
        categories: task.categories || [],
        responsibility: task.responsibility || [],
        date: dateStr,
        status,
        completedAt: existingInstance?.completed_at,
        dueTime: task.due_time
      })
    }
  }

  return taskOccurrences
}

async function getCompletionRateReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)

    const totalTasks = taskOccurrences.length
    const completedTasks = taskOccurrences.filter(task => task.status === 'done').length
    
    const onTimeCompletions = taskOccurrences.filter(task => {
      if (!(task.status === 'done' && task.completedAt)) return false
      
      // Check if completed on time (by end of the due date)
      const ausEndOfDay = createAustralianDateTime(task.date, '23:59:59')
      const ausEndOfDayUtc = fromAustralianTime(ausEndOfDay)
      const completedUtc = new Date(task.completedAt)
      return completedUtc <= ausEndOfDayUtc
    }).length

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const onTimeRate = completedTasks > 0 ? (onTimeCompletions / completedTasks) * 100 : 0

    return NextResponse.json({
      totalTasks,
      completedTasks,
      onTimeCompletions,
      completionRate: Math.round(completionRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100
    })
  } catch (error) {
    console.error('Error in getCompletionRateReport:', error)
    return NextResponse.json({ error: 'Failed to fetch completion rate data' }, { status: 500 })
  }
}

async function getTaskSummaryReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)

    // Count by status
    const statusCounts = {
      done: 0,
      overdue: 0,
      missed: 0,
      due_today: 0,
      not_due: 0
    }

    taskOccurrences.forEach(task => {
      if (statusCounts.hasOwnProperty(task.status)) {
        statusCounts[task.status as keyof typeof statusCounts]++
      } else {
        statusCounts.due_today++ // Default for unknown statuses
      }
    })

    return NextResponse.json({
      totalTasks: taskOccurrences.length,
      statusCounts
    })
  } catch (error) {
    console.error('Error in getTaskSummaryReport:', error)
    return NextResponse.json({ error: 'Failed to fetch task summary data' }, { status: 500 })
  }
}

async function getMissedTasksReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const missedTasks = taskOccurrences.filter(task => task.status === 'missed')

    return NextResponse.json({
      totalMissedTasks: missedTasks.length,
      missedTasks: missedTasks.map(task => ({
        id: `${task.masterTaskId}:${task.date}`,
        due_date: task.date,
        master_tasks: {
          title: task.title,
          description: task.description,
          categories: task.categories,
          responsibility: task.responsibility
        }
      }))
    })
  } catch (error) {
    console.error('Error in getMissedTasksReport:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks data' }, { status: 500 })
  }
}

async function getMissedTasksByPositionReport(startDate?: string | null, endDate?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    // Get all positions
    const { data: positions } = await supabaseServer
      .from('positions')
      .select('id, name')
      .neq('name', 'Administrator')

    const positionStats: Record<string, number> = {}

    // Generate missed tasks for each position
    for (const position of positions || []) {
      const taskOccurrences = await generateTaskOccurrences(startDate, endDate, position.id, category)
      const missedCount = taskOccurrences.filter(task => task.status === 'missed').length
      positionStats[position.name] = missedCount
    }

    return NextResponse.json({
      totalMissedTasks: Object.values(positionStats).reduce((sum, count) => sum + count, 0),
      positionStats
    })
  } catch (error) {
    console.error('Error in getMissedTasksByPositionReport:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks by position data' }, { status: 500 })
  }
}

async function getOutstandingTasksReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const outstandingTasks = taskOccurrences.filter(task => 
      task.status === 'overdue' || task.status === 'missed'
    )

    return NextResponse.json({
      totalOutstandingTasks: outstandingTasks.length,
      outstandingTasks: outstandingTasks.map(task => ({
        id: `${task.masterTaskId}:${task.date}`,
        status: task.status,
        due_date: task.date,
        master_tasks: {
          title: task.title,
          description: task.description,
          categories: task.categories,
          responsibility: task.responsibility
        }
      }))
    })
  } catch (error) {
    console.error('Error in getOutstandingTasksReport:', error)
    return NextResponse.json({ error: 'Failed to fetch outstanding tasks data' }, { status: 500 })
  }
}

async function getAverageCompletionTimeReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const completedTasks = taskOccurrences.filter(task => 
      task.status === 'done' && task.completedAt
    )

    if (completedTasks.length === 0) {
      return NextResponse.json({
        averageCompletionTimeHours: 0,
        totalCompletedTasks: 0
      })
    }

    // Calculate average completion time (simplified - could be enhanced)
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      if (!task.completedAt) return sum
      
      // Calculate time from due date to completion
      const dueDateTime = createAustralianDateTime(task.date, task.dueTime || '09:00')
      const completedDateTime = new Date(task.completedAt)
      const diffHours = (completedDateTime.getTime() - dueDateTime.getTime()) / (1000 * 60 * 60)
      
      return sum + Math.max(0, diffHours) // Only count positive completion times
    }, 0)

    const averageCompletionTimeHours = totalCompletionTime / completedTasks.length

    return NextResponse.json({
      averageCompletionTimeHours: Math.round(averageCompletionTimeHours * 100) / 100,
      totalCompletedTasks: completedTasks.length
    })
  } catch (error) {
    console.error('Error in getAverageCompletionTimeReport:', error)
    return NextResponse.json({ error: 'Failed to fetch average completion time data' }, { status: 500 })
  }
}