import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toKebabCase, getSearchOptions, filterTasksByResponsibility } from '@/lib/responsibility-mapper'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Convert frequencies array to frequency_rules format for the recurrence engine
function convertFrequenciesToRules(frequencies: string[]): any {
  if (!frequencies || frequencies.length === 0) {
    return { type: 'daily' }
  }

  // Handle the most common cases first
  if (frequencies.includes('every_day')) {
    return { type: 'daily', every_n_days: 1, business_days_only: false }
  }

  if (frequencies.includes('once_off')) {
    return { type: 'once_off' }
  }

  // Handle specific weekdays
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const selectedWeekdays = frequencies.filter(f => weekdays.includes(f))
  if (selectedWeekdays.length > 0) {
    // Map weekday names to numbers (1=Monday, 7=Sunday)
    const weekdayMap: { [key: string]: number } = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 
      'friday': 5, 'saturday': 6, 'sunday': 7
    }
    const weekdayNumbers = selectedWeekdays.map(day => weekdayMap[day]).filter(Boolean)
    
    if (weekdayNumbers.length === 1) {
      return { type: 'weekly', start_day: weekdayNumbers[0], every_n_weeks: 1 }
    } else {
      return { type: 'specific_weekdays', weekdays: weekdayNumbers, every_n_weeks: 1 }
    }
  }

  // Handle monthly patterns
  if (frequencies.includes('start_of_every_month')) {
    return { type: 'start_of_month', day_of_month: 1 }
  }

  if (frequencies.includes('end_of_every_month')) {
    return { type: 'end_of_month', days_from_end: 0 }
  }

  // Handle specific month patterns
  const monthlyPatterns = frequencies.filter(f => f.startsWith('start_of_month_') || f.startsWith('end_of_month_'))
  if (monthlyPatterns.length > 0) {
    const monthMap: { [key: string]: number } = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    const months = monthlyPatterns.map(pattern => {
      const monthKey = pattern.split('_').pop()
      return monthKey ? monthMap[monthKey] : null
    }).filter(Boolean)

    if (monthlyPatterns[0].startsWith('start_of_month_')) {
      return { type: 'start_certain_months', months, day_of_month: 1 }
    } else {
      return { type: 'end_certain_months', months, days_from_end: 0 }
    }
  }

  // Default fallback
  return { type: 'daily', every_n_days: 1, business_days_only: false }
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

    // Determine responsibility filter
    let responsibility: string | null = null
    if (positionId) {
      // Fetch position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name, display_name')
        .eq('id', positionId)
        .maybeSingle()
      if (position) {
        responsibility = toKebabCase(position.display_name || position.name)
      }
    } else if (user.role !== 'admin' && user.position_id) {
      // Fetch user's position to map to responsibility
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name, display_name')
        .eq('id', user.position_id)
        .maybeSingle()
      if (position) {
        responsibility = toKebabCase(position.display_name || position.name)
      }
    }

    // Get holidays
    const { data: holidays } = await supabaseAdmin
      .from('public_holidays')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    const holidayHelper = createHolidayHelper(holidays || [])
    const recurrenceEngine = createRecurrenceEngine(holidayHelper)

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

    if (responsibility) {
      const searchRoles = getSearchOptions(responsibility)
      taskQuery = taskQuery.overlaps('responsibility', searchRoles)
    }

    const { data: masterTasks, error: tasksError } = await taskQuery
    if (tasksError) {
      console.error('Calendar: error fetching master tasks', tasksError)
      return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
    }

    const roleFiltered = responsibility 
      ? filterTasksByResponsibility((masterTasks || []).map(t => ({ ...t, responsibility: t.responsibility || [] })), responsibility)
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

    // Fill occurrences using recurrence engine
    const now = new Date()
    for (const task of roleFiltered) {
      // Convert frequencies array to frequency_rules format for the recurrence engine
      const frequency_rules = convertFrequenciesToRules(task.frequencies || [])
      
      // iterate across range and add when due
      const iter = new Date(startDate)
      while (iter <= endDate) {
        let isDue = false
        try {
          isDue = recurrenceEngine.isDueOnDate({
            id: task.id,
            frequency_rules: frequency_rules,
            start_date: task.start_date || task.created_at?.split('T')[0],
            end_date: task.end_date
          }, iter)
        } catch (error) {
          console.error('Error checking if task is due:', error)
          isDue = false
        }
        if (isDue) {
          const ds = iter.toISOString().split('T')[0]
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