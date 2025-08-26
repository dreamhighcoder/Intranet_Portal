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
  createAustralianDateTime,
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
        due_date,
        frequencies,
        responsibility,
        categories,
        created_at
      `)
      .eq('publish_status', 'active')

    // If not admin, filter by role directly in the database query using array overlap
    if (!isAdminRequest) {
      const { getSearchOptions } = await import('@/lib/responsibility-mapper')
      const searchRoles = getSearchOptions(normalizedRole)
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

    // Filter tasks based on recurrence rules and date (using frequencies[])
    const filteredTasks = roleFiltered.filter(task => {
      try {
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

        return recurrenceEngine.shouldTaskAppearOnDate(masterTask, validatedDate)
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return true // Default to showing the task if there's an error
      }
    })

    // Check for existing task instances to get completion status
    const masterTaskIds = filteredTasks.map(task => task.id)
    let existingInstances: any[] | null = null
    if (masterTaskIds.length > 0) {
      const { data, error: instancesError } = await supabaseAdmin
        .from('task_instances')
        .select('master_task_id, status, completed_by, completed_at')
        .in('master_task_id', masterTaskIds)
        .eq('instance_date', validatedDate)

      if (instancesError) {
        console.error('Error fetching existing instances:', instancesError)
      }
      existingInstances = data || null
    }

    // Create a map for quick lookup
    const instanceMap = new Map<string, any>()
    if (existingInstances) {
      existingInstances.forEach(instance => {
        instanceMap.set(instance.master_task_id, instance)
      })
    }

    // Transform to virtual checklist instances expected by UI
    const now = getAustralianNow()
    const checklistData = filteredTasks.map(task => {
      const existingInstance = instanceMap.get(task.id)
      const dueTime = task.due_time ? createAustralianDateTime(validatedDate, task.due_time) : null
      const isOverdue = dueTime ? now > dueTime : false

      // Determine status based on existing instance or default logic
      let status: ChecklistInstanceStatus = 'pending'
      if (existingInstance) {
        // Map database status to UI status
        const dbStatus = existingInstance.status
        if (dbStatus === 'done') {
          status = 'completed'
        } else if (dbStatus === 'due_today') {
          status = 'pending'
        } else if (dbStatus === 'overdue') {
          status = 'overdue'
        } else {
          status = 'pending'
        }
      } else if (isOverdue) {
        status = 'overdue'
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
        master_task: {
          id: task.id,
          title: task.title,
          description: task.description,
          timing: task.timing || 'anytime_during_day',
          due_time: task.due_time,
          responsibility: task.responsibility || [],
          categories: task.categories || ['general'],
          frequencies: task.frequencies || [], // Using frequencies from database
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