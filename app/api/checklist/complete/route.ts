import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthEnhanced, logAuditAction, logPositionAuditAction, getClientInfo } from '@/lib/auth-middleware'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuthEnhanced(request)
    
    const body = await request.json()
    const { taskId, action } = body
    
    console.log('Task completion request:', { 
      taskId, 
      action, 
      userId: user.id,
      userType: 'position' in user ? 'position-based' : 'supabase',
      positionId: 'position' in user ? user.position?.id : 'N/A'
    })
    
    // Validate input
    if (!taskId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: taskId and action' 
      }, { status: 400 })
    }
    
    if (!['complete', 'undo'].includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action. Must be "complete" or "undo"' 
      }, { status: 400 })
    }
    
    // Parse virtual task ID (format: master_task_id:date)
    const taskIdParts = taskId.split(':')
    if (taskIdParts.length !== 2) {
      return NextResponse.json({ 
        error: 'Invalid task ID format. Expected format: master_task_id:date' 
      }, { status: 400 })
    }
    
    const [masterTaskId, taskDate] = taskIdParts
    
    console.log('Parsed task info:', { masterTaskId, taskDate })

    // Get user's position information
    let userPositionId: string | null = null
    let userPositionName: string | null = null
    
    if ('position' in user && user.position) {
      userPositionId = user.position.id
      userPositionName = user.position.name
    } else {
      // For Supabase auth users, get position from user_profiles
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select(`
          position_id,
          positions!inner(id, name)
        `)
        .eq('id', user.id)
        .single()
      
      if (profileError || !userProfile?.position_id) {
        return NextResponse.json({ 
          error: 'User position not found. Position-specific completion requires a valid position.' 
        }, { status: 400 })
      }
      
      userPositionId = userProfile.position_id
      userPositionName = (userProfile as any).positions.name
    }

    if (!userPositionId || !userPositionName) {
      return NextResponse.json({ 
        error: 'Unable to determine user position for completion tracking' 
      }, { status: 400 })
    }

    console.log('User position info:', { userPositionId, userPositionName })
    
    // Check if task instance exists
    let { data: existingInstance, error: fetchError } = await supabaseAdmin
      .from('task_instances')
      .select('*')
      .eq('master_task_id', masterTaskId)
      .eq('instance_date', taskDate)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Error fetching existing instance:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch task instance' 
      }, { status: 500 })
    }
    
    console.log('Existing instance:', existingInstance)
    
    // Store old values for audit logging
    const oldValues = existingInstance ? { ...existingInstance } : null
    
    // If no instance exists, create one
    if (!existingInstance) {
      console.log('Creating new task instance')
      const { data: newInstance, error: createError } = await supabaseAdmin
        .from('task_instances')
        .insert({
          master_task_id: masterTaskId,
          instance_date: taskDate,
          due_date: taskDate,
          status: 'not_due',
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating new instance:', createError)
        return NextResponse.json({ 
          error: 'Failed to create task instance' 
        }, { status: 500 })
      }
      
      existingInstance = newInstance
      console.log('Created new instance:', existingInstance)
    }
    
    // Handle position-specific completion
    if (action === 'complete') {
      // Check if this position already has a completion record
      const { data: existingCompletion, error: completionFetchError } = await supabaseAdmin
        .from('task_position_completions')
        .select('*')
        .eq('task_instance_id', existingInstance.id)
        .eq('position_id', userPositionId)
        .maybeSingle()
      
      if (completionFetchError) {
        console.error('Error fetching existing completion:', completionFetchError)
        return NextResponse.json({ 
          error: 'Failed to fetch completion status' 
        }, { status: 500 })
      }
      
      if (existingCompletion && existingCompletion.is_completed) {
        return NextResponse.json({ 
          error: 'Task is already completed for this position' 
        }, { status: 400 })
      }
      
      // Determine who completed the task
      const isPositionAuth = 'position' in user && !!user.position
      const completedBy = isPositionAuth ? null : user.id // position-auth has no auth.users id

      // Create or update position completion record
      const completionData = {
        task_instance_id: existingInstance.id,
        position_id: userPositionId,
        position_name: userPositionName,
        completed_by: completedBy,
        completed_at: new Date().toISOString(),
        uncompleted_at: null,
        is_completed: true,
        updated_at: new Date().toISOString()
      }
      
      let completionResult
      if (existingCompletion) {
        // Update existing record
        const { error: updateCompletionError } = await supabaseAdmin
          .from('task_position_completions')
          .update(completionData)
          .eq('id', existingCompletion.id)
        
        if (updateCompletionError) {
          console.error('Error updating position completion:', updateCompletionError)
          return NextResponse.json({ 
            error: 'Failed to update completion status' 
          }, { status: 500 })
        }
        completionResult = { ...existingCompletion, ...completionData }
      } else {
        // Create new completion record
        const { data: newCompletion, error: createCompletionError } = await supabaseAdmin
          .from('task_position_completions')
          .insert(completionData)
          .select()
          .single()
        
        if (createCompletionError) {
          console.error('Error creating position completion:', createCompletionError)
          return NextResponse.json({ 
            error: 'Failed to create completion record' 
          }, { status: 500 })
        }
        completionResult = newCompletion
      }
      
      console.log('Position completion recorded:', completionResult)
      
    } else if (action === 'undo') {
      // Handle undo - mark position completion as not completed
      const { data: existingCompletion, error: completionFetchError } = await supabaseAdmin
        .from('task_position_completions')
        .select('*')
        .eq('task_instance_id', existingInstance.id)
        .eq('position_id', userPositionId)
        .maybeSingle()
      
      if (completionFetchError) {
        console.error('Error fetching existing completion:', completionFetchError)
        return NextResponse.json({ 
          error: 'Failed to fetch completion status' 
        }, { status: 500 })
      }
      
      let undoNoop = false
      if (!existingCompletion || !existingCompletion.is_completed) {
        // Idempotent undo: nothing to do for this position
        undoNoop = true
      } else {
        // Update completion record to mark as uncompleted
        const { error: undoCompletionError } = await supabaseAdmin
          .from('task_position_completions')
          .update({
            is_completed: false,
            uncompleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCompletion.id)
        
        if (undoCompletionError) {
          console.error('Error undoing position completion:', undoCompletionError)
          return NextResponse.json({ 
            error: 'Failed to undo completion' 
          }, { status: 500 })
        }
        console.log('Position completion undone for:', userPositionName)
      }
    }
    
    // Update the main task instance status based on all position completions
    // Get all position completions for this task
    const { data: allCompletions, error: allCompletionsError } = await supabaseAdmin
      .from('task_position_completions')
      .select('position_name, is_completed')
      .eq('task_instance_id', existingInstance.id)
      .eq('is_completed', true)
    
    if (allCompletionsError) {
      console.error('Error fetching all completions:', allCompletionsError)
      // Don't fail the request, just log the error
    }
    
    // Get the master task to check how many positions it's assigned to
    const { data: masterTask, error: masterTaskError } = await supabaseAdmin
      .from('master_tasks')
      .select('responsibility')
      .eq('id', masterTaskId)
      .single()
    
    if (masterTaskError) {
      console.error('Error fetching master task:', masterTaskError)
      // Don't fail the request, just log the error
    }
    
    // Determine the overall task status
    let newStatus = 'due_today' // Default status
    if (allCompletions && allCompletions.length > 0) {
      // If any position has completed it, mark as done
      // In the future, we might want more sophisticated logic here
      newStatus = 'done'
    }
    
    // Update the main task instance with minimal changes
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    // Keep the legacy fields for backward compatibility, but use the last completion
    if (action === 'complete') {
      updateData.completed_by = user.id
      updateData.completed_by_type = 'position'
      updateData.completed_at = new Date().toISOString()
    } else if (action === 'undo' && (!allCompletions || allCompletions.length === 0)) {
      // Only clear these if no positions have completed the task
      updateData.completed_by = null
      updateData.completed_by_type = null
      updateData.completed_at = null
    }
    
    console.log('Updating task instance with:', updateData)
    
    const { error: updateError } = await supabaseAdmin
      .from('task_instances')
      .update(updateData)
      .eq('id', existingInstance.id)
    
    if (updateError) {
      console.error('Error updating task instance:', updateError)
      console.error('Update data that failed:', updateData)
      console.error('Existing instance ID:', existingInstance.id)
      console.error('Full error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to update task instance',
        details: updateError.message || 'Unknown database error',
        updateData: updateData
      }, { status: 500 })
    }
    
    // Log audit action
    const clientInfo = getClientInfo(request)
    const newValues = { ...existingInstance, ...updateData }
    
    try {
      if ('position' in user && user.position) {
        // Position-based authentication
        await logPositionAuditAction(
          'task_instances',
          existingInstance.id,
          user.position.id,
          action === 'complete' ? 'task_completed' : 'task_reopened',
          oldValues,
          newValues,
          { 
            virtual_task_id: taskId,
            master_task_id: masterTaskId,
            task_date: taskDate,
            ...clientInfo
          },
          existingInstance.id
        )
      } else {
        // Supabase authentication
        await logAuditAction(
          'task_instances',
          existingInstance.id,
          user.id,
          action === 'complete' ? 'task_completed' : 'task_reopened',
          oldValues,
          newValues,
          { 
            virtual_task_id: taskId,
            master_task_id: masterTaskId,
            task_date: taskDate,
            ...clientInfo
          },
          existingInstance.id,
          'position' in user ? user.position?.id : undefined,
          clientInfo.ipAddress,
          clientInfo.userAgent,
          clientInfo.sessionId
        )
      }
    } catch (auditError) {
      console.error('Error logging audit action:', auditError)
      // Don't fail the request if audit logging fails
    }
    
    console.log('Task completion successful')
    
    return NextResponse.json({
      success: true,
      message: action === 'complete' ? 'Task completed successfully' : 'Task reopened successfully',
      data: {
        id: existingInstance.id,
        status: newStatus,
        completed_by: updateData.completed_by ?? null,
        completed_at: updateData.completed_at ?? null
      }
    })
    
  } catch (error) {
    console.error('Task completion API error:', error)
    
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