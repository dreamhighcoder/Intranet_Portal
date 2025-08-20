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
    
    // Determine the user identifier for completed_by field
    let completedBy: string | null = null
    let completedByType: string | null = null
    if (action === 'complete') {
      if ('position' in user && user.position) {
        // For position-based auth, store the position ID
        completedBy = user.position.id
        completedByType = 'position'
      } else {
        // For Supabase auth, use the actual user ID
        completedBy = user.id
        completedByType = 'user'
      }
    }
    
    // Update status - use consistent status values
    const newStatus = action === 'complete' ? 'done' : 'due_today'
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    if (action === 'complete') {
      updateData.completed_by = completedBy
      updateData.completed_by_type = completedByType
      updateData.completed_at = new Date().toISOString()
    } else {
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
        completed_by: completedBy,
        completed_at: updateData.completed_at
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