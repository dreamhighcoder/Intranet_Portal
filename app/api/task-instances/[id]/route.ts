import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { UpdateTaskInstanceSchema } from '@/lib/validation-schemas'
import { australianNowUtcISOString } from '@/lib/timezone-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/task-instances/[id] - Get a specific task instance
 * Requires authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    const { id } = params

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: taskInstance, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error || !taskInstance) {
      return NextResponse.json({ 
        error: 'Task instance not found',
        details: 'The specified task instance does not exist'
      }, { status: 404 })
    }

    // Get position-specific completions for this task instance
    const { data: positionCompletions, error: completionsError } = await supabase
      .from('task_position_completions')
      .select(`
        task_instance_id,
        position_id,
        position_name,
        completed_by,
        completed_at,
        is_completed,
        positions!inner(name)
      `)
      .eq('task_instance_id', id)
      .eq('is_completed', true)

    if (completionsError) {
      console.error('Error fetching position completions:', completionsError)
    }

    // Prepare position completion data for the UI
    const positionCompletionData = (positionCompletions || []).map(completion => ({
      position_name: completion.position_name,
      completed_by: completion.completed_by,
      completed_at: completion.completed_at,
      is_completed: completion.is_completed
    }))

    // Transform data to match frontend expectations
    const transformedData = {
      id: taskInstance.id,
      instance_date: taskInstance.instance_date,
      due_date: taskInstance.due_date,
      due_time: taskInstance.due_time,
      status: taskInstance.status,
      completed_at: taskInstance.completed_at,
      completed_by: taskInstance.completed_by,
      locked: taskInstance.locked,
      acknowledged: taskInstance.acknowledged,
      resolved: taskInstance.resolved,
      created_at: taskInstance.created_at,
      updated_at: taskInstance.updated_at,
      // Add position-specific completion data
      position_completions: positionCompletionData,
      master_task: {
        id: taskInstance.master_tasks.id,
        title: taskInstance.master_tasks.title,
        description: taskInstance.master_tasks.description,
        frequencies: taskInstance.master_tasks.frequencies,
        timing: taskInstance.master_tasks.timing,
        categories: taskInstance.master_tasks.categories,
        responsibility: taskInstance.master_tasks.responsibility,
        position: { 
          id: null, 
          name: taskInstance.master_tasks.responsibility?.[0] || 'Unknown' 
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: transformedData
    })

  } catch (error) {
    console.error('Task instance GET error:', error)
    
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
 * PUT /api/task-instances/[id] - Update a specific task instance
 * Requires authentication
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    const { id: taskId } = params
    
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
        finalUpdateData.completed_at = australianNowUtcISOString()
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

    finalUpdateData.updated_at = australianNowUtcISOString()

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
          frequencies,
          timing,
          categories,
          responsibility
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

    // Get position-specific completions for this task instance
    const { data: positionCompletions, error: completionsError } = await supabase
      .from('task_position_completions')
      .select(`
        task_instance_id,
        position_id,
        position_name,
        completed_by,
        completed_at,
        is_completed,
        positions!inner(name)
      `)
      .eq('task_instance_id', taskId)
      .eq('is_completed', true)

    if (completionsError) {
      console.error('Error fetching position completions:', completionsError)
    }

    // Prepare position completion data for the UI
    const positionCompletionData = (positionCompletions || []).map(completion => ({
      position_name: completion.position_name,
      completed_by: completion.completed_by,
      completed_at: completion.completed_at,
      is_completed: completion.is_completed
    }))

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
            timestamp: australianNowUtcISOString(),
            user_email: user.email,
            action_type: validatedData.status === 'completed' ? 'complete' : 'update'
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    // Transform data to match frontend expectations
    const transformedData = {
      id: updatedInstance.id,
      instance_date: updatedInstance.instance_date,
      due_date: updatedInstance.due_date,
      due_time: updatedInstance.due_time,
      status: updatedInstance.status,
      completed_at: updatedInstance.completed_at,
      completed_by: updatedInstance.completed_by,
      locked: updatedInstance.locked,
      acknowledged: updatedInstance.acknowledged,
      resolved: updatedInstance.resolved,
      created_at: updatedInstance.created_at,
      updated_at: updatedInstance.updated_at,
      // Add position-specific completion data
      position_completions: positionCompletionData,
      master_task: {
        id: updatedInstance.master_tasks.id,
        title: updatedInstance.master_tasks.title,
        description: updatedInstance.master_tasks.description,
        frequencies: updatedInstance.master_tasks.frequencies,
        timing: updatedInstance.master_tasks.timing,
        categories: updatedInstance.master_tasks.categories,
        responsibility: updatedInstance.master_tasks.responsibility,
        position: { 
          id: null, 
          name: updatedInstance.master_tasks.responsibility?.[0] || 'Unknown' 
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Task instance updated successfully',
      data: transformedData
    })

  } catch (error) {
    console.error('Task instance PUT error:', error)
    
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
 * DELETE /api/task-instances/[id] - Delete a specific task instance
 * Requires authentication and admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    // Only admins can delete task instances
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Access denied',
        details: 'Only administrators can delete task instances'
      }, { status: 403 })
    }
    
    const { id: taskId } = params

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the task instance before deletion for audit logging
    const { data: taskInstance, error: fetchError } = await supabase
      .from('task_instances')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError || !taskInstance) {
      return NextResponse.json({ 
        error: 'Task instance not found',
        details: 'The specified task instance does not exist'
      }, { status: 404 })
    }

    // Delete the task instance
    const { error: deleteError } = await supabase
      .from('task_instances')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      console.error('Error deleting task instance:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete task instance',
        details: deleteError.message
      }, { status: 500 })
    }

    // Log the action in audit log
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'delete_task_instance',
          table_name: 'task_instances',
          record_id: taskId,
          old_values: taskInstance,
          new_values: null,
          metadata: { 
            timestamp: new Date().toISOString(),
            user_email: user.email,
            action_type: 'delete'
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Task instance deleted successfully'
    })

  } catch (error) {
    console.error('Task instance DELETE error:', error)
    
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