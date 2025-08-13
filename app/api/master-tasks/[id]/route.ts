import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
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
      position_id,
      frequency,
      weekdays = [],
      months = [],
      timing,
      default_due_time,
      category,
      publish_status,
      publish_delay_date,
      sticky_once_off,
      allow_edit_when_locked
    } = body

    console.log('Master task [id] PUT - Updating with data:', { title, position_id, frequency })

    const { data: masterTask, error } = await supabase
      .from('master_tasks')
      .update({
        title,
        description,
        position_id,
        frequency,
        weekdays,
        months,
        timing,
        default_due_time,
        category,
        publish_status,
        publish_delay_date,
        sticky_once_off,
        allow_edit_when_locked,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

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