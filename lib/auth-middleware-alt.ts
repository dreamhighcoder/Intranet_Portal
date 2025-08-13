import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'viewer'
  position_id?: string
  display_name?: string
}

/**
 * Alternative auth approach using service role client for JWT verification
 */
export async function getAuthUserAlt(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    console.log('Auth middleware ALT - Authorization header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware ALT - Missing or invalid authorization header')
      return null
    }

    const token = authHeader.substring(7)
    console.log('Auth middleware ALT - Token length:', token.length)
    
    // Use service role client to verify JWT and get user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseServiceKey) {
      console.error('Auth middleware ALT - Service role key not configured')
      return null
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify JWT token using admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    console.log('Auth middleware ALT - JWT verification result:', {
      userFound: !!user,
      userEmail: user?.email,
      error: error?.message
    })
    
    if (error || !user) {
      console.log('Auth middleware ALT - JWT verification failed:', error?.message)
      return null
    }

    // Get user profile information using admin client
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('Auth middleware ALT - User profile lookup:', {
      userId: user.id,
      userEmail: user.email,
      profileFound: !!profile,
      profileRole: profile?.role,
      profileError: profileError?.message
    })

    // If profile doesn't exist, create one
    if (!profile && (profileError?.code === 'PGRST116' || profileError?.message?.includes('No rows'))) {
      const isAdmin = user.email?.includes('admin') || false
      
      console.log('Auth middleware ALT - Creating new user profile for:', user.email, 'isAdmin:', isAdmin)
      
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: user.id,
          display_name: user.email?.split('@')[0] || 'User',
          role: isAdmin ? 'admin' : 'viewer',
          position_id: isAdmin ? null : '550e8400-e29b-41d4-a716-446655440001', // Default to Pharmacist Primary for non-admin
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Auth middleware ALT - Error creating user profile:', createError)
        // Try to fetch the profile one more time in case it was created by another request
        const { data: retryProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (retryProfile) {
          profile = retryProfile
          console.log('Auth middleware ALT - Found existing profile on retry:', profile)
        }
      } else {
        profile = newProfile
        console.log('Auth middleware ALT - Successfully created new user profile:', profile)
      }
    }

    return {
      id: user.id,
      email: user.email || '',
      role: (profile?.role as 'admin' | 'viewer') || 'viewer',
      position_id: profile?.position_id || undefined,
      display_name: profile?.display_name || user.email?.split('@')[0] || 'User'
    }

  } catch (error) {
    console.error('Auth middleware ALT - Unexpected error:', error)
    return null
  }
}

export async function requireAuthAlt(request: NextRequest): Promise<AuthUser> {
  console.log('requireAuthAlt - Starting authentication check')
  const user = await getAuthUserAlt(request)
  console.log('requireAuthAlt - getAuthUserAlt result:', {
    userFound: !!user,
    userEmail: user?.email,
    userRole: user?.role
  })
  
  if (!user) {
    console.log('requireAuthAlt - Authentication failed, throwing error')
    throw new Error('Authentication required')
  }
  
  console.log('requireAuthAlt - Authentication successful for:', user.email)
  return user
}