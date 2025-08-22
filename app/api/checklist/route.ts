import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase } from '@/lib/responsibility-mapper'
import type { ChecklistInstanceStatus } from '@/types/checklist'

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
    
    // Validate query parameters using Zod schema
    const validationResult = ChecklistQuerySchema.safeParse({ role, date })
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        details: validationResult.error.errors
      }, { status: 400 })
    }
    
    const { role: validatedRole, date: validatedDate } = validationResult.data
    
    // Normalize role to kebab-case format for consistent handling
    const normalizedRole = toKebabCase(validatedRole)
    console.log('Normalized role:', normalizedRole)

    // Virtual model: query master_tasks for this role and date
    const { getSearchOptions, filterTasksByResponsibility } = await import('@/lib/responsibility-mapper')

    const searchRoles = getSearchOptions(normalizedRole)
    console.log('Search roles:', searchRoles)

    // First, let's check if there are any master tasks at all
    const { data: allTasks, error: allTasksError } = await supabaseAdmin
      .from('master_tasks')
      .select('id, title, responsibility, categories, frequencies')
      .limit(10)
    
    console.log('All tasks (sample):', allTasks || 'No tasks found')
    
    if (allTasksError) {
      console.error('Error fetching all tasks:', allTasksError)
    }

    // Base query to fetch active tasks visible by publish_delay
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
        responsibility,
        categories,
        frequencies,
        created_at
      `)
      .eq('publish_status', 'active')
      .or(`publish_delay.is.null,publish_delay.lte.${validatedDate}`)
      
    // Log the query we're about to execute
    console.log('Executing query with searchRoles:', searchRoles)

    const { data: masterTasks, error: tasksError } = await taskQuery
    console.log('Master tasks found:', masterTasks?.length || 0)

    if (tasksError) {
      console.error('Error fetching master tasks for role:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Post-filter based on shared-inc/exc rules
    console.log('Master tasks before filtering:', masterTasks?.map(t => ({
      id: t.id,
      title: t.title,
      responsibility: t.responsibility
    })) || 'No tasks found')
    
    const roleFiltered = filterTasksByResponsibility(
      (masterTasks || []).map((t: any) => ({ ...t, responsibility: t.responsibility || [] })),
      normalizedRole
    )
    
    console.log('Tasks after responsibility filtering:', roleFiltered.length)

    // Create holiday helper and recurrence engine for filtering
    const { data: holidays, error: holidaysError } = await supabaseAdmin
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true })

    if (holidaysError) {
      console.error('Error fetching holidays:', holidaysError)
    }

    const holidayHelper = createHolidayHelper(holidays || [])
    const recurrenceEngine = createRecurrenceEngine(holidayHelper)
    
    // Filter tasks based on recurrence rules and date
    console.log('Checking recurrence for date:', validatedDate)
    
    const filteredTasks = roleFiltered.filter(task => {
      try {
        const taskForRecurrence = {
          id: task.id,
          frequency_rules: task.frequencies || { type: 'daily' }, // Use actual frequencies or default
          start_date: task.created_at?.split('T')[0],
          end_date: null // Field doesn't exist in current schema
        }
        
        console.log('Checking recurrence for task:', {
          id: task.id,
          title: task.title,
          frequency_rules: task.frequencies || { type: 'daily' },
          start_date: task.created_at?.split('T')[0],
          end_date: null
        })
        
        const isDue = recurrenceEngine.isDueOnDate(taskForRecurrence, new Date(validatedDate))
        console.log('Task is due:', isDue)
        
        return isDue
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return false
      }
    })
    
    // Check for existing task instances to get completion status
    const masterTaskIds = filteredTasks.map(task => task.id)
    const { data: existingInstances, error: instancesError } = await supabaseAdmin
      .from('task_instances')
      .select('master_task_id, status, completed_by, completed_at')
      .in('master_task_id', masterTaskIds)
      .eq('instance_date', validatedDate)
    
    if (instancesError) {
      console.error('Error fetching existing instances:', instancesError)
    }
    
    // Create a map for quick lookup
    const instanceMap = new Map()
    if (existingInstances) {
      existingInstances.forEach(instance => {
        instanceMap.set(instance.master_task_id, instance)
      })
    }
    
    // Transform to virtual checklist instances expected by UI
    const now = new Date()
    const checklistData = filteredTasks.map(task => {
      const existingInstance = instanceMap.get(task.id)
      const dueTime = task.due_time ? new Date(`${validatedDate}T${task.due_time}`) : null
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
        role: normalizedRole,
        status,
        completed_by: existingInstance?.completed_by,
        completed_at: existingInstance?.completed_at,
        payload: {},
        notes: undefined,
        created_at: task.created_at,
        updated_at: task.created_at,
        master_task: {
          id: task.id,
          title: task.title || 'Unknown Task',
          description: task.description,
          timing: task.timing || 'anytime_during_day',
          due_time: task.due_time,
          responsibility: task.responsibility || [],
          categories: task.categories || ['general'],
          frequencies: task.frequencies || { type: 'daily' }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: checklistData,
      meta: {
        role: validatedRole,
        date: validatedDate,
        total_tasks: checklistData.length,
        completed_tasks: checklistData.filter(t => t.status === 'completed').length,
        pending_tasks: checklistData.filter(t => t.status === 'pending').length
      }
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
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
