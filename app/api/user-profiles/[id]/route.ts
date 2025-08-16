import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin authentication for updating user profiles
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { display_name, position_id, role, password, email } = body

    // Update user profile using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        display_name,
        position_id,
        role,
        ...(email && { email: email.trim() }) // Update email if provided
      })
      .eq('id', params.id)
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .single()

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 })
    }

    // If password is provided, update it in Supabase Auth
    if (password) {
      try {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          params.id,
          { password }
        )
        
        if (passwordError) {
          console.error('Error updating user password:', passwordError)
          return NextResponse.json({ 
            error: 'Profile updated but password change failed' 
          }, { status: 207 }) // 207 Multi-Status
        }
      } catch (authError) {
        console.error('Error with auth admin operation:', authError)
        // Continue with profile update even if password fails
      }
    }

    return NextResponse.json(profile)
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
    // Require admin authentication for deleting user profiles
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Check if this user is an admin and if it's the last admin
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      console.error('Error fetching user to delete:', fetchError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If trying to delete an admin, check that it's not the last one
    if (userToDelete.role === 'admin') {
      const { data: adminUsers, error: adminError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')

      if (adminError) {
        console.error('Error counting admins:', adminError)
        return NextResponse.json({ error: 'Failed to verify admin count' }, { status: 500 })
      }

      if (adminUsers.length <= 1) {
        return NextResponse.json({ 
          error: 'Cannot delete the last administrator. At least one administrator must remain.' 
        }, { status: 400 })
      }
    }

    // Delete user profile first using admin client
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', params.id)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }

    // Delete user from Supabase Auth
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(params.id)
      if (authError) {
        console.error('Error deleting user from auth:', authError)
        // Continue even if auth deletion fails
      }
    } catch (authError) {
      console.error('Error with auth admin operation:', authError)
      // Continue even if auth deletion fails
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