import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toKebabCase, filterTasksByResponsibility } from '@/lib/responsibility-mapper'
import { createTaskRecurrenceStatusEngine, type MasterTask, type FrequencyType } from '@/lib/task-recurrence-status-engine'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Convert string frequencies to FrequencyType enum values
function convertStringFrequenciesToEnum(frequencies: string[]): FrequencyType[] {
  const frequencyMap: { [key: string]: FrequencyType } = {
    'once_off': 'once_off' as FrequencyType,
    'every_day': 'every_day' as FrequencyType,
    'once_weekly': 'once_weekly' as FrequencyType,
    'monday': 'monday' as FrequencyType,
    'tuesday': 'tuesday' as FrequencyType,
    'wednesday': 'wednesday' as FrequencyType,
    'thursday': 'thursday' as FrequencyType,
    'friday': 'friday' as FrequencyType,
    'saturday': 'saturday' as FrequencyType,
    'once_monthly': 'once_monthly' as FrequencyType,
    'start_of_every_month': 'start_of_every_month' as FrequencyType,
    'start_of_month_jan': 'start_of_month_jan' as FrequencyType,
    'start_of_month_feb': 'start_of_month_feb' as FrequencyType,
    'start_of_month_mar': 'start_of_month_mar' as FrequencyType,
    'start_of_month_apr': 'start_of_month_apr' as FrequencyType,
    'start_of_month_may': 'start_of_month_may' as FrequencyType,
    'start_of_month_jun': 'start_of_month_jun' as FrequencyType,
    'start_of_month_jul': 'start_of_month_jul' as FrequencyType,
    'start_of_month_aug': 'start_of_month_aug' as FrequencyType,
    'start_of_month_sep': 'start_of_month_sep' as FrequencyType,
    'start_of_month_oct': 'start_of_month_oct' as FrequencyType,
    'start_of_month_nov': 'start_of_month_nov' as FrequencyType,
    'start_of_month_dec': 'start_of_month_dec' as FrequencyType,
    'end_of_every_month': 'end_of_every_month' as FrequencyType,
    'end_of_month_jan': 'end_of_month_jan' as FrequencyType,
    'end_of_month_feb': 'end_of_month_feb' as FrequencyType,
    'end_of_month_mar': 'end_of_month_mar' as FrequencyType,
    'end_of_month_apr': 'end_of_month_apr' as FrequencyType,
    'end_of_month_may': 'end_of_month_may' as FrequencyType,
    'end_of_month_jun': 'end_of_month_jun' as FrequencyType,
    'end_of_month_jul': 'end_of_month_jul' as FrequencyType,
    'end_of_month_aug': 'end_of_month_aug' as FrequencyType,
    'end_of_month_sep': 'end_of_month_sep' as FrequencyType,
    'end_of_month_oct': 'end_of_month_oct' as FrequencyType,
    'end_of_month_nov': 'end_of_month_nov' as FrequencyType,
    'end_of_month_dec': 'end_of_month_dec' as FrequencyType
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
    
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
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
        ? new Date(searchParams.get('date')!)
        : new Date(year, month - 1, 1)
      
      startDate = new Date(weekDate)
      startDate.setDate(weekDate.getDate() - weekDate.getDay()) // Start of week (Sunday)
      
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6) // End of week (Saturday)
    } else {
      // Month view
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0) // Last day of month
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Determine responsibility filter variants
    let responsibilityVariants: string[] | null = null
    if (positionId) {
      // Fetch position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name, display_name')
        .eq('id', positionId)
        .maybeSingle()
      if (position) {
        responsibilityVariants = buildResponsibilityVariants(position.name, position.display_name)
      }
    } else if (user.role !== 'admin' && user.position_id) {
      // Fetch user's position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name, display_name')
        .eq('id', user.position_id)
        .maybeSingle()
      if (position) {
        responsibilityVariants = buildResponsibilityVariants(position.name, position.display_name)
      }
    }

    // Fallback: if position lookup failed for non-admins, use user's display_name header
    if (user.role !== 'admin' && (!responsibilityVariants || responsibilityVariants.length === 0)) {
      const dn = user.display_name || ''
      if (dn.trim()) {
        responsibilityVariants = buildResponsibilityVariants(dn, dn)
      }
    }

    // Create the new recurrence engine
    const recurrenceEngine = await createTaskRecurrenceStatusEngine()

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
        due_time,
        frequencies,
        created_at
      `)
      .eq('publish_status', 'active')

    // Publish delay condition across range: visible if publish_delay is null or <= end of range
    taskQuery = taskQuery.or(`publish_delay.is.null,publish_delay.lte.${endDateStr}`)

    // Non-admins must be restricted to their responsibility only
    if (user.role !== 'admin' && responsibilityVariants && responsibilityVariants.length > 0) {
      taskQuery = taskQuery.overlaps('responsibility', responsibilityVariants)
    }

    const { data: masterTasks, error: tasksError } = await taskQuery
    if (tasksError) {
      console.error('Calendar: error fetching master tasks', tasksError)
      return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
    }

    // Final in-memory safety filter to ensure non-admins never see others' tasks
    const roleFiltered = (user.role !== 'admin' && responsibilityVariants && responsibilityVariants.length > 0)
      ? (masterTasks || []).filter(t => {
          const resp: string[] = (t as any).responsibility || []
          // Match any variant including raw, lowercase, kebab, underscore, and space-separated
          return responsibilityVariants!.some(v => resp.includes(v))
        })
      : (masterTasks || [])

    // Build calendar map
    const calendarMap: Record<string, any> = {}
    const cur = new Date(startDate)
    while (cur <= endDate) {
      const ds = cur.toISOString().split('T')[0]
      calendarMap[ds] = {
        date: ds,
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        missed: 0,
        tasks: [] as any[],
      }
      cur.setDate(cur.getDate() + 1)
    }

    // Fill occurrences using new recurrence engine
    const now = new Date()
    for (const task of roleFiltered) {
      // Convert task to MasterTask format for new engine
      const masterTask: MasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        frequencies: convertStringFrequenciesToEnum(task.frequencies || []),
        timing: task.due_time || '09:00',
        active: true,
        publish_at: task.publish_delay || undefined,
        start_date: task.start_date || task.created_at?.split('T')[0],
        end_date: task.end_date || undefined
      }
      
      // iterate across range and add when due
      const iter = new Date(startDate)
      while (iter <= endDate) {
        const ds = iter.toISOString().split('T')[0]
        let shouldAppear = false
        
        try {
          shouldAppear = recurrenceEngine.shouldTaskAppearOnDate(masterTask, ds)
        } catch (error) {
          console.error('Error checking if task should appear:', error)
          shouldAppear = false
        }
        
        if (shouldAppear) {
          const day = calendarMap[ds]
          if (day) {
            day.total++
            const dueTime = task.due_time ? new Date(`${ds}T${task.due_time}`) : null
            const status = dueTime && now > dueTime ? 'overdue' : 'pending'
            day.tasks.push({ 
              id: `${task.id}:${ds}`, 
              title: task.title, 
              category: task.categories?.[0] || 'general', 
              position: '', 
              status 
            })
            if (status === 'overdue') day.overdue++
            else day.pending++
          }
        }
        iter.setDate(iter.getDate() + 1)
      }
    }

    const calendarArray = Object.values(calendarMap)

    // Get holidays for overlay
    const { data: holidays } = await supabaseAdmin
      .from('public_holidays')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    // Holidays overlay
    const holidayMap = (holidays || []).reduce((acc: any, h: any) => { acc[h.date] = h.name; return acc }, {})
    calendarArray.forEach((day: any) => {
      if (holidayMap[day.date]) day.holiday = holidayMap[day.date]
    })

    // Summary
    const summary = calendarArray.reduce((acc: any, day: any) => {
      acc.totalTasks += day.total
      acc.completedTasks += day.completed
      acc.pendingTasks += day.pending
      acc.overdueTasks += day.overdue
      acc.missedTasks += day.missed
      return acc
    }, { totalTasks: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0, missedTasks: 0 })

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