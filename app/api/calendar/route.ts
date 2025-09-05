import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toKebabCase, filterTasksByResponsibility } from '@/lib/responsibility-mapper'
import { NewRecurrenceEngine, NewFrequencyType, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { HolidayChecker } from '@/lib/holiday-checker'
import { createClient } from '@supabase/supabase-js'
import { 
  getAustralianNow, 
  getAustralianToday, 
  parseAustralianDate, 
  formatAustralianDate,
  createAustralianDateTime,
  isAustralianTimePast,
  getAustralianDateRange,
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

  return frequencies
    .map(freq => frequencyMap[freq])
    .filter(Boolean)
}

// Build a comprehensive set of responsibility variants to match DB values
function buildResponsibilityVariants(name?: string | null, displayName?: string | null): string[] {
  const set = new Set<string>()
  const add = (v?: string | null) => {
    if (!v) return
    const raw = v.trim()
    if (!raw) return
    set.add(raw)
    const lower = raw.toLowerCase()
    set.add(lower)
    const kebab = toKebabCase(raw)
    set.add(kebab)
    // underscore variant for legacy values
    set.add(kebab.replace(/-/g, '_'))
    // space variant
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
    
    const australianNow = getAustralianNow()
    const year = parseInt(searchParams.get('year') || australianNow.getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (australianNow.getMonth() + 1).toString())
    const positionId = searchParams.get('position_id')
    const view = searchParams.get('view') || 'month' // 'month' or 'week'

    // Validate position access
    if (positionId && user.role !== 'admin' && user.position_id !== positionId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let startDate: Date
    let endDate: Date

    if (view === 'week') {
      // Week view - get the week containing the specified date
      const weekDate = searchParams.get('date') 
        ? parseAustralianDate(searchParams.get('date')!)
        : new Date(year, month - 1, 1)
      
      // Calculate Monday as the start of the week
      const dayOfWeek = weekDate.getDay() // 0=Sun,1=Mon,...
      const diffToMonday = (dayOfWeek + 6) % 7
      startDate = new Date(weekDate)
      startDate.setDate(weekDate.getDate() - diffToMonday) // Start of week (Monday)
      
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6) // End of week (Sunday)
    } else {
      // Month view - use Australian timezone
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0) // Last day of month
    }

    const startDateStr = formatAustralianDate(startDate)
    const endDateStr = formatAustralianDate(endDate)

    // Determine responsibility filter variants
    let responsibilityVariants: string[] | null = null
    if (positionId) {
      // Fetch position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name')
        .eq('id', positionId)
        .maybeSingle()
      if (position) {
        responsibilityVariants = buildResponsibilityVariants(position.name, position.name)
      }
    } else if (user.role !== 'admin' && user.position_id) {
      // Fetch user's position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name')
        .eq('id', user.position_id)
        .maybeSingle()
      if (position) {
        responsibilityVariants = buildResponsibilityVariants(position.name, position.name)
      }
    }

    // Fallback: if position lookup failed for non-admins, use user's display_name header
    if (user.role !== 'admin' && (!responsibilityVariants || responsibilityVariants.length === 0)) {
      const dn = user.display_name || ''
      if (dn.trim()) {
        responsibilityVariants = buildResponsibilityVariants(dn, dn)
      }
    }

    // Get holidays for the new recurrence engine
    const { data: holidays } = await supabaseAdmin
      .from('public_holidays')
      .select('date, name')
      .order('date')

    // Create the new recurrence engine
    const holidayChecker = new HolidayChecker(holidays || [])
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)

    // Build master_tasks query
    let taskQuery = supabaseAdmin
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
        frequencies,
        created_at
      `)
      .eq('publish_status', 'active')



    // Apply responsibility filter when specified (for position filtering or non-admin users)
    if (responsibilityVariants && responsibilityVariants.length > 0) {
      taskQuery = taskQuery.overlaps('responsibility', responsibilityVariants)
    }

    const { data: masterTasks, error: tasksError } = await taskQuery
    if (tasksError) {
      console.error('Calendar: error fetching master tasks', tasksError)
      return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
    }

    // Final in-memory safety filter to apply responsibility filtering when specified
    const roleFiltered = (responsibilityVariants && responsibilityVariants.length > 0)
      ? (masterTasks || []).filter(t => {
          const resp: string[] = (t as any).responsibility || []
          // Match any variant including raw, lowercase, kebab, underscore, and space-separated
          const matches = responsibilityVariants!.some(v => resp.includes(v))
          return matches
        })
      : (masterTasks || [])



    // Build calendar map using Australian timezone
    const calendarMap: Record<string, any> = {}
    const dateRange = getAustralianDateRange(startDate, endDate)
    
    for (const dateStr of dateRange) {
      calendarMap[dateStr] = {
        date: dateStr,
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        missed: 0,
        tasks: [] as any[],
      }
    }

    // Fetch actual task instances for the date range to check completion status
    let instancesQuery = supabaseAdmin
      .from('task_instances')
      .select(`
        id,
        master_task_id,
        instance_date,
        status,
        completed_at,
        master_tasks!inner(
          id,
          title,
          responsibility,
          categories
        )
      `)
      .gte('instance_date', startDateStr)
      .lte('instance_date', endDateStr)

    // Apply same responsibility filtering for task instances
    if (responsibilityVariants && responsibilityVariants.length > 0) {
      instancesQuery = instancesQuery.overlaps('master_tasks.responsibility', responsibilityVariants)
    }

    const { data: taskInstances } = await instancesQuery



    // Create a map of existing task instances by master_task_id and date
    const instanceMap: Record<string, any> = {}
    if (taskInstances) {
      for (const instance of taskInstances) {
        const key = `${instance.master_task_id}:${instance.instance_date}`
        instanceMap[key] = instance
      }
    }

    // Fill occurrences using new recurrence engine with Australian timezone
    for (const task of roleFiltered) {
      // Convert task to NewMasterTask format for new engine
      const masterTask: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        frequencies: convertStringFrequenciesToEnum(task.frequencies || []),
        timing: task.due_time || '09:00',
        active: true,
        publish_delay: task.publish_delay || undefined,
        due_date: task.due_date || undefined
      }
      
      // iterate across date range and add when due
      for (const dateStr of dateRange) {
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

        const viewDate = parseAustralianDate(dateStr)
        if (visibilityStart && viewDate < visibilityStart) continue
        if (visibilityEnd && viewDate > visibilityEnd) continue
        
        let shouldAppear = false
        
        try {
          shouldAppear = recurrenceEngine.shouldTaskAppearOnDate(masterTask, dateStr)
        } catch (error) {
          console.error('Error checking if task should appear:', error)
          shouldAppear = false
        }
        
        if (shouldAppear) {
          const day = calendarMap[dateStr]
          if (day) {
            day.total++
            
            // Check if there's an actual task instance for this task and date
            const instanceKey = `${task.id}:${dateStr}`
            const existingInstance = instanceMap[instanceKey]
            
            let status = 'due_today'
            if (existingInstance) {
              // Use the actual status from the task instance
              status = existingInstance.status
            } else {
              // No instance exists, determine status based on time
              const isOverdue = task.due_time ? isAustralianTimePast(dateStr, task.due_time) : false
              status = isOverdue ? 'overdue' : 'due_today'
            }
            
            day.tasks.push({ 
              id: existingInstance ? existingInstance.id : `${task.id}:${dateStr}`, 
              title: task.title, 
              category: task.categories?.[0] || 'general', 
              position: '', 
              status 
            })
            
            // Update counters based on actual status
            // Database uses: 'not_due', 'due_today', 'overdue', 'missed', 'done'
            switch (status) {
              case 'done':
                day.completed++
                break
              case 'overdue':
                day.overdue++
                break
              case 'missed':
                day.missed++
                break
              case 'due_today':
              case 'not_due':
              default:
                day.pending++
                break
            }
          }
        }
      }
    }

    // Add any task instances that exist but weren't generated by the recurrence engine
    // (e.g., one-off tasks or manually created instances)
    if (taskInstances) {
      for (const instance of taskInstances) {
        const instanceKey = `${instance.master_task_id}:${instance.instance_date}`
        
        // Check if this instance was already processed
        const alreadyProcessed = Object.values(calendarMap).some((day: any) => 
          day.tasks.some((task: any) => task.id === instance.id)
        )
        
        if (!alreadyProcessed && calendarMap[instance.instance_date]) {
          // Apply same visibility filtering to existing instances
          const masterTask = roleFiltered.find(t => t.id === instance.master_task_id)
          if (masterTask) {
            let visibilityStart: Date | null = null
            let visibilityEnd: Date | null = null
            try {
              const createdAtIso = masterTask.created_at as string | undefined
              const publishDelay = masterTask.publish_delay as string | undefined
              const startDate = (masterTask as any).start_date as string | undefined
              const endDate = (masterTask as any).end_date as string | undefined

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

            const instanceDate = parseAustralianDate(instance.instance_date)
            if (visibilityStart && instanceDate < visibilityStart) continue
            if (visibilityEnd && instanceDate > visibilityEnd) continue
          }
          const day = calendarMap[instance.instance_date]
          day.total++
          
          day.tasks.push({
            id: instance.id,
            title: instance.master_tasks?.title || 'Unknown Task',
            category: instance.master_tasks?.categories?.[0] || 'general',
            position: '',
            status: instance.status
          })
          
          // Update counters based on actual status
          // Database uses: 'not_due', 'due_today', 'overdue', 'missed', 'done'
          switch (instance.status) {
            case 'done':
              day.completed++
              break
            case 'overdue':
              day.overdue++
              break
            case 'missed':
              day.missed++
              break
            case 'due_today':
            case 'not_due':
            default:
              day.pending++
              break
          }
        }
      }
    }

    const calendarArray = Object.values(calendarMap)

    // Get holidays for overlay
    const { data: holidaysOverlay } = await supabaseAdmin
      .from('public_holidays')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    // Holidays overlay
    const holidayMap = (holidaysOverlay || []).reduce((acc: any, h: any) => { acc[h.date] = h.name; return acc }, {})
    calendarArray.forEach((day: any) => {
      if (holidayMap[day.date]) day.holiday = holidayMap[day.date]
    })

    // Summary - Calculate directly from task instances (source of truth)
    const summary = {
      totalTasks: taskInstances?.length || 0,
      completedTasks: taskInstances?.filter(t => t.status === 'done').length || 0,
      pendingTasks: taskInstances?.filter(t => ['due_today', 'not_due'].includes(t.status)).length || 0,
      overdueTasks: taskInstances?.filter(t => t.status === 'overdue').length || 0,
      missedTasks: taskInstances?.filter(t => t.status === 'missed').length || 0,
    }

    const completionRate = summary.totalTasks > 0 
      ? Math.round((summary.completedTasks / summary.totalTasks) * 100 * 100) / 100
      : 0

    const responseData = {
      calendar: calendarArray,
      summary: { ...summary, completionRate },
      metadata: {
        view,
        year,
        month,
        startDate: startDateStr,
        endDate: endDateStr,
        positionId,
        totalDays: calendarArray.length,
        daysWithTasks: calendarArray.filter((d: any) => d.total > 0).length
      }
    }


    

    
    const response = NextResponse.json(responseData)
    
    // Add CORS headers to help with browser requests
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Position-User-Id, X-Position-User-Role, X-Position-Display-Name')
    
    return response

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    
    // Return detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage,
      stack: errorStack
    }, { status: 500 })
  }
}

// POST endpoint for creating calendar events (if needed for manual task creation)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { date, tasks } = body

    if (!date || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'Date and tasks array are required' }, { status: 400 })
    }

    return NextResponse.json({ 
      message: 'Calendar event creation not yet implemented',
      received: { date, taskCount: tasks.length }
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// OPTIONS handler for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 })
  
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Position-User-Id, X-Position-User-Role, X-Position-Display-Name')
  response.headers.set('Access-Control-Max-Age', '86400')
  
  return response
}