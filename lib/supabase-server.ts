import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './supabase'

// Server-side Supabase client for API routes
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Server-side Supabase client with user context for API routes
export async function createAuthenticatedSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = await cookies()
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    },
  })
}

// Simple server client for public data
export const supabaseServer = createServerSupabaseClient()