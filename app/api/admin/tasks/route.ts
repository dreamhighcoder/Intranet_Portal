import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, logAuditAction, getClientInfo } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { 
  CreateMasterTaskSchema, 
  UpdateMasterTaskSchema,
  AdminTaskOperationSchema 
} from '@/lib/validation-schemas'
import { generateInstancesForTask } from '@/lib/task-instance-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/admin/tasks - Create new master checklist task
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate and verify admin access
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required',
        details: 'Only administrators can create master tasks'
      }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CreateMasterTaskSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const validatedData = validationResult.data

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create the master task
    const { data: masterTask, error: createError } = await supabase
      .from('master_tasks')
      .insert([{
        title: validatedData.title,
        description: validatedData.description,
        position_id: validatedData.position_id,
        responsibility: validatedData.responsibility,
        categories: validatedData.categories,
        frequency_rules: validatedData.frequency_rules,
        timing: validatedData.timing,
        due_date: validatedData.due_date,
        due_time: validatedData.due_time,
        publish_status: validatedData.publish_status,
        publish_delay: validatedData.publish_delay,
        sticky_once_off: validatedData.sticky_once_off,
        allow_edit_when_locked: validatedData.allow_edit_when_locked,
        created_by: user.id,
        updated_by: user.id
      }])
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating master task:', createError)
      return NextResponse.json({ 
        error: 'Failed to create master task',
        details: createError.message
      }, { status: 500 })
    }

    // Generate task instances for the new master task
    try {
      const generationResult = await generateInstancesForTask(masterTask.id)
      console.log('Task instances generated for new master task:', generationResult)
    } catch (generationError) {
      console.error('Error generating task instances for new master task:', generationError)
      // Don't fail the master task creation if instance generation fails
    }

    // Log the action in audit log using enhanced function
    try {
      const clientInfo = getClientInfo(request)
      await logAuditAction(
        'master_tasks',
        masterTask.id,
        user.id,
        'created',
        {},
        masterTask,
        { 
          timestamp: new Date().toISOString(),
          user_email: user.email,
          operation: 'POST',
          endpoint: '/api/admin/tasks'
        },
        undefined, // taskInstanceId
        undefined, // positionId
        clientInfo.ipAddress,
        clientInfo.userAgent,
        clientInfo.sessionId,
        'supabase'
      )
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Master task created successfully',
      data: masterTask
    }, { status: 201 })

  } catch (error) {
    console.error('Admin tasks POST error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/tasks - Update existing master checklist task
 * Requires admin authentication
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate and verify admin access
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required',
        details: 'Only administrators can update master tasks'
      }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateMasterTaskSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const validatedData = validationResult.data
    const { id, ...updateData } = validatedData

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current task data for audit logging
    const { data: currentTask, error: fetchError } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json({ 
        error: 'Task not found',
        details: 'The specified master task does not exist'
      }, { status: 404 })
    }

    // Update the master task
    const { data: updatedTask, error: updateError } = await supabase
      .from('master_tasks')
      .update({
        ...updateData,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating master task:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update master task',
        details: updateError.message
      }, { status: 500 })
    }

    // Log the action in audit log
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'update_master_task',
          table_name: 'master_tasks',
          record_id: id,
          old_values: currentTask,
          new_values: updatedTask,
          metadata: { 
            timestamp: new Date().toISOString(),
            user_email: user.email
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Master task updated successfully',
      data: updatedTask
    })

  } catch (error) {
    console.error('Admin tasks PATCH error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/tasks - Delete master checklist task
 * Requires admin authentication
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate and verify admin access
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Admin access required',
        details: 'Only administrators can delete master tasks'
      }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get('id')

    if (!taskId) {
      return NextResponse.json({ 
        error: 'Task ID required',
        details: 'Please provide the task ID to delete'
      }, { status: 400 })
    }

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current task data for audit logging
    const { data: currentTask, error: fetchError } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json({ 
        error: 'Task not found',
        details: 'The specified master task does not exist'
      }, { status: 404 })
    }

    // Check if task has active instances
    const { data: activeInstances, error: instancesError } = await supabase
      .from('task_instances')
      .select('id')
      .eq('master_task_id', taskId)
      .eq('status', 'pending')
      .limit(1)

    if (instancesError) {
      console.error('Error checking task instances:', instancesError)
      return NextResponse.json({ 
        error: 'Failed to check task instances',
        details: instancesError.message
      }, { status: 500 })
    }

    if (activeInstances && activeInstances.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete task with active instances',
        details: 'Please complete or remove all pending instances before deleting this task'
      }, { status: 400 })
    }

    // Delete the master task
    const { error: deleteError } = await supabase
      .from('master_tasks')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      console.error('Error deleting master task:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete master task',
        details: deleteError.message
      }, { status: 500 })
    }

    // Log the action in audit log
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'delete_master_task',
          table_name: 'master_tasks',
          record_id: taskId,
          old_values: currentTask,
          new_values: {},
          metadata: { 
            timestamp: new Date().toISOString(),
            user_email: user.email
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Master task deleted successfully'
    })

  } catch (error) {
    console.error('Admin tasks DELETE error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
