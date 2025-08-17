import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { UpdateTaskInstanceSchema } from '@/lib/validation-schemas'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * PUT /api/instances - Update task instance status (complete/uncomplete)
 * Requires authentication
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateTaskInstanceSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const validatedData = validationResult.data
    const { taskId, ...updateData } = body // Extract taskId from body

    if (!taskId) {
      return NextResponse.json({ 
        error: 'Task ID required',
        details: 'Please provide the task ID to update'
      }, { status: 400 })
    }

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current task instance for audit logging
    const { data: currentInstance, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner (
          allow_edit_when_locked,
          sticky_once_off
        )
      `)
      .eq('id', taskId)
      .single()

    if (fetchError || !currentInstance) {
      return NextResponse.json({ 
        error: 'Task instance not found',
        details: 'The specified task instance does not exist'
      }, { status: 404 })
    }

    // Check if task is locked and editing is not allowed
    if (currentInstance.locked && !currentInstance.master_tasks.allow_edit_when_locked) {
      return NextResponse.json({ 
        error: 'Task is locked',
        details: 'This task has been locked and cannot be modified'
      }, { status: 403 })
    }

    // Prepare update data
    const finalUpdateData: any = {}
    
    if (validatedData.status !== undefined) {
      finalUpdateData.status = validatedData.status
      
      if (validatedData.status === 'completed') {
        finalUpdateData.completed_at = new Date().toISOString()
        finalUpdateData.completed_by = user.id
      } else if (validatedData.status !== 'completed' && currentInstance.status === 'completed') {
        // Undoing completion
        finalUpdateData.completed_at = null
        finalUpdateData.completed_by = null
      }
    }

    if (validatedData.notes !== undefined) {
      finalUpdateData.notes = validatedData.notes
    }

    if (validatedData.payload !== undefined) {
      finalUpdateData.payload = validatedData.payload
    }

    finalUpdateData.updated_at = new Date().toISOString()

    // Update the task instance
    const { data: updatedInstance, error: updateError } = await supabase
      .from('task_instances')
      .update(finalUpdateData)
      .eq('id', taskId)
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

    if (updateError) {
      console.error('Error updating task instance:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update task instance',
        details: updateError.message
      }, { status: 500 })
    }

    // Log the action in audit log
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'update_task_instance',
          table_name: 'task_instances',
          record_id: taskId,
          old_values: currentInstance,
          new_values: updatedInstance,
          metadata: { 
            timestamp: new Date().toISOString(),
            user_email: user.email,
            action_type: validatedData.status === 'completed' ? 'complete' : 'update'
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Task instance updated successfully',
      data: updatedInstance
    })

  } catch (error) {
    console.error('Instances API error:', error)
    
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

/**
 * GET /api/instances - Get task instances with filtering
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const dateRange = searchParams.get('dateRange')
    const positionIdParam = searchParams.get('position_id')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const role = searchParams.get('role')

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    console.error('Instances API GET error:', error)
    
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
