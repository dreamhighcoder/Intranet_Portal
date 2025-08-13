import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Master task [id] GET - Starting for ID:', params.id)
  try {
    const user = await requireAuth(request)
    console.log('Master task [id] GET - Authentication successful for:', user.email)
    
    // Get the authorization header to create authenticated supabase client
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.substring(7) // Remove 'Bearer ' prefix
    
    const supabase = createServerSupabaseClient()
    
    // Set the session for this request
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      })
    }
    
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
    
    // Get the authorization header to create authenticated supabase client
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.substring(7) // Remove 'Bearer ' prefix
    
    const supabase = createServerSupabaseClient()
    
    // Set the session for this request
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      })
    }
    
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

    // TODO: Trigger regeneration of future task instances
    // This would be handled by a background job or immediate processing

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
    
    // Get the authorization header to create authenticated supabase client
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.substring(7) // Remove 'Bearer ' prefix
    
    const supabase = createServerSupabaseClient()
    
    // Set the session for this request
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      })
    }
    
    const { error } = await supabase
      .from('master_tasks')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting master task:', error)
      return NextResponse.json({ error: 'Failed to delete master task' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Master task deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}