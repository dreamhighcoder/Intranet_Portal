import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'viewer'
  position_id?: string
  display_name?: string
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required')
  }

  const token = authHeader.substring(7)
  
  // Create Supabase client with service role for server-side operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Verify the JWT token
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    console.error('Token verification failed:', error?.message)
    throw new Error('Authentication required')
  }

  console.log('Token verified for user:', user.email)

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Error fetching user profile:', profileError)
    throw new Error('Failed to fetch user profile')
  }

  // If no profile exists, create a default one
  if (!profile) {
    const isAdmin = user.email?.includes('admin') || false
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        display_name: user.email?.split('@')[0] || 'User',
        role: isAdmin ? 'admin' : 'viewer',
        position_id: isAdmin ? null : '550e8400-e29b-41d4-a716-446655440001'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating user profile:', createError)
      throw new Error('Failed to create user profile')
    }

    return {
      id: user.id,
      email: user.email || '',
      role: newProfile.role as 'admin' | 'viewer',
      position_id: newProfile.position_id,
      display_name: newProfile.display_name
    }
  }

  return {
    id: user.id,
    email: user.email || '',
    role: profile.role as 'admin' | 'viewer',
    position_id: profile.position_id,
    display_name: profile.display_name
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  return getAuthenticatedUser(request)
}

export async function requireAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthenticatedUser(request)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}