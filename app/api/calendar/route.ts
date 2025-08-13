import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'

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

    // Build query for task instances in the date range
    let query = supabase
      .from('task_instances')
      .select(`
        id,
        due_date,
        status,
        master_tasks (
          id,
          title,
          category,
          position_id,
          positions (
            id,
            name
          )
        )
      `)
      .gte('due_date', startDateStr)
      .lte('due_date', endDateStr)

    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error fetching calendar tasks:', error)
      return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
    }

    // Group tasks by date and calculate counts
    const calendarData = (tasks || []).reduce((acc: any, task) => {
      const date = task.due_date
      
      if (!acc[date]) {
        acc[date] = {
          date,
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          missed: 0,
          tasks: []
        }
      }

      acc[date].total++
      acc[date].tasks.push({
        id: task.id,
        title: task.master_tasks?.title,
        category: task.master_tasks?.category,
        position: task.master_tasks?.positions?.name,
        status: task.status
      })

      // Count by status
      switch (task.status) {
        case 'done':
          acc[date].completed++
          break
        case 'overdue':
          acc[date].overdue++
          break
        case 'missed':
          acc[date].missed++
          break
        default:
          acc[date].pending++
      }

      return acc
    }, {})

    // Convert to array and fill in missing dates with zero counts
    const calendarArray = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      calendarArray.push(calendarData[dateStr] || {
        date: dateStr,
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        missed: 0,
        tasks: []
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Get public holidays for the date range
    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('date, name')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    const holidayMap = (holidays || []).reduce((acc: any, holiday) => {
      acc[holiday.date] = holiday.name
      return acc
    }, {})

    // Add holiday information to calendar data
    calendarArray.forEach(day => {
      if (holidayMap[day.date]) {
        day.holiday = holidayMap[day.date]
      }
    })

    // Calculate summary statistics
    const summary = calendarArray.reduce((acc, day) => {
      acc.totalTasks += day.total
      acc.completedTasks += day.completed
      acc.pendingTasks += day.pending
      acc.overdueTasks += day.overdue
      acc.missedTasks += day.missed
      return acc
    }, {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      missedTasks: 0
    })

    const completionRate = summary.totalTasks > 0 
      ? Math.round((summary.completedTasks / summary.totalTasks) * 100 * 100) / 100
      : 0

    return NextResponse.json({
      calendar: calendarArray,
      summary: {
        ...summary,
        completionRate
      },
      metadata: {
        view,
        year,
        month,
        startDate: startDateStr,
        endDate: endDateStr,
        positionId,
        totalDays: calendarArray.length,
        daysWithTasks: calendarArray.filter(day => day.total > 0).length
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

    // This could be used for creating ad-hoc tasks for specific dates
    // Implementation would depend on specific requirements
    
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