import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/task-instances - Fetch task instances with filtering
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  console.log('Task instances API GET - Starting request')
  try {
    // Authenticate the request
    console.log('Task instances API GET - Authenticating request')
    const user = await requireAuth(request)
    console.log('Task instances API GET - Authentication successful:', { id: user.id, role: user.role })
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const dateRange = searchParams.get('dateRange')
    const date = searchParams.get('date')
    const role = searchParams.get('role')
    const category = searchParams.get('category')

    console.log('Task instances API GET - Query parameters:', { status, dateRange, date, role, category })

    // Create admin Supabase client
    console.log('Task instances API GET - Creating Supabase client')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner (
          id,
          title,
          description,
          frequencies,
          timing,
          categories,
          responsibility
        )
      `)

    // Filter by date or date range
    if (date) {
      query = query.eq('due_date', date)
    } else if (dateRange) {
      // Format: "2024-01-01,2024-01-31" for range
      const [startDate, endDate] = dateRange.split(',')
      if (startDate && endDate) {
        query = query.gte('due_date', startDate).lte('due_date', endDate)
      }
    }

    // Filter by role if provided
    if (role) {
      query = query.eq('role', role)
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.contains('master_tasks.categories', [category])
    }

    // Default ordering - due date first, then time
    query = query.order('due_date', { ascending: true })
    query = query.order('due_time', { ascending: true })

    console.log('Task instances API GET - Executing query')
    const { data: taskInstances, error } = await query

    if (error) {
      console.error('Task instances API GET - Database error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json({ 
        error: 'Failed to fetch task instances',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('Task instances API GET - Query successful, found', taskInstances?.length || 0, 'task instances')

    // Transform data to match frontend expectations
    const transformedData = taskInstances?.map(instance => ({
      id: instance.id,
      instance_date: instance.instance_date,
      due_date: instance.due_date,
      due_time: instance.due_time,
      status: instance.status,
      is_published: instance.is_published,
      completed_at: instance.completed_at,
      completed_by: instance.completed_by,
      locked: instance.locked,
      acknowledged: instance.acknowledged,
      resolved: instance.resolved,
      created_at: instance.created_at,
      updated_at: instance.updated_at,
      master_task: {
        id: instance.master_tasks.id,
        title: instance.master_tasks.title,
        description: instance.master_tasks.description,
        frequencies: instance.master_tasks.frequencies,
        timing: instance.master_tasks.timing,
        categories: instance.master_tasks.categories,
        responsibility: instance.master_tasks.responsibility
      }
    })) || []

    console.log('Task instances API GET - Returning response with', transformedData.length, 'tasks')
    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        total_instances: transformedData.length,
        completed_instances: transformedData.filter(t => t.status === 'completed').length,
        pending_instances: transformedData.filter(t => t.status !== 'completed').length
      }
    })

  } catch (error) {
    console.error('Task instances API GET error:', {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}