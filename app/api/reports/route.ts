import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getResponsibilityForPosition } from '@/lib/position-utils'
import { createAustralianDateTime, fromAustralianTime } from '@/lib/timezone-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reportType = searchParams.get('type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const positionId = searchParams.get('position_id')
    const category = searchParams.get('category')

    switch (reportType) {
      case 'completion-rate':
        return await getCompletionRateReport(startDate, endDate, positionId, category)
      
      case 'average-completion-time':
        return await getAverageCompletionTimeReport(startDate, endDate, positionId, category)
      
      case 'missed-tasks':
        return await getMissedTasksReport(startDate, endDate, positionId, category)
      
      case 'missed-by-position':
        return await getMissedTasksByPositionReport(startDate, endDate, category)
      
      case 'outstanding-tasks':
        return await getOutstandingTasksReport(positionId, category)
      
      case 'task-summary':
        return await getTaskSummaryReport(startDate, endDate, positionId, category)
      
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getCompletionRateReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      completed_at,
      due_date,
      master_tasks (
        categories,
        responsibility
      )
    `)

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: tasks, error } = await query

  if (error) {
    console.error('Error fetching completion rate data:', error)
    return NextResponse.json({ error: 'Failed to fetch completion rate data' }, { status: 500 })
  }

  const totalTasks = tasks?.length || 0
  const completedTasks = tasks?.filter(task => task.status === 'done').length || 0
  const onTimeCompletions = tasks?.filter(task => {
    if (!(task.status === 'done' && task.completed_at && task.due_date)) return false
    // due_date is a date (AUS business day boundary at 23:59:59 AUS for on-time)
    // Compare in UTC: AUS end-of-day -> UTC, completed_at already UTC
    const ausEndOfDay = createAustralianDateTime(task.due_date as string, '23:59:59')
    const ausEndOfDayUtc = fromAustralianTime(ausEndOfDay)
    const completedUtc = new Date(task.completed_at as string)
    return completedUtc <= ausEndOfDayUtc
  }).length || 0

  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const onTimeRate = totalTasks > 0 ? (onTimeCompletions / totalTasks) * 100 : 0

  return NextResponse.json({
    totalTasks,
    completedTasks,
    onTimeCompletions,
    completionRate: Math.round(completionRate * 100) / 100,
    onTimeRate: Math.round(onTimeRate * 100) / 100
  })
}

async function getAverageCompletionTimeReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      completed_at,
      due_date,
      created_at,
      master_tasks (
        categories,
        responsibility
      )
    `)
    .eq('status', 'done')
    .not('completed_at', 'is', null)

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: tasks, error } = await query

  if (error) {
    console.error('Error fetching completion time data:', error)
    return NextResponse.json({ error: 'Failed to fetch completion time data' }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({
      averageCompletionTimeHours: 0,
      totalCompletedTasks: 0
    })
  }

  const completionTimes = tasks.map(task => {
    // created_at and completed_at are UTC timestamps
    const createdUtc = new Date(task.created_at)
    const completedUtc = new Date(task.completed_at!)
    return (completedUtc.getTime() - createdUtc.getTime()) / (1000 * 60 * 60) // hours
  })

  const averageHours = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length

  return NextResponse.json({
    averageCompletionTimeHours: Math.round(averageHours * 100) / 100,
    totalCompletedTasks: tasks.length
  })
}

async function getMissedTasksReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      master_tasks (
        title,
        categories,
        responsibility
      )
    `)
    .eq('status', 'missed')

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: missedTasks, error } = await query

  if (error) {
    console.error('Error fetching missed tasks data:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks data' }, { status: 500 })
  }

  return NextResponse.json({
    totalMissedTasks: missedTasks?.length || 0,
    missedTasks: missedTasks || []
  })
}

async function getMissedTasksByPositionReport(startDate?: string | null, endDate?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      master_tasks (
        title,
        categories,
        responsibility
      )
    `)
    .eq('status', 'missed')

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: missedTasks, error } = await query

  if (error) {
    console.error('Error fetching missed tasks by position data:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks by position data' }, { status: 500 })
  }

  const responsibilityStats = (missedTasks || []).reduce((acc: any, task: any) => {
    const responsibilities = task.master_tasks?.responsibility || []
    responsibilities.forEach((responsibility: string) => {
      if (!acc[responsibility]) {
        acc[responsibility] = 0
      }
      acc[responsibility]++
    })
    return acc
  }, {})

  return NextResponse.json({
    totalMissedTasks: missedTasks?.length || 0,
    positionStats: responsibilityStats
  })
}

async function getOutstandingTasksReport(positionId?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      master_tasks (
        title,
        categories,
        responsibility
      )
    `)
    .in('status', ['overdue', 'missed'])
    .order('due_date', { ascending: true })

  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: outstandingTasks, error } = await query

  if (error) {
    console.error('Error fetching outstanding tasks data:', error)
    return NextResponse.json({ error: 'Failed to fetch outstanding tasks data' }, { status: 500 })
  }

  return NextResponse.json({
    totalOutstandingTasks: outstandingTasks?.length || 0,
    outstandingTasks: outstandingTasks || []
  })
}

async function getTaskSummaryReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabaseServer
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      completed_at,
      master_tasks (
        title,
        categories,
        responsibility
      )
    `)

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category && category !== 'all') {
    query = query.contains('master_tasks.categories', [category])
  }

  const { data: tasks, error } = await query

  if (error) {
    console.error('Error fetching task summary data:', error)
    return NextResponse.json({ error: 'Failed to fetch task summary data' }, { status: 500 })
  }

  const statusCounts = (tasks || []).reduce((acc: any, task: any) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    totalTasks: tasks?.length || 0,
    statusCounts,
    tasks: tasks || []
  })
}