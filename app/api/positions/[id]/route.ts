import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Use service role key for positions API to bypass RLS (positions are reference data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin authentication for updating positions
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { name, description, password } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = { name, description }
    
    // If password is provided, validate and hash it
    if (password) {
      // Check for duplicate admin passwords if this is an admin position
      const isAdminPosition = name.toLowerCase().includes('administrator') || name.toLowerCase().includes('admin')
      
      if (isAdminPosition) {
        // Check if password conflicts with other admin positions
        const { data: existingAdminPositions, error: positionsError } = await supabaseAdmin
          .from('positions')
          .select('password_hash, name, id')
          .or('name.ilike.%administrator%,name.ilike.%admin%')
          .not('password_hash', 'is', null)
          .neq('id', params.id) // Exclude the current position being updated
        
        if (positionsError) {
          console.error('Error checking admin positions:', positionsError)
          return NextResponse.json({ error: 'Failed to validate admin password' }, { status: 500 })
        }

        // Check if password matches any existing admin position password
        const encodedPassword = Buffer.from(password).toString('base64')
        const conflictingPosition = existingAdminPositions?.find(pos => pos.password_hash === encodedPassword)
        
        if (conflictingPosition) {
          return NextResponse.json({ 
            error: `This password is already in use by the "${conflictingPosition.name}" position. Please choose a different password.` 
          }, { status: 400 })
        }
      }
      
      // Generate a simple hash for position-based authentication
      const hashedPassword = Buffer.from(password).toString('base64')
      updateData.password_hash = hashedPassword
    }

    const { data: position, error } = await supabaseAdmin
      .from('positions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating position:', error)
      return NextResponse.json({ error: 'Failed to update position' }, { status: 500 })
    }

    return NextResponse.json(position)
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin authentication for deleting positions
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Check if position is in use by users or tasks
    const { data: userProfiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('position_id', params.id)

    const { data: masterTasks } = await supabaseAdmin
      .from('master_tasks')
      .select('id')
      .eq('position_id', params.id)

    if (userProfiles && userProfiles.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete position that is assigned to users' 
      }, { status: 400 })
    }

    if (masterTasks && masterTasks.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete position that has assigned tasks' 
      }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('positions')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting position:', error)
      return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}