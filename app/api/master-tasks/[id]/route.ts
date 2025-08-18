import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] GET - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] GET - Authentication successful for:', user.email)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: masterTask, error } = await supabase
      .from('master_tasks')
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !masterTask) {
      console.error('Master task not found:', error)
      return NextResponse.json({ error: 'Master task not found' }, { status: 404 })
    }

    return NextResponse.json(masterTask)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] PUT - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] PUT - Authentication successful for:', user.email)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    const {
      title,
      description,
      responsibility,
      categories,
      frequency,
      timing,
      due_time,
      due_date,
      publish_status,
      publish_delay,
      start_date,
      end_date,
      sticky_once_off,
      allow_edit_when_locked,
      // Legacy fields for backward compatibility
      position_id,
      frequency_rules,
      weekdays,
      months,
      default_due_time,
      category,
      publish_delay_date
    } = body

    console.log('Master task [id] PUT - Updating with data:', { 
      title, 
      frequency,
      responsibility,
      categories,
      timing
    })

    // Prepare data for update using new schema
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Only add fields that are explicitly provided in the request
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (frequency !== undefined) updateData.frequency = frequency
    if (timing !== undefined) updateData.timing = timing
    if (due_time !== undefined) updateData.due_time = due_time
    if (due_date !== undefined) updateData.due_date = due_date
    if (publish_status !== undefined) updateData.publish_status = publish_status
    if (publish_delay !== undefined) updateData.publish_delay = publish_delay
    if (responsibility !== undefined) updateData.responsibility = responsibility
    if (categories !== undefined) updateData.categories = categories
    if (sticky_once_off !== undefined) updateData.sticky_once_off = sticky_once_off
    if (allow_edit_when_locked !== undefined) updateData.allow_edit_when_locked = allow_edit_when_locked

    // Legacy field for backward compatibility
    if (categories !== undefined && categories.length > 0) updateData.category = categories[0]

    // Only add start_date and end_date if they have values
    if (start_date) {
      updateData.start_date = start_date
    }
    if (end_date) {
      updateData.end_date = end_date
    }

    let { data: masterTask, error } = await supabase
      .from('master_tasks')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

    // Handle schema cache issue with default_due_time column
    if (error && error.message.includes('default_due_time')) {
      console.log('Schema cache issue detected - retrying without default_due_time field')
      
      // Remove the problematic field and retry
      const { default_due_time, ...updateDataWithoutDueTime } = updateData
      
      const retryResult = await supabase
        .from('master_tasks')
        .update(updateDataWithoutDueTime)
        .eq('id', params.id)
        .select(`
          *,
          positions (
            id,
            name
          )
        `)
        .single()
      
      if (retryResult.error) {
        console.error('Master task update retry failed:', retryResult.error)
        return NextResponse.json({ 
          error: 'Failed to update master task',
          schemaIssue: 'The default_due_time column is not available in the schema cache. Please refresh your database schema.'
        }, { status: 500 })
      }
      
      masterTask = retryResult.data
      error = null
      
      console.log('Master task updated successfully without default_due_time field')
    }

    if (error) {
      console.error('Error updating master task:', error)
      return NextResponse.json({ error: 'Failed to update master task' }, { status: 500 })
    }

    console.log('Master task [id] PUT - Successfully updated task')
    return NextResponse.json(masterTask)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] DELETE - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] DELETE - Authentication successful for:', user.email)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // First, delete all associated task instances
    console.log('Master task [id] DELETE - Deleting associated task instances')
    const { error: instancesError } = await supabase
      .from('task_instances')
      .delete()
      .eq('master_task_id', params.id)

    if (instancesError) {
      console.error('Error deleting task instances:', instancesError)
      return NextResponse.json({ error: 'Failed to delete associated task instances' }, { status: 500 })
    }

    // Then delete the master task
    console.log('Master task [id] DELETE - Deleting master task')
    const { error } = await supabase
      .from('master_tasks')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting master task:', error)
      return NextResponse.json({ error: 'Failed to delete master task' }, { status: 500 })
    }

    console.log('Master task [id] DELETE - Successfully deleted task and instances')
    return NextResponse.json({ message: 'Master task deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}