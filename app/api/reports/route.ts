import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getResponsibilityForPosition } from '@/lib/position-utils'
import { 
  createAustralianDateTime, 
  fromAustralianTime
} from '@/lib/timezone-utils'
import { generateTaskOccurrences } from '@/lib/task-occurrence-generator'
import { getSearchOptions, toKebabCase } from '@/lib/responsibility-mapper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)





export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
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
        return await getOutstandingTasksReport(startDate, endDate, positionId, category)
      
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
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)

    const totalTasks = taskOccurrences.length
    const completedTasks = taskOccurrences.filter(task => task.status === 'completed').length
    
    const onTimeCompletions = taskOccurrences.filter(task => {
      if (!(task.status === 'completed' && task.completedAt)) return false
      
      // Check if completed on time (by end of the due date)
      const ausEndOfDay = createAustralianDateTime(task.date, '23:59:59')
      const ausEndOfDayUtc = fromAustralianTime(ausEndOfDay)
      const completedUtc = new Date(task.completedAt)
      return completedUtc <= ausEndOfDayUtc
    }).length

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const onTimeRate = completedTasks > 0 ? (onTimeCompletions / completedTasks) * 100 : 0

    return NextResponse.json({
      totalTasks,
      completedTasks,
      onTimeCompletions,
      completionRate: Math.round(completionRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100
    })
  } catch (error) {
    console.error('Error in getCompletionRateReport:', error)
    return NextResponse.json({ error: 'Failed to fetch completion rate data' }, { status: 500 })
  }
}

async function getTaskSummaryReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)

    // Count by status - map from shared generator status values to report format
    const statusCounts = {
      done: 0,
      overdue: 0,
      missed: 0,
      due_today: 0,
      not_due: 0
    }

    taskOccurrences.forEach(task => {
      switch (task.status) {
        case 'completed':
          statusCounts.done++
          break
        case 'overdue':
          statusCounts.overdue++
          break
        case 'missed':
          statusCounts.missed++
          break
        case 'due_today':
          statusCounts.due_today++
          break
        case 'not_due_yet':
          statusCounts.not_due++
          break
        default:
          statusCounts.due_today++ // Default for unknown statuses
      }
    })

    return NextResponse.json({
      totalTasks: taskOccurrences.length,
      statusCounts
    })
  } catch (error) {
    console.error('Error in getTaskSummaryReport:', error)
    return NextResponse.json({ error: 'Failed to fetch task summary data' }, { status: 500 })
  }
}

async function getMissedTasksReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const missedTasks = taskOccurrences.filter(task => task.status === 'missed')

    return NextResponse.json({
      totalMissedTasks: missedTasks.length,
      missedTasks: missedTasks.map(task => ({
        id: `${task.masterTaskId}:${task.date}`,
        due_date: task.date,
        master_tasks: {
          title: task.title,
          description: task.description,
          categories: task.categories,
          responsibility: task.responsibility
        }
      }))
    })
  } catch (error) {
    console.error('Error in getMissedTasksReport:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks data' }, { status: 500 })
  }
}

async function getMissedTasksByPositionReport(startDate?: string | null, endDate?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    // Get all positions (excluding Administrator)
    const { data: positions } = await supabaseServer
      .from('positions')
      .select('id, name')
      .neq('name', 'Administrator')

    // Generate all occurrences ONCE for the date range (unfiltered by position)
    const allOccurrences = await generateTaskOccurrences(startDate, endDate, null, category)
    const missedOccurrences = allOccurrences.filter(task => task.status === 'missed')

    // Build stats by mapping responsibilities to positions
    const positionStats: Record<string, number> = {}

    // Pre-compute responsibility variants for each position for faster checks
    const positionResponsibilityMap: Record<string, { name: string; variants: string[] }> = {}
    for (const pos of positions || []) {
      const normalizedRole = toKebabCase(pos.name)
      const variants = getSearchOptions(normalizedRole)
      positionResponsibilityMap[pos.id] = { name: pos.name, variants }
      positionStats[pos.name] = 0
    }

    // Tally missed tasks per position by overlapping responsibility labels
    for (const occ of missedOccurrences) {
      const occResp = occ.responsibility || []
      for (const posId in positionResponsibilityMap) {
        const { name, variants } = positionResponsibilityMap[posId]
        const matches = occResp.some(r => variants.includes((r || '').trim()) )
        if (matches) {
          positionStats[name] = (positionStats[name] || 0) + 1
        }
      }
    }

    return NextResponse.json({
      totalMissedTasks: Object.values(positionStats).reduce((sum, count) => sum + count, 0),
      positionStats
    })
  } catch (error) {
    console.error('Error in getMissedTasksByPositionReport:', error)
    return NextResponse.json({ error: 'Failed to fetch missed tasks by position data' }, { status: 500 })
  }
}

async function getOutstandingTasksReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const outstandingTasks = taskOccurrences.filter(task => 
      task.status === 'overdue' || task.status === 'missed'
    )

    return NextResponse.json({
      totalOutstandingTasks: outstandingTasks.length,
      outstandingTasks: outstandingTasks.map(task => ({
        id: `${task.masterTaskId}:${task.date}`,
        status: task.status,
        due_date: task.date,
        master_tasks: {
          title: task.title,
          description: task.description,
          categories: task.categories,
          responsibility: task.responsibility
        }
      }))
    })
  } catch (error) {
    console.error('Error in getOutstandingTasksReport:', error)
    return NextResponse.json({ error: 'Failed to fetch outstanding tasks data' }, { status: 500 })
  }
}

async function getAverageCompletionTimeReport(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
  }

  try {
    const taskOccurrences = await generateTaskOccurrences(startDate, endDate, positionId, category)
    const completedTasks = taskOccurrences.filter(task => 
      task.status === 'completed' && task.completedAt
    )

    if (completedTasks.length === 0) {
      return NextResponse.json({
        averageCompletionTimeHours: 0,
        totalCompletedTasks: 0
      })
    }

    // Calculate average completion time (simplified - could be enhanced)
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      if (!task.completedAt) return sum
      
      // Calculate time from due date to completion
      const dueDateTime = createAustralianDateTime(task.date, task.dueTime || '09:00')
      const completedDateTime = new Date(task.completedAt)
      const diffHours = (completedDateTime.getTime() - dueDateTime.getTime()) / (1000 * 60 * 60)
      
      return sum + Math.max(0, diffHours) // Only count positive completion times
    }, 0)

    const averageCompletionTimeHours = totalCompletionTime / completedTasks.length

    return NextResponse.json({
      averageCompletionTimeHours: Math.round(averageCompletionTimeHours * 100) / 100,
      totalCompletedTasks: completedTasks.length
    })
  } catch (error) {
    console.error('Error in getAverageCompletionTimeReport:', error)
    return NextResponse.json({ error: 'Failed to fetch average completion time data' }, { status: 500 })
  }
}