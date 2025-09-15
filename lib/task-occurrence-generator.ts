import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, NewFrequencyType, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { HolidayChecker } from '@/lib/holiday-checker'
import { getSearchOptions, toKebabCase } from '@/lib/responsibility-mapper'
import { calculateTaskStatus, setHolidays, type TaskStatusInput } from '@/lib/task-status-calculator'
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

// Convert responsibility name to position name format used in task_position_completions table
function convertResponsibilityToPositionName(responsibility: string): string {
  // The task_position_completions table stores position_name in kebab-case format
  // Always normalize incoming responsibility to kebab-case first
  const slug = toKebabCase((responsibility || '').trim())
  const responsibilityToPositionMap: { [key: string]: string } = {
    'pharmacy-assistant': 'pharmacy-assistant',
    'pharmacy-assistant-s': 'pharmacy-assistant',
    'dispensary-technician': 'dispensary-technician',
    'dispensary-technician-s': 'dispensary-technician',
    'daa-packer': 'daa-packer',
    'daa-packer-s': 'daa-packer',
    'pharmacist-primary': 'pharmacist-primary',
    'pharmacist-supporting': 'pharmacist-supporting',
    'operational-managerial': 'operational-managerial'
  }

  return responsibilityToPositionMap[slug] || slug
}

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
  // Get holidays for the recurrence engine and task status calculator
  const { data: holidays } = await supabaseAdmin
    .from('public_holidays')
    .select('date, name')
    .order('date')

  // Set up holidays for task status calculator
  const holidaySet = new Set((holidays || []).map(h => h.date))
  setHolidays(holidaySet)

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
  // FIXED: Get ALL task instances first, then filter by master task IDs that match position
  const masterTaskIds = filteredTasks.map(t => t.id)
  let existingInstances: any[] = []

  const lookbackStart = new Date(startDate + 'T00:00:00')
  lookbackStart.setDate(lookbackStart.getDate() - 60)
  const lookbackStartStr = formatAustralianDate(lookbackStart)



  // Get task instances in date range, filtered by relevant master_task_ids at DB level for performance
  const { data: allInstancesInRange, error: instancesError } = await supabaseAdmin
    .from('task_instances')
    .select('id, master_task_id, status, completed_by, completed_at, created_at, instance_date, due_date')
    .gte('instance_date', lookbackStartStr)
    .lte('instance_date', endDate)
    .in('master_task_id', masterTaskIds)

  if (instancesError) {
    console.error('Error querying task instances:', instancesError)
  } else if (allInstancesInRange) {
    existingInstances = allInstancesInRange
  }

  // Build position-specific completion lookup
  const instanceIds = existingInstances.map(i => i.id)
  const positionCompletionByInstance = new Map<string, { completed_at: string }>()
  const positionSpecificCompletions = new Map<string, Map<string, { completed_at: string, is_completed: boolean }>>()

  if (instanceIds.length > 0) {
    const { data: posCompletions, error: posCompError } = await supabaseAdmin
      .from('task_position_completions')
      .select('task_instance_id, position_name, completed_at, is_completed')
      .in('task_instance_id', instanceIds)

    if (posCompError) {
      console.error('Error querying position completions:', posCompError)
    } else if (Array.isArray(posCompletions)) {
      posCompletions.forEach(pc => {
        const instanceId = pc.task_instance_id as string
        const positionName = pc.position_name as string
        const completedAt = pc.completed_at as string
        const isCompleted = pc.is_completed as boolean

        // Store position-specific completion data
        if (!positionSpecificCompletions.has(instanceId)) {
          positionSpecificCompletions.set(instanceId, new Map())
        }
        positionSpecificCompletions.get(instanceId)!.set(positionName, {
          completed_at: completedAt,
          is_completed: isCompleted
        })

        // Also maintain the general completion lookup for backward compatibility
        if (isCompleted) {
          const key = instanceId
          if (!positionCompletionByInstance.has(key)) {
            positionCompletionByInstance.set(key, { completed_at: completedAt })
          } else {
            const existing = positionCompletionByInstance.get(key)!
            if (new Date(completedAt).getTime() < new Date(existing.completed_at).getTime()) {
              positionCompletionByInstance.set(key, { completed_at: completedAt })
            }
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
  let completedInstancesCount = 0
  existingInstances.forEach(inst => {
    const hasPositionCompletion = positionCompletionByInstance.has(inst.id)
    if (inst.status === 'done' || hasPositionCompletion) {
      completedInstancesCount++
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
      } catch { }

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

      // Determine completion status
      // Only mark as completed if there's an actual task instance for this specific date
      // This matches the checklist behavior and avoids false carryover completions
      const isCompleted = existingInstance?.status === 'done' ||
        (existingInstance && positionCompletionByInstance.has(existingInstance.id))



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

      // Get base status result from recurrence engine for due/lock dates
      const baseStatusResult = recurrenceEngine.calculateTaskStatus(masterTask, dateStr, now, false)

      // Use the shared task status calculator for consistent status calculation
      // Create TaskStatusInput for the shared calculator
      const taskStatusInput: TaskStatusInput = {
        date: dateStr,
        due_date: baseStatusResult.dueDate,
        master_task: {
          due_time: task.due_time || undefined,
          created_at: task.created_at || undefined,
          publish_delay: task.publish_delay || undefined,
          start_date: (task as any).start_date || undefined,
          end_date: (task as any).end_date || undefined,
          frequencies: task.frequencies || undefined,
        },
        detailed_status: undefined,
        is_completed_for_position: false,
        status: undefined,
        lock_date: baseStatusResult.lockDate || undefined,
        lock_time: baseStatusResult.lockTime || undefined,
      }

      // Calculate status using the shared calculator
      const baseDynamicStatus = calculateTaskStatus(taskStatusInput, dateStr)

      // Prefer position-specific completion timestamp when present
      const effectiveCompletedAt = existingInstance?.completed_at || (existingInstance ? positionCompletionByInstance.get(existingInstance.id)?.completed_at : undefined)

      // When no position filter is applied, generate one occurrence per responsibility
      if (!positionId && task.responsibility && task.responsibility.length > 0) {
        // Generate separate occurrence for each responsibility/position
        for (const responsibility of task.responsibility) {
          // Convert responsibility to position name format for lookup
          const positionName = convertResponsibilityToPositionName(responsibility)

          // Check if this specific position completed the task
          let positionSpecificCompleted = false
          let positionSpecificCompletedAt = null

          if (existingInstance && positionSpecificCompletions.has(existingInstance.id)) {
            const positionCompletions = positionSpecificCompletions.get(existingInstance.id)!
            const positionCompletion = positionCompletions.get(positionName)

            if (positionCompletion && positionCompletion.is_completed) {
              positionSpecificCompleted = true
              positionSpecificCompletedAt = positionCompletion.completed_at
            }
          }

          // Calculate status for this specific position using shared calculator
          let positionStatus = baseDynamicStatus
          if (positionSpecificCompleted) {
            // Create TaskStatusInput for position-specific completion
            const positionTaskStatusInput: TaskStatusInput = {
              date: dateStr,
              due_date: baseStatusResult.dueDate,
              master_task: {
                due_time: task.due_time || undefined,
                created_at: task.created_at || undefined,
                publish_delay: task.publish_delay || undefined,
                start_date: (task as any).start_date || undefined,
                end_date: (task as any).end_date || undefined,
                frequencies: task.frequencies || undefined,
              },
              detailed_status: undefined,
              is_completed_for_position: true,
              status: undefined,
              lock_date: baseStatusResult.lockDate || undefined,
              lock_time: baseStatusResult.lockTime || undefined,
            }
            positionStatus = calculateTaskStatus(positionTaskStatusInput, dateStr)
          }

          taskOccurrences.push({
            masterTaskId: task.id,
            title: task.title,
            description: task.description || '',
            categories: task.categories || [],
            responsibility: [responsibility], // Single responsibility for this occurrence
            date: dateStr,
            status: positionStatus,
            completedAt: positionSpecificCompletedAt,
            dueTime: task.due_time
          })
        }
      } else {
        // When position filter is applied, generate single occurrence (existing behavior)
        // Do NOT treat any-position completion as completed when a specific position is filtered unless that position completed it.
        let finalStatus = baseDynamicStatus
        let finalCompletedAt = effectiveCompletedAt || null

        if (positionId) {
          // Check the selected position's display name -> map to kebab-case -> lookup completion for this instance only for that position
          try {
            const { data: pos } = await supabaseAdmin
              .from('positions')
              .select('name')
              .eq('id', positionId)
              .maybeSingle()
            if (pos && existingInstance && positionSpecificCompletions.has(existingInstance.id)) {
              const positionName = convertResponsibilityToPositionName(toKebabCase(pos.name))
              const posMap = positionSpecificCompletions.get(existingInstance.id)!
              const posComp = posMap.get(positionName)
              if (posComp && posComp.is_completed) {
                finalStatus = 'completed'
                finalCompletedAt = posComp.completed_at
              }
            }
          } catch { }
        } else if (isCompleted) {
          // No position selected: only set completed if the instance is marked done (all-position completion semantics are handled per-responsibility above)
          finalStatus = 'completed'
        }

        taskOccurrences.push({
          masterTaskId: task.id,
          title: task.title,
          description: task.description || '',
          categories: task.categories || [],
          responsibility: task.responsibility || [],
          date: dateStr,
          status: finalStatus,
          completedAt: finalCompletedAt,
          dueTime: task.due_time
        })
      }
    }
  }

  return taskOccurrences
}