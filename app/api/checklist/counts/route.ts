import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { createHolidayChecker } from '@/lib/holiday-checker'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase, getSearchOptions } from '@/lib/responsibility-mapper'
import { getAustralianNow, getAustralianToday, createAustralianDateTime, parseAustralianDate, formatAustralianDate, toAustralianTime } from '@/lib/timezone-utils'

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

    const filteredTasks = (masterTasks || []).filter(task => {
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
      } catch {}

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
          frequencies: (task.frequencies || []) as any,
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
    const { data: instances, error: instancesError } = masterTaskIds.length > 0
      ? await supabaseAdmin
          .from('task_instances')
          .select('id, master_task_id, status, created_at, instance_date')
          .in('master_task_id', masterTaskIds)
          .eq('instance_date', validatedDate)
      : { data: [], error: null as any }

    if (instancesError) {
      console.error('Error fetching task instances:', instancesError)
      // Non-fatal: continue with empty instances but expose reason for debugging
    }

    const instanceMap = new Map<string, any>()
    ;(instances || []).forEach(inst => instanceMap.set(inst.master_task_id, inst))

    // Fetch position-specific completions for these instances
    const instanceIds = (instances || []).map(i => i.id)
    let completionsByInstance = new Map<string, any[]>()
    if (instanceIds.length > 0) {
      const { data: completions, error: completionsError } = await supabaseAdmin
        .from('task_position_completions')
        .select('task_instance_id, position_name, is_completed')
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

    filteredTasks.forEach(task => {
      const instance = instanceMap.get(task.id)
      const comps = instance ? (completionsByInstance.get(instance.id) || []) : []
      const isCompletedForRole = comps.some(c => (c.position_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalizedRole)

      if (isCompletedForRole) {
        counts.completed++
        return
      }

      // Pending tasks to do today
      counts.total++

      // Due time calculation: use task.due_time or treat as end-of-day
      const due = task.due_time ? task.due_time : '23:59'
      const dueDateTime = createAustralianDateTime(validatedDate, due)

      // Only compute due/overdue for today
      if (validatedDate === getAustralianToday()) {
        counts.dueToday++
        if (now > dueDateTime) counts.overdue++
      }

      // New tasks: align with checklist page "is_new" logic (12 hours after activation, not completed)
      try {
        const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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
        } catch {}

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
        if (isFirstAppearanceDay && activationDateTime && !isCompletedForRole) {
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
      } catch {}
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