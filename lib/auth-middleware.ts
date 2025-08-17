import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'viewer'
  position_id?: string
  display_name?: string
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const positionAuthHeader = request.headers.get('x-position-auth')
    
    console.log('Auth middleware - Authorization header present:', !!authHeader)
    console.log('Auth middleware - Position auth header:', positionAuthHeader)
    console.log('Auth middleware - All headers:', Object.fromEntries(request.headers.entries()))
    
    // Handle position-based authentication first
    if (positionAuthHeader === 'true') {
      const userId = request.headers.get('x-position-user-id')
      const userRole = request.headers.get('x-position-user-role') as 'admin' | 'viewer'
      const displayName = request.headers.get('x-position-display-name')
      
      console.log('Auth middleware - Position auth data:', { userId, userRole, displayName })
      
      if (userId && userRole) {
        return {
          id: userId,
          email: `${userId}@position.local`, // Synthetic email for position-based auth
          role: userRole,
          position_id: userRole === 'admin' ? undefined : userId,
          display_name: displayName || userId
        }
      }
      
      console.log('Auth middleware - Invalid position auth data')
      return null
    }
    
    // Handle Supabase Bearer token authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware - Missing or invalid authorization header, returning null')
      return null
    }

    const token = authHeader.substring(7)
    console.log('Auth middleware - Token length:', token.length)
    console.log('Auth middleware - Token preview:', token.substring(0, 30) + '...')
    
    // Create server supabase client with the JWT token
    const supabase = createServerSupabaseClient()
    
    // Set the JWT token for this request
    console.log('Auth middleware - Setting session with token')
    const sessionResult = await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    })
    
    console.log('Auth middleware - Set session result:', {
      success: !sessionResult.error,
      error: sessionResult.error?.message,
      userExists: !!sessionResult.data?.user
    })
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('Auth middleware - Supabase getUser result:', {
      userFound: !!user,
      userEmail: user?.email,
      error: error?.message
    })
    
    if (error || !user) {
      console.log('Auth middleware - User verification failed:', error?.message)
      return null
    }

    // Get user profile information
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('Auth middleware - User profile lookup:', {
      userId: user.id,
      userEmail: user.email,
      profileFound: !!profile,
      profileError: profileError?.message,
      profileRole: profile?.role
    })

    // If profile doesn't exist, create one
    if (!profile && (profileError?.code === 'PGRST116' || profileError?.message?.includes('No rows'))) {
      const isAdmin = user.email?.includes('admin') || false
      
      console.log('Creating new user profile for:', user.email, 'isAdmin:', isAdmin)
      
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          display_name: user.email?.split('@')[0] || 'User',
          role: isAdmin ? 'admin' : 'viewer',
          position_id: isAdmin ? null : '550e8400-e29b-41d4-a716-446655440001', // Default to Pharmacist Primary for non-admin
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating user profile in middleware:', createError)
        // Try to fetch the profile one more time in case it was created by another request
        const { data: retryProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (retryProfile) {
          profile = retryProfile
          console.log('Found existing profile on retry:', profile)
        }
      } else {
        profile = newProfile
        console.log('Successfully created new user profile:', profile)
      }
    }

    return {
      id: user.id,
      email: user.email || '',
      role: profile?.role || 'viewer',
      position_id: profile?.position_id,
      display_name: profile?.display_name
    }
  } catch (error) {
    console.error('Error getting auth user:', error)
    return null
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  console.log('requireAuth - Starting authentication check')
  const user = await getAuthUser(request)
  console.log('requireAuth - getAuthUser result:', {
    userFound: !!user,
    userEmail: user?.email,
    userRole: user?.role
  })
  
  if (!user) {
    console.log('requireAuth - Authentication failed, throwing error')
    throw new Error('Authentication required')
  }
  
  console.log('requireAuth - Authentication successful for:', user.email)
  return user
}

export async function requireAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}

export async function requirePosition(request: NextRequest, allowedPositions: string[]): Promise<AuthUser> {
  const user = await requireAuth(request)
  if (!user.position_id || !allowedPositions.includes(user.position_id)) {
    throw new Error('Position access required')
  }
  return user
}

export function canAccessPosition(user: AuthUser, positionId: string): boolean {
  // Admins can access all positions
  if (user.role === 'admin') {
    return true
  }
  
  // Users can only access their own position
  return user.position_id === positionId
}

export function canEditTask(user: AuthUser, taskPositionId?: string): boolean {
  // Admins can edit all tasks
  if (user.role === 'admin') {
    return true
  }
  
  // Users can only edit tasks for their position or shared tasks
  return !taskPositionId || user.position_id === taskPositionId
}

