import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { createHolidayChecker } from '@/lib/holiday-checker'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase, getSearchOptions } from '@/lib/responsibility-mapper'
import { getAustralianNow, getAustralianToday, createAustralianDateTime, parseAustralianDate, formatAustralianDate, toAustralianTime } from '@/lib/timezone-utils'
import { getSystemSettings } from '@/lib/system-settings'
import { calculateTaskStatusForCounts, setHolidays } from '@/lib/task-status-calculator'

// Use service role key to bypass RLS for server-side reads (match checklist API)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')
    const date = searchParams.get('date')

    // Debug incoming params to help diagnose 400s in client
    console.log('Checklist counts request params:', { role, date })

    // Validate query parameters using Zod schema
    const validationResult = ChecklistQuerySchema.safeParse({ role, date })

    if (!validationResult.success) {
      console.warn('Checklist counts validation failed:', validationResult.error.errors)
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { role: validatedRole, date: validatedDate } = validationResult.data

    // Align with Checklist API: fetch active tasks filtered by role using service client
    const searchRoles = getSearchOptions(validatedRole)

    const { data: masterTasks, error: tasksError } = await supabaseAdmin
      .from('master_tasks')
      .select(`
        id,
        title,
        description,
        timing,
        due_time,
        publish_status,
        publish_delay,
        start_date,
        end_date,
        due_date,
        frequencies,
        responsibility,
        categories,
        created_at,
        updated_at
      `)
      .eq('publish_status', 'active')
      .overlaps('responsibility', searchRoles)

    if (tasksError) {
      console.error('Error fetching master tasks:', tasksError)
      const fallback = { total: 0, newSinceNine: 0, dueToday: 0, overdue: 0, completed: 0 }
      return NextResponse.json({
        success: true,
        data: fallback,
        meta: {
          role: validatedRole,
          date: validatedDate,
          error: 'master_tasks_query_error',
          details: tasksError.message || String(tasksError)
        }
      })
    }

    // Filter tasks by recurrence on the requested date using the same engine as checklist
    const holidayChecker = await createHolidayChecker()
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)
    
    // Set holidays in the task status calculator for frequency-based carry-over logic
    const holidaySet = await holidayChecker.getHolidaysAsSet()
    setHolidays(holidaySet)

    // First, get all task instances for today to find tasks that might have been completed
    // even if they don't normally appear today according to recurrence rules
    const { data: todayInstances, error: todayInstancesError } = await supabaseAdmin
      .from('task_instances')
      .select('master_task_id, status')
      .eq('instance_date', validatedDate)
      .eq('status', 'done')
      .in('master_task_id', (masterTasks || []).map(t => t.id))

    if (todayInstancesError) {
      console.error('Error fetching today instances:', todayInstancesError)
    }

    const completedTaskIds = new Set((todayInstances || []).map(inst => inst.master_task_id))


    const filteredTasks = (masterTasks || []).filter(task => {
      // If this task has a completed instance today, always include it
      if (completedTaskIds.has(task.id)) {
        return true
      }
      // First check visibility window (never show before creation/publish/start; hide after end)
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

      const viewDate = parseAustralianDate(validatedDate)
      if (visibilityStart && viewDate < visibilityStart) return false
      if (visibilityEnd && viewDate > visibilityEnd) return false

      try {
        const mt: NewMasterTask = {
          id: task.id,
          title: task.title || '',
          description: task.description || '',
          responsibility: task.responsibility || [],
          categories: task.categories || [],
          // Normalize legacy monthly frequency aliases to engine enums (match checklist API)
          frequencies: ((task.frequencies || []) as any).map((f: string) =>
            f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
              : f === 'every_month' ? 'once_monthly'
                : f === 'end_every_month' ? 'end_of_every_month'
                  : f
          ) as any,
          timing: task.timing || 'anytime_during_day',
          active: task.publish_status === 'active',
          publish_delay: (task as any).publish_delay || undefined,
          due_date: (task as any).due_date || undefined,
        }
        return recurrenceEngine.shouldTaskAppearOnDate(mt, validatedDate)
      } catch (err) {
        console.error('Error checking task recurrence:', err)
        // If recurrence fails for one task, skip it rather than failing the whole counts API
        return false
      }
    })

    // Fetch existing task instances (same table as checklist API)
    const masterTaskIds = filteredTasks.map(t => t.id)
    let existingInstances: any[] = []
    if (masterTaskIds.length > 0) {
      const viewDate = parseAustralianDate(validatedDate)
      const searchStartDate = new Date(viewDate)
      searchStartDate.setDate(viewDate.getDate() - 60)

      const { data, error: instancesError } = await supabaseAdmin
        .from('task_instances')
        .select('id, master_task_id, status, completed_by, completed_at, created_at, instance_date, due_date')
        .in('master_task_id', masterTaskIds)
        .gte('instance_date', formatAustralianDate(searchStartDate))
        .lte('instance_date', validatedDate)

      if (instancesError) {
        console.error('Error fetching task instances:', instancesError)
      }
      existingInstances = data || []
    }

    // Build instance map using same relevance rules as checklist API
    const instanceMap = new Map<string, any>()
    if (existingInstances.length > 0) {
      const taskInstanceGroups = new Map<string, any[]>()
      existingInstances.forEach(inst => {
        const key = inst.master_task_id
        if (!taskInstanceGroups.has(key)) taskInstanceGroups.set(key, [])
        taskInstanceGroups.get(key)!.push(inst)
      })

      taskInstanceGroups.forEach((instances, taskId) => {
        // Prefer today's instance first, then completed, then most recent by date
        const sorted = instances.sort((a, b) => {
          // 1) Prefer instance for the validated date (today)
          if (a.instance_date === validatedDate && b.instance_date !== validatedDate) return -1
          if (b.instance_date === validatedDate && a.instance_date !== validatedDate) return 1
          // 2) Then prefer completed instance
          if (a.status === 'done' && b.status !== 'done') return -1
          if (b.status === 'done' && a.status !== 'done') return 1
          // 3) Finally, most recent by instance_date
          return new Date(b.instance_date).getTime() - new Date(a.instance_date).getTime()
        })
        instanceMap.set(taskId, sorted[0])
      })
    }

    // Fetch position-specific completions for these instances
    const instanceIds = existingInstances.map(i => i.id)
    let completionsByInstance = new Map<string, any[]>()
    if (instanceIds.length > 0) {
      const { data: completions, error: completionsError } = await supabaseAdmin
        .from('task_position_completions')
        .select('task_instance_id, position_id, position_name, is_completed')
        .in('task_instance_id', instanceIds)
        .eq('is_completed', true)

      if (completionsError) {
        console.error('Error fetching position completions for counts:', completionsError)
      }

      (completions || []).forEach(c => {
        const key = c.task_instance_id
        if (!completionsByInstance.has(key)) completionsByInstance.set(key, [])
        completionsByInstance.get(key)!.push(c)
      })
    }

    // Calculate task counts using Australian timezone, per-position completion
    const counts = {
      total: 0,           // pending tasks to do today for this role
      newSinceNine: 0,    // tasks that appeared today
      dueToday: 0,        // pending and scheduled for today
      overdue: 0,         // pending and past due time
      completed: 0        // completed today by this role
    }

    const now = getAustralianNow()
    const normalizedRole = toKebabCase(validatedRole)
    const requestedPositionId = request.nextUrl.searchParams.get('positionId')



    filteredTasks.forEach(task => {
      const instance = instanceMap.get(task.id)
      const comps = instance ? (completionsByInstance.get(instance.id) || []) : []



      // Prefer matching by position_id when provided; fallback to normalized position_name
      const isCompletedForRole = comps.some(c => {
        const matchById = requestedPositionId && c.position_id && String(c.position_id) === String(requestedPositionId)
        const matchByName = toKebabCase(c.position_name || '') === normalizedRole



        return matchById || matchByName
      })

      // Compute engine status and feed into the same client-side calculator inputs
      const mtForStatus: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        // normalize monthly aliases (same as checklist)
        frequencies: ((task.frequencies || []) as any).map((f: string) =>
          f === 'start_every_month' || f === 'start_of_month' ? 'start_of_every_month'
            : f === 'every_month' ? 'once_monthly'
              : f === 'end_every_month' ? 'end_of_every_month'
                : f
        ) as any,
        timing: task.timing || 'anytime_during_day',
        active: task.publish_status === 'active',
        publish_delay: (task as any).publish_delay || undefined,
        due_date: (task as any).due_date || undefined,
        due_time: task.due_time || undefined,
        created_at: task.created_at || undefined,
        start_date: (task as any).start_date || undefined,
        end_date: (task as any).end_date || undefined,
      }
      const statusInfo = recurrenceEngine.calculateTaskStatus(mtForStatus, validatedDate, now, isCompletedForRole)

      // For homepage display, prioritize completion status over carry-over periods
      // If task is completed for this position, always show as completed
      if (isCompletedForRole) {
        counts.completed++
      } else {
        // Only calculate detailed status for non-completed tasks
        const taskStatus = calculateTaskStatusForCounts({
          date: validatedDate,
          due_date: statusInfo.dueDate || undefined,
          master_task: {
            due_time: statusInfo.dueTime || undefined,
            created_at: task.created_at || undefined,
            publish_delay: (task as any).publish_delay || undefined,
            start_date: (task as any).start_date || undefined,
            end_date: (task as any).end_date || undefined,
            frequencies: task.frequencies || undefined, // Pass frequencies for carry-over period calculation
          },
          detailed_status: statusInfo.status,
          is_completed_for_position: isCompletedForRole,
          status: instance?.status || undefined,
          lock_date: undefined, // Not available in task_instances table
          lock_time: undefined, // Not available in task_instances table
        }, validatedDate)

        // Count based on calculated status for non-completed tasks
        switch (taskStatus) {
          case 'completed':
            // This shouldn't happen since we checked isCompletedForRole above, but just in case
            counts.completed++
            break
          case 'due_today':
            counts.total++
            counts.dueToday++
            break
          case 'overdue':
            counts.total++
            counts.overdue++
            break
          case 'missed':
            // Missed tasks are no longer displayed on homepage, so don't count them
            break
          case 'not_due_yet':
            // Include not_due_yet tasks in total count to match checklist page behavior
            // This ensures "Tasks to do" count includes "Not Due Yet" tasks for frequencies like "Once Off" and "Once Weekly"
            counts.total++
            break
          default:
            // Fallback - include in total
            counts.total++
            break
        }
      }

      // New tasks: align with checklist page "is_new" logic (12 hours after activation, not completed)
      try {
        const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const viewDate = parseAustralianDate(validatedDate)
        const yesterday = new Date(viewDate)
        yesterday.setDate(viewDate.getDate() - 1)

        const mtForEngine: NewMasterTask = {
          id: task.id,
          title: task.title || '',
          description: task.description || '',
          responsibility: task.responsibility || [],
          categories: task.categories || [],
          frequencies: (task.frequencies || []) as any,
          timing: task.timing || 'anytime_during_day',
          active: task.publish_status === 'active',
          publish_delay: (task as any).publish_delay || undefined,
          due_date: (task as any).due_date || undefined,
        }
        const appearsToday = recurrenceEngine.shouldTaskAppearOnDate(mtForEngine, validatedDate)
        const appearsYesterdayRaw = recurrenceEngine.shouldTaskAppearOnDate(mtForEngine, toYMD(yesterday))

        // Activation AU date and time (max of created_at AU time, publish_delay + 00:00, start_date + 00:00)
        let activationDateTime: Date | null = null
        try {
          const createdAtIso = task.created_at as string | undefined
          const publishDelay = task.publish_delay as string | undefined
          const startDate = (task as any).start_date as string | undefined
          const anchors: Date[] = []
          if (createdAtIso) {
            // Keep full timestamp for created_at
            anchors.push(toAustralianTime(new Date(createdAtIso)))
          }
          if (publishDelay) {
            // Convert date-only to midnight AU time
            const publishDate = parseAustralianDate(publishDelay)
            anchors.push(publishDate)
          }
          if (startDate) {
            // Convert date-only to midnight AU time
            const startDateParsed = parseAustralianDate(startDate)
            anchors.push(startDateParsed)
          }
          if (anchors.length > 0) activationDateTime = new Date(Math.max(...anchors.map(d => d.getTime())))
        } catch { }

        const yesterdayDate = parseAustralianDate(toYMD(yesterday))
        const appearsYesterday = appearsYesterdayRaw && (!activationDateTime || yesterdayDate >= parseAustralianDate(formatAustralianDate(activationDateTime)))

        // Check if this is the first eligible appearance day since activation
        let isFirstAppearanceDay = false
        if (appearsToday && !appearsYesterday) {
          isFirstAppearanceDay = true
        } else if (instance?.created_at) {
          // Fallback: instance created today equals first appearance
          const createdYMD = toYMD(toAustralianTime(new Date(instance.created_at)))
          if (createdYMD === validatedDate) {
            isFirstAppearanceDay = true
          }
        }

        // Count as new only if it's the first appearance day AND within the badge display window AND not completed
        // Exclude "Every Day" frequency tasks from being counted as new
        const hasEveryDayFrequency = (task.frequencies || []).includes('every_day')

        if (isFirstAppearanceDay && activationDateTime && !isCompletedForRole && !hasEveryDayFrequency) {
          const currentAUTime = getAustralianNow()

          // Calculate badge end time as the earliest of:
          // 1. 12 hours after activation (default)
          // 2. Due time (if it falls within 12 hours)
          let badgeEndTime = new Date(activationDateTime.getTime() + 12 * 60 * 60 * 1000) // 12 hours default

          // For any task with due_time, check if it falls within 12 hours
          if (task.due_time) {
            try {
              const dueDateTime = createAustralianDateTime(validatedDate, task.due_time)
              // If due time is within 12 hours of activation, use it as the cutoff
              if (dueDateTime >= activationDateTime && dueDateTime < badgeEndTime) {
                badgeEndTime = dueDateTime
              }
            } catch {
              // If due_time parsing fails, keep the default 12-hour window
            }
          }

          // Count as new if current time is within the calculated window
          if (currentAUTime >= activationDateTime && currentAUTime <= badgeEndTime) {
            counts.newSinceNine++
          }
        }
      } catch { }
    })



    // Metadata (optional)
    const { count: totalMasterTasks } = await supabaseAdmin
      .from('master_tasks')
      .select('*', { count: 'exact', head: true })
      .overlaps('responsibility', searchRoles)
      .eq('publish_status', 'active')

    const checker = await createHolidayChecker()
    const isHoliday = await checker.isHoliday(parseAustralianDate(validatedDate))

    return NextResponse.json({
      success: true,
      data: counts,
      meta: {
        role: validatedRole,
        date: validatedDate,
        total_master_tasks: totalMasterTasks || 0,
        is_holiday: isHoliday
      }
    })

  } catch (error) {
    console.error('Checklist counts API error:', error)

    const fallback = { total: 0, newSinceNine: 0, dueToday: 0, overdue: 0, completed: 0 }
    return NextResponse.json({
      success: true,
      data: fallback,
      meta: {
        error: 'unhandled_counts_api_error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
}