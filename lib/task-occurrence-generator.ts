import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, NewFrequencyType, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { HolidayChecker } from '@/lib/holiday-checker'
import { getSearchOptions, toKebabCase } from '@/lib/responsibility-mapper'
import { 
  getAustralianNow, 
  getAustralianDateRange, 
  formatAustralianDate,
  parseAustralianDate,
  toAustralianTime
} from '@/lib/timezone-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Convert string frequencies to NewFrequencyType enum values
function convertStringFrequenciesToEnum(frequencies: string[]): NewFrequencyType[] {
  const frequencyMap: { [key: string]: NewFrequencyType } = {
    'once_off': NewFrequencyType.ONCE_OFF,
    'every_day': NewFrequencyType.EVERY_DAY,
    'once_weekly': NewFrequencyType.ONCE_WEEKLY,
    'monday': NewFrequencyType.MONDAY,
    'tuesday': NewFrequencyType.TUESDAY,
    'wednesday': NewFrequencyType.WEDNESDAY,
    'thursday': NewFrequencyType.THURSDAY,
    'friday': NewFrequencyType.FRIDAY,
    'saturday': NewFrequencyType.SATURDAY,
    'once_monthly': NewFrequencyType.ONCE_MONTHLY,
    'start_of_every_month': NewFrequencyType.START_OF_EVERY_MONTH,
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
    'end_of_month_dec': NewFrequencyType.END_OF_MONTH_DEC
  }
  
  return frequencies.map(freq => frequencyMap[freq]).filter(Boolean)
}

export interface TaskOccurrence {
  masterTaskId: string
  title: string
  description: string
  categories: string[]
  responsibility: string[]
  date: string
  status: string
  completedAt?: string | null
  dueTime?: string | null
}

