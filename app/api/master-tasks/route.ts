import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('master_tasks')
      .select(`
        *,
        positions (
          id,
          name
        )
      `)

    // Filter by position if provided
    if (positionId) {
      query = query.eq('position_id', positionId)
    }

    // Filter by publish status if provided
    if (status && status !== 'all') {
      query = query.eq('publish_status', status)
    } else if (!status) {
      // By default, only show active tasks (when no status specified)
      query = query.eq('publish_status', 'active')
    }
    // If status is 'all', don't filter by status

    query = query.order('created_at', { ascending: false })

    const { data: masterTasks, error } = await query

    if (error) {
      console.error('Error fetching master tasks:', error)
      return NextResponse.json({ error: 'Failed to fetch master tasks' }, { status: 500 })
    }

    return NextResponse.json(masterTasks || [])
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

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

    return NextResponse.json(masterTask, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}