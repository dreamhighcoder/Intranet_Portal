import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const dateRange = searchParams.get('dateRange')
    const positionId = searchParams.get('position_id')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    let query = supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner (
          id,
          title,
          description,
          frequency,
          timing,
          category,
          position_id,
          positions!inner (
            id,
            name
          )
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

    // Filter by position if provided
    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('master_tasks.category', category)
    }

    // Default ordering - due date first, then time
    query = query.order('due_date', { ascending: true })
    query = query.order('due_time', { ascending: true })

    const { data: taskInstances, error } = await query

    if (error) {
      console.error('Error fetching task instances:', error)
      return NextResponse.json({ error: 'Failed to fetch task instances' }, { status: 500 })
    }

    // Transform data to match frontend expectations
    const transformedData = taskInstances?.map(instance => ({
      id: instance.id,
      instance_date: instance.instance_date,
      due_date: instance.due_date,
      due_time: instance.due_time,
      status: instance.status,
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
        frequency: instance.master_tasks.frequency,
        timing: instance.master_tasks.timing,
        category: instance.master_tasks.category,
        position_id: instance.master_tasks.position_id,
        position: {
          id: instance.master_tasks.positions.id,
          name: instance.master_tasks.positions.name
        }
      }
    })) || []

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { master_task_id, instance_date, due_date, due_time } = body

    if (!master_task_id || !instance_date || !due_date || !due_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: taskInstance, error } = await supabase
      .from('task_instances')
      .insert([{
        master_task_id,
        instance_date,
        due_date,
        due_time,
        status: 'not_due'
      }])
      .select(`
        *,
        master_tasks (
          id,
          title,
          description,
          frequency,
          timing,
          category,
          positions (
            id,
            name
          )
        )
      `)
      .single()

    if (error) {
      console.error('Error creating task instance:', error)
      return NextResponse.json({ error: 'Failed to create task instance' }, { status: 500 })
    }

    return NextResponse.json(taskInstance, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}