export async function generateTaskOccurrences(startDate: string, endDate: string, positionId?: string | null, category?: string | null): Promise<TaskOccurrence[]> {
  // Get holidays for the recurrence engine
  const { data: holidays } = await supabaseAdmin
    .from('public_holidays')
    .select('date, name')
    .order('date')

  // Create the recurrence engine
  const holidayChecker = new HolidayChecker(holidays || [])
  const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)

  // Build master tasks query
  let taskQuery = supabaseAdmin
    .from('master_tasks')
    .select(`
      id,
      title,
      description,
      responsibility,
      categories,
      frequencies,
      due_time,
      timing,
      publish_status,
      publish_delay,
      start_date,
      end_date,
      due_date,
      created_at
    `)
    .eq('publish_status', 'active')

  // Apply position filtering if specified (same logic as Checklist API)
  if (positionId) {
    const { data: position } = await supabaseAdmin
      .from('positions')
      .select('name')
      .eq('id', positionId)
      .maybeSingle()
    
    if (position) {
      // Convert position name to kebab-case and use getSearchOptions (same as Checklist API)
      const normalizedRole = toKebabCase(position.name)
      const searchRoles = getSearchOptions(normalizedRole)
      taskQuery = taskQuery.overlaps('responsibility', searchRoles)
    }
  }

  const { data: masterTasks, error: tasksError } = await taskQuery
  if (tasksError) {
    console.error('Error fetching master tasks:', tasksError)
    return []
  }

  if (!masterTasks || masterTasks.length === 0) {
    return []
  }

  // Apply category filter in memory (after DB query) - same logic as Reports API
  const filteredTasks = masterTasks.filter(task => {
    if (category && category !== 'all') {
      const categories = task.categories || []
      return categories.includes(category)
    }
    return true
  })

  // Generate date range
  const dateRange = getAustralianDateRange(new Date(startDate + 'T00:00:00'), new Date(endDate + 'T23:59:59'))
  const taskOccurrences: TaskOccurrence[] = []

  // Get existing task instances for the date range, with 60-day lookback for carryover completions
  const masterTaskIds = filteredTasks.map(t => t.id)
  let existingInstances: any[] = []

  if (masterTaskIds.length > 0) {
    const lookbackStart = new Date(startDate + 'T00:00:00')
    lookbackStart.setDate(lookbackStart.getDate() - 60)
    const lookbackStartStr = formatAustralianDate(lookbackStart)

    const { data, error: instancesError } = await supabaseAdmin
      .from('task_instances')
      .select('id, master_task_id, status, completed_by, completed_at, created_at, instance_date, due_date, detailed_status')
      .in('master_task_id', masterTaskIds)
      .gte('instance_date', lookbackStartStr)
      .lte('instance_date', endDate)

    if (!instancesError && data) {
      existingInstances = data
    }
  }

  // Build quick lookup for instance-level position completions (any position)
  const instanceIds = existingInstances.map(i => i.id)
  const positionCompletionByInstance = new Map<string, { completed_at: string }>()
  if (instanceIds.length > 0) {
    const { data: posCompletions, error: posCompError } = await supabaseAdmin
      .from('task_position_completions')
      .select('task_instance_id, completed_at, is_completed')
      .in('task_instance_id', instanceIds)
      .eq('is_completed', true)

    if (!posCompError && Array.isArray(posCompletions)) {
      // Keep earliest completion time per instance for consistency
      posCompletions.forEach(pc => {
        const key = pc.task_instance_id as string
        const ts = pc.completed_at as string
        if (!positionCompletionByInstance.has(key)) {
          positionCompletionByInstance.set(key, { completed_at: ts })
        } else {
          const existing = positionCompletionByInstance.get(key)!
          if (new Date(ts).getTime() < new Date(existing.completed_at).getTime()) {
            positionCompletionByInstance.set(key, { completed_at: ts })
          }
        }
      })
    }
  }

  // Create a map of existing instances by master_task_id and date
  const instanceMap = new Map()
  existingInstances.forEach(instance => {
    const key = `${instance.master_task_id}:${instance.instance_date}`
    instanceMap.set(key, instance)
  })

  // Track latest completed instance date per task (for carryover completion logic)
  const latestDoneByTask = new Map<string, { date: string; completed_at: string | null }>()
  existingInstances.forEach(inst => {
    const hasPositionCompletion = positionCompletionByInstance.has(inst.id)
    if (inst.status === 'done' || hasPositionCompletion) {
      const effectiveCompletedAt = inst.completed_at || positionCompletionByInstance.get(inst.id)?.completed_at || null
      const prev = latestDoneByTask.get(inst.master_task_id)
      if (!prev || inst.instance_date > prev.date) {
        latestDoneByTask.set(inst.master_task_id, { date: inst.instance_date, completed_at: effectiveCompletedAt })
      }
    }
  })

  // Generate task occurrences for each date
  for (const dateStr of dateRange) {
    // Get tasks that should appear on this date
    const tasksForDate = filteredTasks.filter(task => {
      // First check visibility window (same logic as Checklist API)
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
      if (visibilityStart && viewDate < visibilityStart) {
        return false
      }
      if (visibilityEnd && viewDate > visibilityEnd) return false

      // Convert to NewMasterTask format (same as Checklist API)
      const masterTask: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        // Normalize legacy monthly frequency aliases to engine enums (same as Checklist API)
        frequencies: convertStringFrequenciesToEnum(((task.frequencies || []) as any).map((f: string) =>
          f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
          : f === 'every_month' ? 'once_monthly'
          : f === 'end_every_month' ? 'end_of_every_month'
          : f
        )),
        timing: (task as any).timing || 'anytime_during_day', // Use timing field like Checklist API
        active: task.publish_status === 'active',
        publish_delay: task.publish_delay || undefined,
        due_date: task.due_date || undefined
      }

      try {
        return recurrenceEngine.shouldTaskAppearOnDate(masterTask, dateStr)
      } catch (error) {
        console.error('Error checking if task should appear:', error)
        return false
      }
    })

    // Generate task occurrences for this date
    for (const task of tasksForDate) {
      const instanceKey = `${task.id}:${dateStr}`
      const existingInstance = instanceMap.get(instanceKey)

      // Calculate dynamic status using the recurrence engine
      const now = getAustralianNow()

      // Determine completion considering carryover: if latest done instance is on or before this date, treat as completed
      const latestDone = latestDoneByTask.get(task.id)
      const isCompleted = existingInstance?.status === 'done' || (latestDone && latestDone.date <= dateStr)
      
      const masterTask: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        // Normalize legacy monthly frequency aliases to engine enums (same as Checklist API)
        frequencies: convertStringFrequenciesToEnum(((task.frequencies || []) as any).map((f: string) =>
          f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
          : f === 'every_month' ? 'once_monthly'
          : f === 'end_every_month' ? 'end_of_every_month'
          : f
        )),
        timing: (task as any).timing || 'anytime_during_day', // Use timing field like Checklist API
        // Pass through the specific due_time so status uses correct threshold
        ...(task as any).due_time ? { due_time: (task as any).due_time } as any : {},
        active: task.publish_status === 'active',
        publish_delay: task.publish_delay || undefined,
        due_date: task.due_date || undefined
      }
      
      const statusResult = recurrenceEngine.calculateTaskStatus(masterTask, dateStr, now, isCompleted)
      const dynamicStatus = statusResult.status

      // Prefer position-specific completion timestamp when present
      const effectiveCompletedAt = existingInstance?.completed_at || (existingInstance ? positionCompletionByInstance.get(existingInstance.id)?.completed_at : undefined)

      taskOccurrences.push({
        masterTaskId: task.id,
        title: task.title,
        description: task.description || '',
        categories: task.categories || [],
        responsibility: task.responsibility || [],
        date: dateStr,
        status: dynamicStatus,
        completedAt: effectiveCompletedAt || null,
        dueTime: task.due_time
      })
    }
  }

  return taskOccurrences
}