import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { createHolidayChecker } from '@/lib/holiday-checker'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase, getSearchOptions } from '@/lib/responsibility-mapper'
import { getAustralianNow, getAustralianToday, createAustralianDateTime } from '@/lib/timezone-utils'

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
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Filter tasks by recurrence on the requested date using the same engine as checklist
    const holidayChecker = await createHolidayChecker()
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)

    const filteredTasks = (masterTasks || []).filter(task => {
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
          publish_delay: task.publish_delay || undefined,
          due_date: task.due_date || undefined,
        }
        return recurrenceEngine.shouldTaskAppearOnDate(mt, validatedDate)
      } catch (err) {
        console.error('Error checking task recurrence:', err)
        return true
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

      // New since 9:00am logic (Australian time):
      const nineAmToday = createAustralianDateTime(getAustralianToday(), '09:00')
      const baseline = now >= nineAmToday
        ? nineAmToday
        : new Date(nineAmToday.getTime() - 24 * 60 * 60 * 1000)

      // If we have an instance for today, use its creation time
      if (instance?.created_at) {
        const instanceCreated = new Date(instance.created_at)
        if (instanceCreated >= baseline) counts.newSinceNine++
      }

      // If no instance exists yet but the task appears today (e.g., Once Off just activated),
      // treat activation/creation as "new" if it happened after the baseline. Restrict this
      // heuristic to once_off to avoid noise on recurring tasks.
      if (!instance) {
        const isOnceOff = Array.isArray(task.frequencies) && (task.frequencies as any[]).includes('once_off')
        if (isOnceOff) {
          const createdAt = task.created_at ? new Date(task.created_at) : null
          const updatedAt = task.updated_at ? new Date(task.updated_at) : null
          if ((createdAt && createdAt >= baseline) || (updatedAt && updatedAt >= baseline)) {
            counts.newSinceNine++
          }
        }
      }
    })
    
    // Metadata (optional)
    const { count: totalMasterTasks } = await supabaseAdmin
      .from('master_tasks')
      .select('*', { count: 'exact', head: true })
      .overlaps('responsibility', searchRoles)
      .eq('publish_status', 'active')

    const isHoliday = (await createHolidayChecker()).isHoliday(validatedDate)

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
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}