import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
  try {
    // Create Supabase client with user context for auth check
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get current count before deletion
    const { count: currentCount, error: countError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error counting audit logs:', countError)
      return NextResponse.json({ error: 'Failed to count audit logs' }, { status: 500 })
    }

    // Delete all audit log records
    const { error: deleteError } = await supabase
      .from('audit_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // This will match all records

    if (deleteError) {
      console.error('Error deleting audit logs:', deleteError)
      return NextResponse.json({ error: 'Failed to delete audit logs' }, { status: 500 })
    }

    // Verify deletion
    const { count: finalCount, error: finalCountError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    if (finalCountError) {
      console.error('Error verifying deletion:', finalCountError)
      return NextResponse.json({ error: 'Failed to verify deletion' }, { status: 500 })
    }

    // Log this admin action (create a new audit log entry for the clearing action)
    await supabase
      .from('audit_log')
      .insert([{
        user_id: user.id,
        action: 'bulk_operation',
        metadata: {
          operation: 'clear_audit_log',
          records_deleted: currentCount,
          timestamp: new Date().toISOString()
        }
      }])

    return NextResponse.json({
      success: true,
      message: 'Audit log cleared successfully',
      records_deleted: currentCount,
      remaining_records: finalCount
    })

  } catch (error) {
    console.error('Unexpected error clearing audit log:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}