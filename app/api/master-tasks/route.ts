import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  console.log('Master tasks GET - Starting request processing')
  try {
    console.log('Master tasks GET - Attempting authentication')
    const user = await requireAuth(request)
    console.log('Master tasks GET - Authentication successful for:', user.email)

    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const status = searchParams.get('status')

    console.log('Master tasks GET - Fetching data with filters:', { positionId, status })

    // First, let's check if there are ANY master tasks at all
    const { data: allTasks, error: countError } = await supabase
      .from('master_tasks')
      .select('id, title, publish_status')
      .limit(5)

    console.log('Master tasks GET - Raw task count check:', {
      count: allTasks?.length || 0,
      error: countError?.message,
      sampleTasks: allTasks
    })

    let query = supabase
      .from('master_tasks')
      .select(`
        *,
        positions!inner (
          id,
          name
        )
      `)

    // Filter by position if provided
    if (positionId) {
      console.log('Master tasks GET - Filtering by position_id:', positionId)
      query = query.eq('position_id', positionId)
    }

    // Filter by publish status if provided
    if (status && status !== 'all') {
      console.log('Master tasks GET - Filtering by status:', status)
      query = query.eq('publish_status', status)
    } else if (!status) {
      // By default, only show active tasks (when no status specified)
      console.log('Master tasks GET - Filtering by default status: active')
      query = query.eq('publish_status', 'active')
    } else {
      console.log('Master tasks GET - No status filter (showing all)')
    }

    query = query.order('created_at', { ascending: false })

    const { data: masterTasks, error } = await query

    console.log('Master tasks GET - Query result:', {
      success: !error,
      error: error?.message,
      count: masterTasks?.length || 0,
      sampleTask: masterTasks?.[0] ? {
        id: masterTasks[0].id,
        title: masterTasks[0].title,
        hasPosition: !!masterTasks[0].positions,
        positionName: masterTasks[0].positions?.name
      } : null
    })

    if (error) {
      console.error('Master tasks GET - Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch master tasks' }, { status: 500 })
    }

    console.log('Master tasks GET - Successfully fetched', masterTasks?.length || 0, 'tasks')
    return NextResponse.json(masterTasks || [])
  } catch (error) {
    console.error('Master tasks GET - Error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.log('Master tasks GET - Authentication error')
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    
    console.error('Master tasks GET - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('Master task POST - Starting request processing')
  try {
    console.log('Master task POST - Attempting authentication')
    const user = await requireAuth(request)
    
    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('Master task POST - Access denied, user is not admin')
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.log('Master task creation - User info:', {
      id: user.id,
      email: user.email,
      role: user.role,
      position_id: user.position_id
    })
    
    console.log('Master task POST - Authentication successful, proceeding with task creation')
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    const {
      title,
      description,
      position_id,
      frequency,
      weekdays = [],
      months = [],
      timing,
      default_due_time,
      category,
      publish_status = 'draft',
      publish_delay_date,
      sticky_once_off = false,
      allow_edit_when_locked = false
    } = body

    if (!title || !frequency) {
      return NextResponse.json({ error: 'Title and frequency are required' }, { status: 400 })
    }

    console.log('Master task POST - Creating task with data:', { title, position_id, frequency })

    const { data: masterTask, error } = await supabase
      .from('master_tasks')
      .insert([{
        title,
        description,
        position_id,
        frequency,
        weekdays,
        months,
        timing,
        default_due_time,
        category,
        publish_status,
        publish_delay_date,
        sticky_once_off,
        allow_edit_when_locked
      }])
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error creating master task:', error)
      return NextResponse.json({ error: 'Failed to create master task' }, { status: 500 })
    }

    // After successfully creating the master task, generate task instances
    try {
      const { generateInstancesForTask } = await import('@/lib/task-instance-generator')
      const generationResult = await generateInstancesForTask(masterTask.id)
      console.log('Task instances generated for new master task:', generationResult)
    } catch (generationError) {
      console.error('Error generating task instances for new master task:', generationError)
      // Don't fail the master task creation if instance generation fails
    }

    return NextResponse.json(masterTask, { status: 201 })
  } catch (error) {
    console.error('Master task creation error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.log('Authentication error in master task creation')
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('Admin access required')) {
        console.log('Admin access error in master task creation')
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    console.error('Unexpected error in master task creation:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}