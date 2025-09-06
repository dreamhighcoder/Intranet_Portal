import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { createHolidayChecker } from '@/lib/holiday-checker'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase } from '@/lib/responsibility-mapper'
import type { ChecklistInstanceStatus } from '@/types/checklist'
import {
  getAustralianNow,
  getAustralianToday,
  createAustralianDateTime,
  parseAustralianDate,
  formatAustralianDate,
  toAustralianTime,
} from '@/lib/timezone-utils'

// Use service role key to bypass RLS for server-side reads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')
    const date = searchParams.get('date')
    const adminMode = searchParams.get('admin_mode') === 'true'
    const responsibilityFilter = searchParams.get('responsibility')

    // Validate query parameters using Zod schema
    const validationResult = ChecklistQuerySchema.safeParse({ role, date })

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: validationResult.error.errors,
      }, { status: 400 })
    }

    const { role: validatedRole, date: validatedDate } = validationResult.data

    // Check if user is admin and admin mode is requested
    const isAdminRequest = adminMode && user.role === 'admin'

    // Normalize role to kebab-case format for consistent handling
    const normalizedRole = toKebabCase(validatedRole)

    // Base query to fetch active tasks (use only current columns)
    let taskQuery = supabaseAdmin
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
        custom_order,
        created_at,
        updated_at
      `)
      .eq('publish_status', 'active')

    // If not admin, filter by role directly in the database query using array overlap
    if (!isAdminRequest) {
      const { getSearchOptions } = await import('@/lib/responsibility-mapper')
      const searchRoles = getSearchOptions(normalizedRole)
      console.log('Role filtering:', {
        originalRole: role,
        normalizedRole,
        searchRoles,
        isAdminRequest
      })
      taskQuery = taskQuery.overlaps('responsibility', searchRoles)
    }

    const { data: masterTasks, error: tasksError } = await taskQuery

    if (tasksError) {
      console.error('Error fetching master tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // The data is now pre-filtered by role at the database level
    const roleFiltered = masterTasks || []

    // Create holiday helper and recurrence engine for filtering
    const holidayChecker = await createHolidayChecker()
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)

    // Debug logging for Saturday date
    if (validatedDate === '2025-09-06') {
      console.log('Processing tasks for Saturday 2025-09-06')
      console.log('Total tasks before filtering:', roleFiltered.length)
      const saturdayTasks = roleFiltered.filter(task => 
        task.frequencies && task.frequencies.includes('saturday')
      )
      console.log('Saturday frequency tasks found:', saturdayTasks.length)
      saturdayTasks.forEach(task => {
        console.log('Saturday task:', {
          id: task.id,
          title: task.title,
          frequencies: task.frequencies,
          publish_status: task.publish_status
        })
      })
    }

    // Filter tasks based on recurrence rules and date (using frequencies[])
    const filteredTasks = roleFiltered.filter(task => {
      try {
        // Server-side visibility window enforcement
        // Determine visibilityStart = max(created_at (AU date), publish_delay, start_date)
        // and visibilityEnd = end_date; hide outside of this window
        const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        const parseYMD = (s: string) => new Date(s + 'T00:00:00')

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

        // Convert task to NewMasterTask format for new engine
        const masterTask: NewMasterTask = {
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

        const shouldAppear = recurrenceEngine.shouldTaskAppearOnDate(masterTask, validatedDate)
        
        // Debug logging for Saturday tasks
        if (masterTask.frequencies.includes('saturday') && validatedDate === '2025-09-06') {
          console.log('Saturday task server debug:', {
            taskTitle: masterTask.title,
            frequencies: masterTask.frequencies,
            date: validatedDate,
            shouldAppear,
            isSundayOrHoliday: recurrenceEngine['isSundayOrHoliday'](parseAustralianDate(validatedDate))
          })
        }
        
        return shouldAppear
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return true // Default to showing the task if there's an error
      }
    })

    // Check for existing task instances to get completion status
    const masterTaskIds = filteredTasks.map(task => task.id)
    let existingInstances: any[] | null = null
    let positionCompletions: any[] | null = null
    
    if (masterTaskIds.length > 0) {
      // Get task instances
      const { data, error: instancesError } = await supabaseAdmin
        .from('task_instances')
        .select('id, master_task_id, status, completed_by, completed_at, created_at')
        .in('master_task_id', masterTaskIds)
        .eq('instance_date', validatedDate)

      if (instancesError) {
        console.error('Error fetching existing instances:', instancesError)
      }
      existingInstances = data || null

      // Get position-specific completions if we have instances
      if (existingInstances && existingInstances.length > 0) {
        const instanceIds = existingInstances.map(inst => inst.id)
        const { data: completionsData, error: completionsError } = await supabaseAdmin
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

        if (completionsError) {
          console.error('Error fetching position completions:', completionsError)
        }
        positionCompletions = completionsData || null
      }
    }

    // Create maps for quick lookup
    const instanceMap = new Map<string, any>()
    const completionsByInstanceMap = new Map<string, any[]>()
    
    if (existingInstances) {
      existingInstances.forEach(instance => {
        instanceMap.set(instance.master_task_id, instance)
      })
    }
    
    if (positionCompletions) {
      positionCompletions.forEach(completion => {
        const instanceId = completion.task_instance_id
        if (!completionsByInstanceMap.has(instanceId)) {
          completionsByInstanceMap.set(instanceId, [])
        }
        completionsByInstanceMap.get(instanceId)!.push(completion)
      })
    }

    // Transform to virtual checklist instances expected by UI
    const now = getAustralianNow()
    const checklistData = filteredTasks.map(task => {
      const existingInstance = instanceMap.get(task.id)

      // Get position-specific completions for this task
      const taskCompletions = existingInstance ? completionsByInstanceMap.get(existingInstance.id) || [] : []
      
      // Determine completion status based on position-specific completion
      let isCompletedForCurrentPosition = false
      let isCompletedByAnyPosition = false

      if (existingInstance) {
        if (!isAdminRequest) {
          // Non-admin: completed ONLY if this position has a completion record
          isCompletedForCurrentPosition = taskCompletions.some(
            (completion) => completion.position_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalizedRole
          )
        } else {
          // Admin: completed if any position has completed
          isCompletedByAnyPosition = taskCompletions.length > 0
        }
      }

      // Convert task to NewMasterTask format for status calculation
      const masterTaskForStatus: NewMasterTask = {
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
        due_time: task.due_time || undefined,
        created_at: task.created_at || undefined,
        start_date: (task as any).start_date || undefined,
        end_date: (task as any).end_date || undefined,
      }

      // Calculate proper status using recurrence engine
      const isCompleted = isAdminRequest ? isCompletedByAnyPosition : isCompletedForCurrentPosition
      const statusResult = recurrenceEngine.calculateTaskStatus(masterTaskForStatus, validatedDate, now, isCompleted)
      
      // Map status to ChecklistInstanceStatus
      let status: ChecklistInstanceStatus = 'pending'
      switch (statusResult.status) {
        case 'completed':
          status = 'completed'
          break
        case 'not_due_yet':
          status = 'pending'
          break
        case 'due_today':
          status = 'pending'
          break
        case 'overdue':
          status = 'overdue'
          break
        case 'missed':
          status = 'missed'
          break
        default:
          status = 'pending'
      }

      // Prepare position completion data for the UI
      const positionCompletionData = taskCompletions.map(completion => ({
        position_name: completion.position_name,
        completed_by: completion.completed_by,
        completed_at: completion.completed_at,
        is_completed: completion.is_completed
      }))

      // Compute "New" for 12 hours after activation (and only if not completed)
      // Exclude "Every Day" frequency tasks from being marked as new
      let is_new = false
      const hasEveryDayFrequency = (task.frequencies || []).includes('every_day')
      
      if (!(isCompletedForCurrentPosition || status === 'completed') && !hasEveryDayFrequency) {
        const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        const viewDate = parseAustralianDate(validatedDate)
        const yesterday = new Date(viewDate)
        yesterday.setDate(viewDate.getDate() - 1)

        const masterTaskForEngine: NewMasterTask = {
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
        const appearsToday = recurrenceEngine.shouldTaskAppearOnDate(masterTaskForEngine, validatedDate)
        const appearsYesterdayRaw = recurrenceEngine.shouldTaskAppearOnDate(masterTaskForEngine, toYMD(yesterday))

        // Determine activation AU date and time (max of created_at AU time, publish_delay + 00:00, start_date + 00:00)
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

        // Treat yesterday as an appearance only if it is on/after activation date
        const yesterdayDate = parseAustralianDate(toYMD(yesterday))
        const appearsYesterday = appearsYesterdayRaw && (!activationDateTime || yesterdayDate >= parseAustralianDate(formatAustralianDate(activationDateTime)))

        // Check if this is the first eligible appearance day since activation
        let isFirstAppearanceDay = false
        if (appearsToday && !appearsYesterday) {
          isFirstAppearanceDay = true
        } else if (existingInstance?.created_at) {
          // Fallback: instance created today equals first appearance
          const createdYMD = toYMD(toAustralianTime(new Date(existingInstance.created_at)))
          if (createdYMD === validatedDate) {
            isFirstAppearanceDay = true
          }
        }

        // Show "N" badge only if it's the first appearance day AND within the badge display window
        if (isFirstAppearanceDay && activationDateTime) {
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
          
          // Show badge if current time is within the calculated window
          if (currentAUTime >= activationDateTime && currentAUTime <= badgeEndTime) {
            is_new = true
          }
        }
      }

      return {
        id: `${task.id}:${validatedDate}`, // virtual instance id
        master_task_id: task.id,
        date: validatedDate,
        role: isAdminRequest ? 'admin' : normalizedRole,
        status,
        completed_by: existingInstance?.completed_by,
        completed_at: existingInstance?.completed_at,
        payload: {},
        notes: undefined,
        created_at: task.created_at,
        updated_at: task.created_at,
        // Add position-specific completion data
        position_completions: positionCompletionData,
        is_completed_for_position: isCompletedForCurrentPosition,
        is_new,
        // Add status calculation details
        detailed_status: statusResult.status,
        due_date: statusResult.dueDate,
        due_time: statusResult.dueTime,
        lock_date: statusResult.lockDate,
        lock_time: statusResult.lockTime,
        can_complete: statusResult.canComplete,
        master_task: {
          id: task.id,
          title: task.title,
          description: task.description,
          timing: task.timing || 'anytime_during_day',
          due_time: task.due_time,
          responsibility: task.responsibility || [],
          categories: task.categories || ['general'],
          frequencies: task.frequencies || [], // Using frequencies from database
          custom_order: task.custom_order,
          // Provide anchors to the client
          created_at: task.created_at,
          publish_delay: task.publish_delay || undefined,
          start_date: (task as any).start_date || undefined,
          end_date: (task as any).end_date || undefined,
        },
      }
    })

    return NextResponse.json({
      success: true,
      data: checklistData,
      meta: {
        role: validatedRole,
        date: validatedDate,
        admin_mode: isAdminRequest,
        responsibility_filter: responsibilityFilter || null,
        total_tasks: checklistData.length,
        completed_tasks: checklistData.filter(t => t.status === 'completed').length,
        pending_tasks: checklistData.filter(t => t.status === 'pending').length,
      },
    })

  } catch (error) {
    console.error('Checklist API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}