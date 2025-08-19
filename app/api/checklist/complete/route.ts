import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, action } = body
    
    // Parse virtual task ID (format: master_task_id:date)
    const [masterTaskId, taskDate] = taskId.split(':')
    
    // Check if task instance exists
    let { data: existingInstance } = await supabaseAdmin
      .from('task_instances')
      .select('*')
      .eq('master_task_id', masterTaskId)
      .eq('instance_date', taskDate)
      .maybeSingle()
    
    // If no instance exists, create one
    if (!existingInstance) {
      const { data: newInstance } = await supabaseAdmin
        .from('task_instances')
        .insert({
          master_task_id: masterTaskId,
          instance_date: taskDate,
          due_date: taskDate,
          status: 'not_due',
          is_published: true
        })
        .select()
        .single()
      
      existingInstance = newInstance
    }
    
    // Update status
    const newStatus = action === 'complete' ? 'done' : 'not_due'
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    
    if (action === 'complete') {
      updateData.completed_by = 'test-user'
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_by = null
      updateData.completed_at = null
    }
    
    await supabaseAdmin
      .from('task_instances')
      .update(updateData)
      .eq('id', existingInstance.id)
    
    return NextResponse.json({
      success: true,
      message: action === 'complete' ? 'Task completed successfully' : 'Task reopened successfully'
    })
    
  } catch (error) {
    console.error('Simple completion API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}