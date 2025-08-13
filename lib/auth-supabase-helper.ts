import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAuth, type AuthUser } from '@/lib/auth-middleware'

/**
 * Helper function that handles authentication and returns an authenticated Supabase client
 * along with the user information
 */
export async function getAuthenticatedSupabaseClient(request: NextRequest) {
  // Authenticate the user first
  const user = await requireAuth(request)
  
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
  
  return { user, supabase }
}

/**
 * Helper function for admin-only endpoints
 */
export async function getAuthenticatedAdminSupabaseClient(request: NextRequest) {
  const { user, supabase } = await getAuthenticatedSupabaseClient(request)
  
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  
  return { user, supabase }
}