export async function logAuditAction(
  tableName: string,
  recordId: string,
  userId: string | null,
  action: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  metadata?: Record<string, any>,
  taskInstanceId?: string,
  positionId?: string,
  ipAddress?: string,
  userAgent?: string,
  sessionId?: string,
  authType: 'supabase' | 'position' = 'supabase'
) {
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert([{
        table_name: tableName,
        record_id: recordId,
        user_id: userId,
        action,
        old_values: oldValues,
        new_values: newValues,
        metadata,
        task_instance_id: taskInstanceId,
        position_id: positionId,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
        auth_type: authType
      }])

    if (error) {
      console.error('Error logging audit action:', error)
    }
  } catch (error) {
    console.error('Unexpected error logging audit action:', error)
  }
}

/**
 * Enhanced audit logging for position-based authentication
 */
export async function logPositionAuditAction(
  tableName: string,
  recordId: string,
  positionId: string,
  action: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  metadata?: Record<string, any>,
  taskInstanceId?: string
) {
  return logAuditAction(
    tableName,
    recordId,
    null, // user_id is null for position-based auth
    action,
    oldValues,
    newValues,
    metadata,
    taskInstanceId,
    positionId,
    undefined, // ip_address
    undefined, // user_agent
    undefined, // session_id
    'position' // auth_type
  )
}

export function createAuthResponse(error: string, status: number = 401) {
  return Response.json({ error }, { status })
}

// Helper to extract user ID from various request formats
export function getUserIdFromRequest(request: any): string | null {
  try {
    // Try to get from body
    if (request.body && typeof request.body === 'object') {
      return request.body.user_id || request.body.userId || request.body.completed_by
    }
    
    // Try to get from query params
    if (request.nextUrl && request.nextUrl.searchParams) {
      return request.nextUrl.searchParams.get('user_id')
    }
    
    return null
  } catch {
    return null
  }
}

// Position mapping for the 6 main position types
export const POSITION_TYPES = {
  'pharmacist-primary': 'Pharmacist (Primary)',
  'pharmacist-supporting': 'Pharmacist (Supporting)', 
  'pharmacy-assistants': 'Pharmacy Assistants',
  'dispensary-technicians': 'Dispensary Technicians',
  'daa-packers': 'DAA Packers',
  'operational-managerial': 'Operational/Managerial'
} as const

export type PositionType = keyof typeof POSITION_TYPES

/**
 * Extract client information from request for audit logging
 */
export function getClientInfo(request: any): {
  ipAddress?: string
  userAgent?: string
  sessionId?: string
} {
  try {
    const ipAddress = request.headers?.get('X-Forwarded-For') || 
                     request.headers?.get('X-Real-IP') || 
                     request.headers?.get('CF-Connecting-IP') ||
                     'unknown'
    
    const userAgent = request.headers?.get('User-Agent') || 'unknown'
    const sessionId = request.headers?.get('X-Session-Id') || undefined
    
    return {
      ipAddress: ipAddress === 'unknown' ? undefined : ipAddress,
      userAgent: userAgent === 'unknown' ? undefined : userAgent,
      sessionId
    }
  } catch (error) {
    console.error('Error extracting client info from request:', error)
    return {}
  }
}

/**
 * Enhanced authentication check that supports both Supabase and position-based auth
 */
export async function requireAuthEnhanced(request: NextRequest): Promise<AuthUser | PositionAuthUser> {
  try {
    // First try Supabase authentication
    try {
      const supabaseUser = await requireAuth(request)
      return supabaseUser
    } catch (error) {
      // If Supabase auth fails, try position-based auth
      const positionUserId = request.headers.get('X-Position-User-Id')
      const positionUserRole = request.headers.get('X-Position-User-Role')
      const positionDisplayName = request.headers.get('X-Position-Display-Name')
      
      if (positionUserId && positionUserRole && positionDisplayName) {
        // This is a position-based authenticated request
        const positionUser: PositionAuthUser = {
          id: positionUserId,
          position: {
            id: positionUserId,
            name: positionUserRole,
            displayName: positionDisplayName,
            password: '', // Not needed for validation
            role: positionUserRole as 'admin' | 'viewer',
            is_super_admin: positionUserRole === 'admin'
          },
          role: positionUserRole as 'admin' | 'viewer',
          displayName: positionDisplayName,
          isAuthenticated: true,
          loginTime: new Date(),
          isSuperAdmin: positionUserRole === 'admin',
          sessionId: request.headers.get('X-Session-Id') || 'unknown',
          ipAddress: request.headers.get('X-Forwarded-For'),
          userAgent: request.headers.get('User-Agent'),
          lastActivity: new Date()
        }
        
        return positionUser
      }
      
      // Neither authentication method worked
      throw new Error('Authentication required')
    }
  } catch (error) {
    console.error('Enhanced authentication failed:', error)
    throw error
  }
}