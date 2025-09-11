import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { generateTaskOccurrences } from '@/lib/task-occurrence-generator'
import { 
  getAustralianNow, 
  getAustralianToday, 
  parseAustralianDate, 
  formatAustralianDate,
  getAustralianDateRange
} from '@/lib/timezone-utils'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)



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
    
    // Get today's date for status calculations
    const todayStr = getAustralianToday()

    // Use the shared task occurrence generator (same logic as Dashboard API)
    const taskOccurrences = await generateTaskOccurrences(startDateStr, endDateStr, positionId)

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
    // Populate calendar map with task occurrences
    for (const occurrence of taskOccurrences) {
      const day = calendarMap[occurrence.date]
      if (day) {
        day.total++
        
        day.tasks.push({
          id: `${occurrence.masterTaskId}:${occurrence.date}`,
          title: occurrence.title,
          category: occurrence.categories?.[0] || 'general',
          position: '',
          status: occurrence.status
        })
        
        // Update counters based on dynamic status
        switch (occurrence.status) {
          case 'completed':
            day.completed++
            break
          case 'overdue':
            day.overdue++
            break
          case 'missed':
            day.missed++
            break
          case 'due_today':
          case 'not_due_yet':
          case 'pending':
          default:
            day.pending++
            break
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

    // Calculate summary from task occurrences
    const summary = {
      totalTasks: taskOccurrences.length,
      completedTasks: taskOccurrences.filter(t => t.status === 'completed').length,
      pendingTasks: taskOccurrences.filter(t => ['not_due_yet', 'due_today', 'pending'].includes(t.status)).length,
      overdueTasks: taskOccurrences.filter(t => t.status === 'overdue').length,
      missedTasks: taskOccurrences.filter(t => t.status === 'missed').length,
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