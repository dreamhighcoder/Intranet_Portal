import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication and admin role
    const user = await requireAuth(request)
    
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    // Get current count before deletion
    const { count: currentCount, error: countError } = await supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error counting audit logs:', countError)
      return NextResponse.json({ error: 'Failed to count audit logs' }, { status: 500 })
    }

    // Delete all audit log records
    const { error: deleteError } = await supabaseAdmin
      .from('audit_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // This will match all records

    if (deleteError) {
      console.error('Error deleting audit logs:', deleteError)
      return NextResponse.json({ error: 'Failed to delete audit logs' }, { status: 500 })
    }

    // Verify deletion
    const { count: finalCount, error: finalCountError } = await supabaseAdmin
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