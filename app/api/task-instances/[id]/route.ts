import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { updateSpecificTaskStatus } from '@/lib/status-manager'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, completed_by, action } = body
    
    const taskInstanceId = params.id

    // Get current task instance to check if it's locked
    const { data: currentInstance, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks!inner (
          allow_edit_when_locked,
          sticky_once_off
        )
      `)
      .eq('id', taskInstanceId)
      .single()

    if (fetchError || !currentInstance) {
      return NextResponse.json({ error: 'Task instance not found' }, { status: 404 })
    }

    // Check if task is locked and editing is not allowed
    if (currentInstance.locked && !currentInstance.master_tasks.allow_edit_when_locked) {
      return NextResponse.json({ error: 'Task is locked and cannot be modified' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {}
    
    if (status !== undefined) {
      updateData.status = status
      
      if (status === 'done') {
        updateData.completed_at = new Date().toISOString()
        updateData.completed_by = completed_by
      } else if (status !== 'done' && currentInstance.status === 'done') {
        // Undoing completion
        updateData.completed_at = null
        updateData.completed_by = null
      }
    }

    // Update the task instance
    const { data: updatedInstance, error: updateError } = await supabase
      .from('task_instances')
      .update(updateData)
      .eq('id', taskInstanceId)
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
      return NextResponse.json({ error: 'Failed to update task instance' }, { status: 500 })
    }

    // Log the action in audit log
    if (action && completed_by) {
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          task_instance_id: taskInstanceId,
          user_id: completed_by,
          action: action,
          old_values: { status: currentInstance.status },
          new_values: { status: status },
          metadata: { 
            timestamp: new Date().toISOString()
          }
        }])

      if (auditError) {
        console.error('Error creating audit log:', auditError)
        // Don't fail the request if audit logging fails
      }
    }

    return NextResponse.json(updatedInstance)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskInstanceId = params.id

    const { data: taskInstance, error } = await supabase
      .from('task_instances')
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
        ),
        audit_log (
          id,
          action,
          actor,
          meta,
          created_at
        )
      `)
      .eq('id', taskInstanceId)
      .single()

    if (error || !taskInstance) {
      return NextResponse.json({ error: 'Task instance not found' }, { status: 404 })
    }

    return NextResponse.json(taskInstance)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// New endpoint for task completion actions with improved status management
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, userId } = body // action: 'complete' | 'undo' | 'acknowledge' | 'resolve'

    // Get current task instance
    const { data: currentTask, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        *,
        master_tasks (
          allow_edit_when_locked,
          sticky_once_off
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json({ error: 'Task instance not found' }, { status: 404 })
    }

    let success = false
    let newStatus = currentTask.status

    switch (action) {
      case 'complete':
        // Check if task can be completed
        if (currentTask.locked && !currentTask.master_tasks.allow_edit_when_locked) {
          return NextResponse.json({ 
            error: 'Cannot complete locked task',
            details: 'This task has been locked. Contact an admin if you need to modify it.'
          }, { status: 403 })
        }
        
        success = await updateSpecificTaskStatus(id, 'done', userId)
        newStatus = 'done'
        break

      case 'undo':
        // Check if task can be undone
        if (currentTask.locked && !currentTask.master_tasks.allow_edit_when_locked) {
          return NextResponse.json({ 
            error: 'Cannot undo locked task',
            details: 'This task has been locked. Contact an admin if you need to modify it.'
          }, { status: 403 })
        }
        
        // Determine appropriate status for undo
        const today = new Date().toISOString().split('T')[0]
        const currentTime = new Date().toTimeString().slice(0, 5)
        
        if (currentTask.due_date === today && currentTime <= currentTask.due_time) {
          newStatus = 'not_due'
        } else if (currentTask.due_date === today) {
          newStatus = 'due_today'
        } else if (currentTask.due_date < today) {
          newStatus = 'overdue'
        } else {
          newStatus = 'not_due'
        }
        
        success = await updateSpecificTaskStatus(id, newStatus, userId)
        break

      case 'acknowledge':
        const { error: ackError } = await supabase
          .from('task_instances')
          .update({ 
            acknowledged: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        success = !ackError
        break

      case 'resolve':
        const { error: resolveError } = await supabase
          .from('task_instances')
          .update({ 
            resolved: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        success = !resolveError
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!success) {
      return NextResponse.json({ error: `Failed to ${action} task` }, { status: 500 })
    }

    // Fetch updated task
    const { data: updatedTask } = await supabase
      .from('task_instances')
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
      .eq('id', id)
      .single()

    return NextResponse.json({
      success: true,
      message: `Task ${action} successful`,
      task: updatedTask
    })

  } catch (error) {
    console.error('Error in task action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}