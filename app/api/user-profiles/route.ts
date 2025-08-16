import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'

// Create admin client for user creation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for viewing user profiles
    const user = await requireAdmin(request)
    console.log('User profiles GET - Admin authentication successful for:', user.email)

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')

    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)

    if (userId) {
      query = query.eq('id', userId)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error('Error fetching user profiles:', error)
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
    }

    return NextResponse.json(profiles || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for creating users
    const user = await requireAdmin(request)
    console.log('User profiles POST - Admin authentication successful for:', user.email)

    const body = await request.json()
    const {
      id,
      display_name,
      position_id,
      role,
      password
    } = body

    if (!id || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if trying to create an admin user
    if (role === 'admin') {
      // Only super admins can create admin users
      // Check if the current user is a super admin by checking their position
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('position_id')
        .eq('id', user.id)
        .single()
      
      if (currentUserProfile?.position_id) {
        const { data: currentUserPosition } = await supabase
          .from('positions')
          .select('is_super_admin')
          .eq('id', currentUserProfile.position_id)
          .single()
        
        if (!currentUserPosition?.is_super_admin) {
          return NextResponse.json({ 
            error: 'Only Super Admins can create new admin users' 
          }, { status: 403 })
        }
      }
    }

    // Check for duplicate admin passwords if creating an admin
    if (role === 'admin' && position_id) {
      const selectedPosition = await supabase
        .from('positions')
        .select('name')
        .eq('id', position_id)
        .single()
      
      // Check for admin position password conflicts
      if (selectedPosition.data?.name && (
          selectedPosition.data.name.toLowerCase().includes('administrator') || 
          selectedPosition.data.name.toLowerCase().includes('admin')
        )) {
        
        const { data: allAdminPositions, error: positionsError } = await supabase
          .from('positions')
          .select('password_hash, name')
          .or('name.ilike.%administrator%,name.ilike.%admin%')
          .not('password_hash', 'is', null)
        
        if (positionsError) {
          console.error('Error checking admin positions:', positionsError)
          return NextResponse.json({ error: 'Failed to validate admin password' }, { status: 500 })
        }

        // Check if password matches any existing admin position password
        const encodedPassword = btoa(password)
        const conflictingPosition = allAdminPositions?.find(pos => pos.password_hash === encodedPassword)
        
        if (conflictingPosition) {
          return NextResponse.json({ 
            error: `This password is already in use by the "${conflictingPosition.name}" position. Please choose a different password.` 
          }, { status: 400 })
        }
      }
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: id,
      password: password,
      email_confirm: true
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json({ 
        error: authError.message || 'Failed to create user account' 
      }, { status: 400 })
    }

    // Create user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .insert([{
        id: authUser.user.id,
        display_name,
        position_id,
        role
      }])
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Error creating user profile:', error)
      // If profile creation fails, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication for updating users
    const user = await requireAdmin(request)
    console.log('User profiles PUT - Admin authentication successful for:', user.email)

    const body = await request.json()
    const {
      id,
      display_name,
      position_id,
      role,
      password
    } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if changing role to admin
    if (role === 'admin') {
      // Only super admins can promote users to admin
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('position_id')
        .eq('id', user.id)
        .single()
      
      if (currentUserProfile?.position_id) {
        const { data: currentUserPosition } = await supabase
          .from('positions')
          .select('is_super_admin')
          .eq('id', currentUserProfile.position_id)
          .single()
        
        if (!currentUserPosition?.is_super_admin) {
          return NextResponse.json({ 
            error: 'Only Super Admins can promote users to admin role' 
          }, { status: 403 })
        }
      }
    }

    // Check if changing role from admin to non-admin would leave no admins
    if (role !== 'admin') {
      const { data: currentUser, error: currentUserError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', id)
        .single()

      if (currentUserError) {
        console.error('Error fetching current user:', currentUserError)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (currentUser.role === 'admin') {
        const { data: adminUsers, error: adminError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')

        if (adminError) {
          console.error('Error counting admins:', adminError)
          return NextResponse.json({ error: 'Failed to verify admin count' }, { status: 500 })
        }

        if (adminUsers.length <= 1) {
          return NextResponse.json({ 
            error: 'Cannot change role of the last administrator. At least one administrator must remain.' 
          }, { status: 400 })
        }
      }
    }

    // Check for duplicate admin passwords if updating to admin or changing password
    if (role === 'admin' && position_id && password) {
      const selectedPosition = await supabase
        .from('positions')
        .select('name')
        .eq('id', position_id)
        .single()
      
      // Check for admin position password conflicts
      if (selectedPosition.data?.name && (
          selectedPosition.data.name.toLowerCase().includes('administrator') || 
          selectedPosition.data.name.toLowerCase().includes('admin')
        )) {
        
        const { data: allAdminPositions, error: positionsError } = await supabase
          .from('positions')
          .select('password_hash, name')
          .or('name.ilike.%administrator%,name.ilike.%admin%')
          .not('password_hash', 'is', null)
        
        if (positionsError) {
          console.error('Error checking admin positions:', positionsError)
          return NextResponse.json({ error: 'Failed to validate admin password' }, { status: 500 })
        }

        // Check if password matches any existing admin position password
        const encodedPassword = btoa(password)
        const conflictingPosition = allAdminPositions?.find((pos: any) => pos.password_hash === encodedPassword)
        
        if (conflictingPosition) {
          return NextResponse.json({ 
            error: `This password is already in use by the "${conflictingPosition.name}" position. Please choose a different password.` 
          }, { status: 400 })
        }
      }
    }

    // Update password in Supabase Auth if provided
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      })

      if (authError) {
        console.error('Error updating user password:', authError)
        return NextResponse.json({ 
          error: authError.message || 'Failed to update user password' 
        }, { status: 400 })
      }
    }

    // Update user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        display_name,
        position_id,
        role
      })
      .eq('id', id)
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication for deleting users
    const user = await requireAdmin(request)
    console.log('User profiles DELETE - Admin authentication successful for:', user.email)

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if trying to delete an admin user
    const { data: userToDelete, error: fetchError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching user to delete:', fetchError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (userToDelete.role === 'admin') {
      // Only super admins can delete admin users
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('position_id')
        .eq('id', user.id)
        .single()
      
      if (currentUserProfile?.position_id) {
        const { data: currentUserPosition } = await supabase
          .from('positions')
          .select('is_super_admin')
          .eq('id', currentUserProfile.position_id)
          .single()
        
        if (!currentUserPosition?.is_super_admin) {
          return NextResponse.json({ 
            error: 'Only Super Admins can delete admin users' 
          }, { status: 403 })
        }
      }

      // Check if this would leave no admins
      const { data: adminUsers, error: adminError } = await supabase
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

    // Delete user profile
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting user profile:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }

    // Delete user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      // Note: We don't return an error here since the profile was deleted successfully
      // The auth user deletion failure is logged but doesn't affect the main operation
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}