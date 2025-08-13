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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }

    // Get user profile information
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

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
  const user = await getAuthUser(request)
  if (!user) {
    throw new Error('Authentication required')
  }
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
  taskInstanceId: string,
  userId: string,
  action: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  metadata?: Record<string, any>
) {
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert([{
        task_instance_id: taskInstanceId,
        user_id: userId,
        action,
        old_values: oldValues,
        new_values: newValues,
        metadata
      }])

    if (error) {
      console.error('Error logging audit action:', error)
    }
  } catch (error) {
    console.error('Unexpected error logging audit action:', error)
  }
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