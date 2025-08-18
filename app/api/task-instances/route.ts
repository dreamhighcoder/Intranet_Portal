import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Require authentication; authorize via code, query via service client
    const user = await requireAuth(request)

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const dateRange = searchParams.get('dateRange')
    const positionIdParam = searchParams.get('position_id')
    const responsibility = searchParams.get('responsibility')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    let query = supabaseAdmin
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
          categories,
          responsibility,
          position_id,
          due_time,
          frequency_rules,
          publish_status,
          sticky_once_off,
          allow_edit_when_locked,
          positions!inner (
            id,
            name
          )
        )
      `)

    // For non-admins, force restrict to their position
    const effectivePositionId = user.role === 'admin' ? positionIdParam : (positionIdParam || user.position_id || null)

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

    // Filter by position if provided/effective
    if (effectivePositionId) {
      query = query.eq('master_tasks.position_id', effectivePositionId)
    }

    // Filter by responsibility if provided (for new responsibility-based filtering)
    if (responsibility) {
      // Use overlaps to check if any of the values in the responsibility array match
      query = query.overlaps('master_tasks.responsibility', [
        responsibility, 
        'Shared (inc. Pharmacist)', 
        'Shared (exc. Pharmacist)'
      ])
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by category if provided
    if (category && category !== 'all') {
      // Check both legacy category field and new categories array
      query = query.or(`master_tasks.category.eq.${category},master_tasks.categories.cs.{${category}}`)
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
        categories: instance.master_tasks.categories,
        responsibility: instance.master_tasks.responsibility,
        position_id: instance.master_tasks.position_id,
        due_time: instance.master_tasks.due_time,
        frequency_rules: instance.master_tasks.frequency_rules,
        publish_status: instance.master_tasks.publish_status,
        sticky_once_off: instance.master_tasks.sticky_once_off,
        allow_edit_when_locked: instance.master_tasks.allow_edit_when_locked,
        position: {
          id: instance.master_tasks.positions.id,
          name: instance.master_tasks.positions.name
        }
      }
    })) || []

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only admins can create task instances via API
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { master_task_id, instance_date, due_date, due_time } = body

    if (!master_task_id || !instance_date || !due_date || !due_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: taskInstance, error } = await supabaseAdmin
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
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}