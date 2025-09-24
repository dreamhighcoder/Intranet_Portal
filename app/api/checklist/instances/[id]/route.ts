import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import type { ChecklistInstanceStatus } from '@/types/checklist'
import { australianNowUtcISOString } from '@/lib/timezone-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

/**
 * PUT /api/checklist/instances/[id] - Update checklist instance
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    const instanceId = params.id
    
    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID required' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { status, notes, completed_at, completed_by } = body

    // Validate status if provided
    const validStatuses: ChecklistInstanceStatus[] = ['pending', 'in_progress', 'completed', 'skipped', 'overdue']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status',
        details: `Status must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }

    // Get current instance for audit logging
    const { data: currentInstance, error: fetchError } = await supabaseAdmin
      .from('checklist_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (fetchError || !currentInstance) {
      return NextResponse.json({ 
        error: 'Instance not found',
        details: 'The specified checklist instance does not exist'
      }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      // Persist timestamps in UTC generated from Australia/Hobart "now"
      updated_at: australianNowUtcISOString()
    }

    if (status !== undefined) {
      updateData.status = status
      
      if (status === 'completed') {
        updateData.completed_at = completed_at || australianNowUtcISOString()
        updateData.completed_by = completed_by || user.id
      } else if (status !== 'completed' && currentInstance.status === 'completed') {
        // Undoing completion
        updateData.completed_at = null
        updateData.completed_by = null
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    // Update the checklist instance
    const { data: updatedInstance, error: updateError } = await supabaseAdmin
      .from('checklist_instances')
      .update(updateData)
      .eq('id', instanceId)
      .select(`
        *,
        master_task:master_tasks (
          id,
          title,
          description,
          timing,
          due_time,
          responsibility,
          categories,
          frequency_rules
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating checklist instance:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update instance',
        details: updateError.message
      }, { status: 500 })
    }

    // Log the action for audit trail
    try {
      await supabaseAdmin
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: status === 'completed' ? 'completed' : 'updated',
          table_name: 'checklist_instances',
          record_id: instanceId,
          old_values: currentInstance,
          new_values: updatedInstance,
          metadata: { 
            timestamp: new Date().toISOString(),
            user_role: user.role,
            action_type: status === 'completed' ? 'complete' : 'update'
          }
        }])
    } catch (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Instance updated successfully',
      data: updatedInstance
    })

  } catch (error) {
    console.error('Checklist instance update error:', error)
    
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
 * GET /api/checklist/instances/[id] - Get specific checklist instance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    const instanceId = params.id
    
    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID required' }, { status: 400 })
    }

    // Get the checklist instance
    const { data: instance, error } = await supabaseAdmin
      .from('checklist_instances')
      .select(`
        *,
        master_task:master_tasks (
          id,
          title,
          description,
          timing,
          due_time,
          responsibility,
          categories,
          frequency_rules
        )
      `)
      .eq('id', instanceId)
      .single()

    if (error || !instance) {
      return NextResponse.json({ 
        error: 'Instance not found',
        details: 'The specified checklist instance does not exist'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: instance
    })

  } catch (error) {
    console.error('Checklist instance get error:', error)
    
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