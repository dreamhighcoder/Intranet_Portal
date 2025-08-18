import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const taskInstanceId = searchParams.get('task_instance_id')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('task_completion_log')
      .select(`
        *,
        task_instances!inner (
          id,
          master_tasks!inner (
            id,
            title,
            positions (
              id,
              name
            )
          )
        ),
        user_profiles (
          id,
          display_name,
          positions (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by task instance if provided
    if (taskInstanceId) {
      query = query.eq('task_instance_id', taskInstanceId)
    }

    // Filter by user if provided
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // Filter by date range if provided
    if (startDate) {
      query = query.gte('completion_time', startDate)
    }
    if (endDate) {
      query = query.lte('completion_time', endDate)
    }

    const { data: completionLogs, error } = await query

    if (error) {
      console.error('Error fetching completion logs:', error)
      return NextResponse.json({ error: 'Failed to fetch completion logs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: completionLogs || [],
      meta: {
        total: completionLogs?.length || 0,
        limit
      }
    })
  } catch (error) {
    console.error('Completion log API error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request)

    const body = await request.json()
    const { task_instance_id, action, completion_time, notes } = body

    if (!task_instance_id || !action || !completion_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['completed', 'uncompleted'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get the task instance to calculate time to complete
    const { data: taskInstance, error: taskError } = await supabaseAdmin
      .from('task_instances')
      .select('created_at, due_date, due_time')
      .eq('id', task_instance_id)
      .single()

    if (taskError || !taskInstance) {
      return NextResponse.json({ error: 'Task instance not found' }, { status: 404 })
    }

    // Calculate time to complete if this is a completion action
    let timeToComplete = null
    if (action === 'completed') {
      const createdAt = new Date(taskInstance.created_at)
      const completedAt = new Date(completion_time)
      const diffMs = completedAt.getTime() - createdAt.getTime()
      
      // Convert to PostgreSQL interval format (e.g., "1 day 2 hours 30 minutes")
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      
      const parts = []
      if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`)
      if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
      if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`)
      
      timeToComplete = parts.join(' ') || '0 minutes'
    }

    // Insert completion log entry
    const { data: completionLog, error: insertError } = await supabaseAdmin
      .from('task_completion_log')
      .insert([{
        task_instance_id,
        user_id: user.id,
        action,
        completion_time,
        time_to_complete: timeToComplete,
        notes
      }])
      .select(`
        *,
        task_instances (
          id,
          master_tasks (
            id,
            title
          )
        ),
        user_profiles (
          id,
          display_name
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating completion log:', insertError)
      return NextResponse.json({ error: 'Failed to create completion log' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: completionLog,
      message: `Task ${action} logged successfully`
    }, { status: 201 })
  } catch (error) {
    console.error('Completion log creation error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}