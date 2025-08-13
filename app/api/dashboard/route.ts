import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const dateRange = searchParams.get('date_range') || '7' // days

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - parseInt(dateRange))

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    // Build base query with position filter if needed
    let baseQuery = supabase.from('task_instances')
    
    if (positionId && user.role !== 'admin') {
      // Non-admin users can only see their own position
      if (user.position_id !== positionId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get all relevant task instances for the date range
    let tasksQuery = baseQuery
      .select(`
        id,
        status,
        due_date,
        completed_at,
        created_at,
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
      tasksQuery = tasksQuery.eq('master_tasks.position_id', positionId)
    }

    const { data: tasks, error: tasksError } = await tasksQuery

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
    }

    // Calculate KPIs
    const allTasks = tasks || []
    const todayTasks = allTasks.filter(task => task.due_date === todayStr)
    const completedTasks = allTasks.filter(task => task.status === 'done')
    const overdueTasks = allTasks.filter(task => task.status === 'overdue')
    const missedTasks = allTasks.filter(task => task.status === 'missed')
    
    // On-time completion rate
    const onTimeCompletions = completedTasks.filter(task => {
      if (!task.completed_at) return false
      const completedDate = new Date(task.completed_at).toISOString().split('T')[0]
      return completedDate <= task.due_date
    })
    
    const onTimeCompletionRate = allTasks.length > 0 
      ? Math.round((onTimeCompletions.length / allTasks.length) * 100 * 100) / 100
      : 0

    // Average time to complete (in hours)
    const completionTimes = completedTasks
      .filter(task => task.completed_at && task.created_at)
      .map(task => {
        const created = new Date(task.created_at)
        const completed = new Date(task.completed_at!)
        return (completed.getTime() - created.getTime()) / (1000 * 60 * 60) // hours
      })
    
    const avgTimeToComplete = completionTimes.length > 0
      ? Math.round((completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length) * 100) / 100
      : 0

    // Tasks created since 9am today
    const nineAmToday = new Date()
    nineAmToday.setHours(9, 0, 0, 0)
    const newSince9am = allTasks.filter(task => 
      new Date(task.created_at) >= nineAmToday
    ).length

    // Tasks due today by status
    const dueTodayStats = {
      total: todayTasks.length,
      completed: todayTasks.filter(task => task.status === 'done').length,
      pending: todayTasks.filter(task => ['not_due', 'due_today'].includes(task.status)).length,
      overdue: todayTasks.filter(task => task.status === 'overdue').length
    }

    // Missed tasks by position (for admin view)
    let missedByPosition = {}
    if (user.role === 'admin') {
      missedByPosition = missedTasks.reduce((acc: any, task) => {
        const positionName = task.master_tasks?.positions?.name || 'Unassigned'
        acc[positionName] = (acc[positionName] || 0) + 1
        return acc
      }, {})
    }

    // Category breakdown
    const categoryStats = allTasks.reduce((acc: any, task) => {
      const category = task.master_tasks?.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = { total: 0, completed: 0, missed: 0, overdue: 0 }
      }
      acc[category].total++
      if (task.status === 'done') acc[category].completed++
      if (task.status === 'missed') acc[category].missed++
      if (task.status === 'overdue') acc[category].overdue++
      return acc
    }, {})

    // Recent activity (last 10 completed tasks)
    const recentActivity = completedTasks
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 10)
      .map(task => ({
        id: task.id,
        title: task.master_tasks?.title,
        position: task.master_tasks?.positions?.name,
        completed_at: task.completed_at,
        category: task.master_tasks?.category
      }))

    // Upcoming tasks (next 7 days)
    const upcomingEndDate = new Date()
    upcomingEndDate.setDate(upcomingEndDate.getDate() + 7)
    
    let upcomingQuery = baseQuery
      .select(`
        id,
        status,
        due_date,
        due_time,
        master_tasks (
          title,
          category,
          positions (
            name
          )
        )
      `)
      .gt('due_date', todayStr)
      .lte('due_date', upcomingEndDate.toISOString().split('T')[0])
      .in('status', ['not_due', 'due_today'])
      .order('due_date', { ascending: true })
      .limit(10)

    if (positionId) {
      upcomingQuery = upcomingQuery.eq('master_tasks.position_id', positionId)
    }

    const { data: upcomingTasks } = await upcomingQuery

    const dashboardData = {
      // Core KPIs
      summary: {
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        onTimeCompletionRate,
        avgTimeToCompleteHours: avgTimeToComplete,
        newSince9am,
        missedLast7Days: missedTasks.length,
        overdueTasks: overdueTasks.length
      },

      // Today's tasks
      today: dueTodayStats,

      // Position breakdown (admin only)
      ...(user.role === 'admin' && { missedByPosition }),

      // Category breakdown
      categoryStats,

      // Recent activity
      recentActivity,

      // Upcoming tasks
      upcomingTasks: upcomingTasks || [],

      // Trends (simple day-by-day for the range)
      trends: await calculateTrends(startDateStr, endDateStr, positionId),

      // Metadata
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        days: parseInt(dateRange)
      },
      generatedAt: new Date().toISOString()
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function calculateTrends(startDate: string, endDate: string, positionId?: string | null) {
  try {
    let query = supabase
      .from('task_instances')
      .select(`
        due_date,
        status,
        completed_at,
        master_tasks (
          position_id
        )
      `)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    }

    const { data: trendTasks } = await query

    if (!trendTasks) return []

    // Group by date
    const dailyStats = trendTasks.reduce((acc: any, task) => {
      const date = task.due_date
      if (!acc[date]) {
        acc[date] = { total: 0, completed: 0, missed: 0, overdue: 0 }
      }
      acc[date].total++
      if (task.status === 'done') acc[date].completed++
      if (task.status === 'missed') acc[date].missed++
      if (task.status === 'overdue') acc[date].overdue++
      return acc
    }, {})

    // Convert to array format
    return Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      ...stats,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    })).sort((a, b) => a.date.localeCompare(b.date))
  } catch (error) {
    console.error('Error calculating trends:', error)
    return []
  }
}