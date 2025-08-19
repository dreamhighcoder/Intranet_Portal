import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toKebabCase, getSearchOptions, filterTasksByResponsibility } from '@/lib/responsibility-mapper'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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
    } else if (user.role !== 'admin') {
      responsibility = toKebabCase(user.position?.displayName || user.position?.name || '')
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
        frequency_rules,
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
      // iterate across range and add when due
      const iter = new Date(startDate)
      while (iter <= endDate) {
        const isDue = recurrenceEngine.isDueOnDate({
          id: task.id,
          frequency_rules: task.frequency_rules || {},
          start_date: task.start_date || task.created_at?.split('T')[0],
          end_date: task.end_date
        }, iter)
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

    return NextResponse.json({
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
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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