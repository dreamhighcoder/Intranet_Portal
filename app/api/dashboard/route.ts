import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Use service role client to bypass RLS (we enforce auth/authorization in code)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to map position ID to responsibility value
async function getResponsibilityFromPositionId(positionId: string): Promise<string | null> {
  const { data: position } = await supabaseAdmin
    .from('positions')
    .select('name')
    .eq('id', positionId)
    .single()
  
  if (!position) return null
  
  // The responsibility values in the database are the display names, not the value keys
  // So we return the position name directly
  return position.name
}

export async function GET(request: NextRequest) {
  try {
    console.log('Dashboard API: Starting request')
    
    const user = await requireAuth(request)
    console.log('Dashboard API: Authenticated user:', { id: user.id, role: user.role })
    
    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const dateRange = searchParams.get('date_range') || '7' // days
    
    console.log('Dashboard API: Query params:', { positionId, dateRange })

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - parseInt(dateRange))

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    // Build base query with position filter if needed
    let baseQuery = supabaseAdmin.from('task_instances')
    
    if (positionId && user.role !== 'admin') {
      // Non-admin users can only see their own position
      if (user.position_id !== positionId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // First, get master tasks that should have instances in the date range
    let masterTasksQuery = supabaseAdmin
      .from('master_tasks')
      .select(`
        id,
        title,
        categories,
        responsibility,
        publish_status
      `)
      .eq('publish_status', 'active')

    if (positionId) {
      const responsibilityValue = await getResponsibilityFromPositionId(positionId)
      if (responsibilityValue) {
        // Filter by responsibility array containing the mapped value
        masterTasksQuery = masterTasksQuery.contains('responsibility', [responsibilityValue])
      }
    }

    const { data: masterTasks, error: masterTasksError } = await masterTasksQuery

    if (masterTasksError) {
      console.error('Dashboard API: Error fetching master tasks:', masterTasksError)
      return NextResponse.json({ 
        error: 'Failed to fetch master tasks', 
        details: masterTasksError
      }, { status: 500 })
    }

    // Then get task instances for these master tasks in the date range
    let tasksQuery = baseQuery
      .select(`
        id,
        status,
        due_date,
        due_time,
        instance_date,
        completed_at,
        created_at,
        master_task_id
      `)
      .gte('due_date', startDateStr)
      .lte('due_date', endDateStr)

    if (masterTasks && masterTasks.length > 0) {
      const masterTaskIds = masterTasks.map(mt => mt.id)
      tasksQuery = tasksQuery.in('master_task_id', masterTaskIds)
    } else {
      // No master tasks found, return empty results
      tasksQuery = tasksQuery.eq('id', 'non-existent-id') // This will return no results
    }

    console.log('Dashboard API: Executing tasks query...')
    const { data: tasks, error: tasksError } = await tasksQuery

    if (tasksError) {
      console.error('Dashboard API: Error fetching tasks:', {
        message: tasksError.message,
        details: tasksError.details,
        hint: tasksError.hint,
        code: tasksError.code
      })
      return NextResponse.json({ 
        error: 'Failed to fetch dashboard data', 
        details: {
          message: tasksError.message,
          code: tasksError.code,
          hint: tasksError.hint
        }
      }, { status: 500 })
    }
    
    // Handle case where no tasks exist
    if (!tasks || tasks.length === 0) {
      console.log('Dashboard API: No tasks found, returning empty dashboard data')
      return NextResponse.json({
        summary: {
          totalTasks: 0,
          completedTasks: 0,
          onTimeCompletionRate: 0,
          avgTimeToCompleteHours: 0,
          newSince9am: 0,
          missedLast7Days: 0,
          overdueTasks: 0
        },
        today: {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0
        },
        categoryStats: {},
        recentActivity: [],
        upcomingTasks: [],
        trends: [],
        dateRange: {
          start: startDateStr,
          end: endDateStr,
          days: parseInt(dateRange)
        },
        generatedAt: new Date().toISOString()
      })
    }
    
    console.log('Dashboard API: Tasks fetched successfully:', tasks?.length || 0, 'tasks')

    // Create a map of master tasks for easy lookup
    const masterTasksMap = new Map()
    if (masterTasks) {
      masterTasks.forEach(mt => {
        masterTasksMap.set(mt.id, mt)
      })
    }

    // Enhance task instances with master task data
    const enhancedTasks = (tasks || []).map(task => ({
      ...task,
      master_tasks: masterTasksMap.get(task.master_task_id)
    }))

    // Calculate KPIs
    const allTasks = enhancedTasks
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
    
    const onTimeCompletionRate = completedTasks.length > 0 
      ? Math.round((onTimeCompletions.length / completedTasks.length) * 100 * 100) / 100
      : 0

    // Average time to complete (in hours)
    // Calculate time from when task became available (instance_date) to when it was completed
    const completionTimes = completedTasks
      .filter(task => task.completed_at && task.instance_date)
      .map(task => {
        // Task becomes available at start of instance_date (00:00)
        const availableDateTime = new Date(`${task.instance_date}T00:00:00`)
        const completed = new Date(task.completed_at!)
        
        // Calculate hours from when task became available to completion
        const hoursToComplete = (completed.getTime() - availableDateTime.getTime()) / (1000 * 60 * 60)
        
        // Return absolute hours (always positive)
        return Math.abs(hoursToComplete)
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
        // Use responsibility array or fallback to 'Unassigned'
        const responsibilities = task.master_tasks?.responsibility || []
        if (responsibilities.length > 0) {
          responsibilities.forEach((resp: string) => {
            acc[resp] = (acc[resp] || 0) + 1
          })
        } else {
          acc['Unassigned'] = (acc['Unassigned'] || 0) + 1
        }
        return acc
      }, {})
    }

    // Category breakdown
    const categoryStats = allTasks.reduce((acc: any, task) => {
      const categories = task.master_tasks?.categories || ['Uncategorized']
      // Handle both array and single string for backward compatibility
      const categoryArray = Array.isArray(categories) ? categories : [categories]
      
      categoryArray.forEach(category => {
        const categoryName = category || 'Uncategorized'
        if (!acc[categoryName]) {
          acc[categoryName] = { total: 0, completed: 0, missed: 0, overdue: 0 }
        }
        acc[categoryName].total++
        if (task.status === 'done') acc[categoryName].completed++
        if (task.status === 'missed') acc[categoryName].missed++
        if (task.status === 'overdue') acc[categoryName].overdue++
      })
      return acc
    }, {})

    // Recent activity (last 10 completed tasks)
    const recentActivity = completedTasks
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .slice(0, 10)
      .map(task => ({
        id: task.id,
        title: task.master_tasks?.title,
        responsibilities: task.master_tasks?.responsibility || [],
        completed_at: task.completed_at,
        categories: task.master_tasks?.categories || []
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
        master_task_id
      `)
      .gt('due_date', todayStr)
      .lte('due_date', upcomingEndDate.toISOString().split('T')[0])
      .in('status', ['not_due', 'due_today'])
      .order('due_date', { ascending: true })
      .limit(10)

    if (masterTasks && masterTasks.length > 0) {
      const masterTaskIds = masterTasks.map(mt => mt.id)
      upcomingQuery = upcomingQuery.in('master_task_id', masterTaskIds)
    } else {
      upcomingQuery = upcomingQuery.eq('id', 'non-existent-id')
    }

    const { data: upcomingTasksRaw } = await upcomingQuery
    
    // Enhance upcoming tasks with master task data
    const upcomingTasks = (upcomingTasksRaw || []).map(task => ({
      ...task,
      master_tasks: masterTasksMap.get(task.master_task_id)
    }))

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

      // Trends (simple day-by-day for the range) - skip if no task instances
      trends: allTasks.length > 0 ? await calculateTrends(startDateStr, endDateStr, positionId) : [],

      // Metadata
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        days: parseInt(dateRange)
      },
      generatedAt: new Date().toISOString()
    }

    console.log('Dashboard API: Returning dashboard data:', {
      totalTasks: dashboardData.summary.totalTasks,
      completedTasks: dashboardData.summary.completedTasks,
      categoryCount: Object.keys(dashboardData.categoryStats).length
    })

    return NextResponse.json(dashboardData)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Dashboard API unexpected error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

async function calculateTrends(startDate: string, endDate: string, positionId?: string | null) {
  try {
    // First get master tasks for the position
    let masterTasksQuery = supabaseAdmin
      .from('master_tasks')
      .select('id, responsibility')
      .eq('publish_status', 'active')

    if (positionId) {
      const responsibilityValue = await getResponsibilityFromPositionId(positionId)
      if (responsibilityValue) {
        masterTasksQuery = masterTasksQuery.contains('responsibility', [responsibilityValue])
      }
    }

    const { data: masterTasks } = await masterTasksQuery

    // Then get task instances
    let query = supabaseAdmin
      .from('task_instances')
      .select(`
        due_date,
        status,
        completed_at,
        master_task_id
      `)
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    if (masterTasks && masterTasks.length > 0) {
      const masterTaskIds = masterTasks.map(mt => mt.id)
      query = query.in('master_task_id', masterTaskIds)
    } else {
      query = query.eq('id', 'non-existent-id')
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