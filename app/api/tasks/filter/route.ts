import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    
    // Filter parameters
    const positionId = searchParams.get('position_id')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const frequency = searchParams.get('frequency')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    const showCompleted = searchParams.get('show_completed') === 'true'
    const showLocked = searchParams.get('show_locked') === 'true'
    const onlyOverdue = searchParams.get('only_overdue') === 'true'
    const onlyMissed = searchParams.get('only_missed') === 'true'
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Sorting
    const sortBy = searchParams.get('sort_by') || 'due_date'
    const sortOrder = searchParams.get('sort_order') || 'asc'

    // Validate position access
    if (positionId && user.role !== 'admin' && user.position_id !== positionId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Build base query
    let query = supabase
      .from('task_instances')
      .select(`
        id,
        instance_date,
        due_date,
        due_time,
        status,
        is_published,
        completed_at,
        completed_by,
        locked,
        acknowledged,
        resolved,
        created_at,
        updated_at,
        master_tasks (
          id,
          title,
          description,
          frequency,
          timing,
          category,
          sticky_once_off,
          allow_edit_when_locked,
          position_id,
          positions (
            id,
            name,
            description
          )
        )
      `, { count: 'exact' })

    // Apply filters
    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    } else if (user.role !== 'admin' && user.position_id) {
      // Non-admin users can only see their own position's tasks
      query = query.eq('master_tasks.position_id', user.position_id)
    }

    if (category) {
      query = query.eq('master_tasks.category', category)
    }

    if (status) {
      if (status.includes(',')) {
        // Multiple statuses
        query = query.in('status', status.split(','))
      } else {
        query = query.eq('status', status)
      }
    }

    if (frequency) {
      query = query.eq('master_tasks.frequency', frequency)
    }

    if (dateFrom) {
      query = query.gte('due_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('due_date', dateTo)
    }

    if (!showCompleted) {
      query = query.neq('status', 'done')
    }

    if (!showLocked) {
      query = query.eq('locked', false)
    }

    if (onlyOverdue) {
      query = query.eq('status', 'overdue')
    }

    if (onlyMissed) {
      query = query.eq('status', 'missed')
    }

    if (search) {
      // Search in task title and description
      query = query.or(`master_tasks.title.ilike.%${search}%,master_tasks.description.ilike.%${search}%`)
    }

    // Apply sorting
    const validSortFields = ['due_date', 'created_at', 'updated_at', 'status']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'due_date'
    const ascending = sortOrder === 'asc'

    query = query.order(sortField, { ascending })

    // Add secondary sort by due_time if sorting by due_date
    if (sortField === 'due_date') {
      query = query.order('due_time', { ascending })
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: tasks, error, count } = await query

    if (error) {
      console.error('Error fetching filtered tasks:', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Calculate summary statistics for the filtered results
    const summary = await calculateFilterSummary(
      positionId,
      category,
      status,
      frequency,
      dateFrom,
      dateTo,
      search,
      showCompleted,
      showLocked,
      onlyOverdue,
      onlyMissed,
      user
    )

    return NextResponse.json({
      tasks: tasks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      },
      summary,
      filters: {
        positionId,
        category,
        status,
        frequency,
        dateFrom,
        dateTo,
        search,
        showCompleted,
        showLocked,
        onlyOverdue,
        onlyMissed
      },
      sorting: {
        sortBy: sortField,
        sortOrder
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

async function calculateFilterSummary(
  positionId?: string | null,
  category?: string | null,
  status?: string | null,
  frequency?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  search?: string | null,
  showCompleted?: boolean,
  showLocked?: boolean,
  onlyOverdue?: boolean,
  onlyMissed?: boolean,
  user?: any
) {
  try {
    // Build the same query but without pagination to get summary stats
    let summaryQuery = supabase
      .from('task_instances')
      .select(`
        status,
        locked,
        master_tasks (
          category,
          frequency,
          position_id
        )
      `)

    // Apply the same filters
    if (positionId) {
      summaryQuery = summaryQuery.eq('master_tasks.position_id', positionId)
    } else if (user?.role !== 'admin' && user?.position_id) {
      summaryQuery = summaryQuery.eq('master_tasks.position_id', user.position_id)
    }

    if (category) {
      summaryQuery = summaryQuery.eq('master_tasks.category', category)
    }

    if (status) {
      if (status.includes(',')) {
        summaryQuery = summaryQuery.in('status', status.split(','))
      } else {
        summaryQuery = summaryQuery.eq('status', status)
      }
    }

    if (frequency) {
      summaryQuery = summaryQuery.eq('master_tasks.frequency', frequency)
    }

    if (dateFrom) {
      summaryQuery = summaryQuery.gte('due_date', dateFrom)
    }

    if (dateTo) {
      summaryQuery = summaryQuery.lte('due_date', dateTo)
    }

    if (!showCompleted) {
      summaryQuery = summaryQuery.neq('status', 'done')
    }

    if (!showLocked) {
      summaryQuery = summaryQuery.eq('locked', false)
    }

    if (onlyOverdue) {
      summaryQuery = summaryQuery.eq('status', 'overdue')
    }

    if (onlyMissed) {
      summaryQuery = summaryQuery.eq('status', 'missed')
    }

    if (search) {
      summaryQuery = summaryQuery.or(`master_tasks.title.ilike.%${search}%,master_tasks.description.ilike.%${search}%`)
    }

    const { data: summaryTasks } = await summaryQuery

    if (!summaryTasks) {
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        byFrequency: {},
        locked: 0
      }
    }

    const summary = {
      total: summaryTasks.length,
      byStatus: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byFrequency: {} as Record<string, number>,
      locked: 0
    }

    summaryTasks.forEach(task => {
      // Count by status
      summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1

      // Count by category
      const cat = task.master_tasks?.category || 'Uncategorized'
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1

      // Count by frequency
      const freq = task.master_tasks?.frequency || 'Unknown'
      summary.byFrequency[freq] = (summary.byFrequency[freq] || 0) + 1

      // Count locked tasks
      if (task.locked) {
        summary.locked++
      }
    })

    return summary
  } catch (error) {
    console.error('Error calculating filter summary:', error)
    return {
      total: 0,
      byStatus: {},
      byCategory: {},
      byFrequency: {},
      locked: 0
    }
  }
}