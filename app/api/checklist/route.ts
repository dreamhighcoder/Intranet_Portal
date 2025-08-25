import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, NewFrequencyType, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { HolidayChecker } from '@/lib/holiday-checker'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { toKebabCase } from '@/lib/responsibility-mapper'
import type { ChecklistInstanceStatus } from '@/types/checklist'
import { 
  getAustralianNow, 
  getAustralianToday, 
  parseAustralianDate, 
  formatAustralianDate,
  createAustralianDateTime,
  isAustralianTimePast
} from '@/lib/timezone-utils'

// Use service role key to bypass RLS for server-side reads
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

  return frequencies
    .map(freq => frequencyMap[freq])
    .filter(Boolean)
}

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
        details: validationResult.error.errors
      }, { status: 400 })
    }
    
    const { role: validatedRole, date: validatedDate } = validationResult.data
    
    // Check if user is admin and admin mode is requested
    const isAdminRequest = adminMode && user.role === 'admin'
    console.log('Admin mode requested:', adminMode, 'User role:', user.role, 'Is admin request:', isAdminRequest)
    
    // Normalize role to kebab-case format for consistent handling
    const normalizedRole = toKebabCase(validatedRole)
    console.log('Normalized role:', normalizedRole)

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
        frequencies,
        responsibility,
        categories,
        created_at
      `)
      .eq('publish_status', 'active')
      .or(`publish_delay.is.null,publish_delay.lte.${validatedDate}`)

    const { data: masterTasks, error: tasksError } = await taskQuery
    console.log('Master tasks found:', masterTasks?.length || 0)

    if (tasksError) {
      console.error('Error fetching master tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    let roleFiltered: any[] = []

    if (isAdminRequest) {
      // Admin mode: show all tasks (filtering will be done on client-side)
      console.log('Admin mode: fetching all tasks')
      roleFiltered = masterTasks || []
    } else {
      // Regular mode: filter by role
      const { getSearchOptions, filterTasksByResponsibility } = await import('@/lib/responsibility-mapper')
      const searchRoles = getSearchOptions(normalizedRole)
      console.log('Search roles:', searchRoles)

      // Post-filter based on shared-inc/exc rules
      console.log('Master tasks before filtering:', masterTasks?.map(t => ({
        id: t.id,
        title: t.title,
        responsibility: t.responsibility
      })) || 'No tasks found')
      
      roleFiltered = filterTasksByResponsibility(
        (masterTasks || []).map((t: any) => ({ ...t, responsibility: t.responsibility || [] })),
        normalizedRole
      )
      
      console.log('Tasks after responsibility filtering:', roleFiltered.length)
    }

    // Create holiday helper and recurrence engine for filtering
    const { data: holidays, error: holidaysError } = await supabaseAdmin
      .from('public_holidays')
      .select('date, name')
      .order('date', { ascending: true })

    if (holidaysError) {
      console.error('Error fetching holidays:', holidaysError)
    }

    const holidayChecker = new HolidayChecker(holidays || [])
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)
    
    // Filter tasks based on recurrence rules and date
    console.log('Checking recurrence for date:', validatedDate)
    
    const filteredTasks = roleFiltered.filter(task => {
      try {
        // Convert task to NewMasterTask format for new engine
        const masterTask: NewMasterTask = {
          id: task.id,
          title: task.title || '',
          description: task.description || '',
          responsibility: task.responsibility || [],
          categories: task.categories || [],
          frequencies: convertStringFrequenciesToEnum(task.frequencies || ['every_day']),
          timing: task.due_time || '09:00',
          active: true,
          publish_at: task.publish_delay || undefined,
          start_date: task.created_at?.split('T')[0],
          end_date: undefined
        }
        
        console.log('Checking recurrence for task:', {
          id: task.id,
          title: task.title,
          frequencies: task.frequencies,
          convertedFrequencies: masterTask.frequencies,
          start_date: masterTask.start_date
        })
        
        const shouldAppear = recurrenceEngine.shouldTaskAppearOnDate(masterTask, validatedDate)
        console.log('Task should appear:', shouldAppear)
        
        return shouldAppear
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        return true // Default to showing the task if there's an error
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
          frequencies: task.frequencies || ['every_day'] // Using frequencies from database
        }
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
