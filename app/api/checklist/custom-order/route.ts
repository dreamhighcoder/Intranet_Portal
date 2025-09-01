import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS for server-side writes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { responsibility, order } = body as {
      responsibility?: string
      order?: Array<{ master_task_id: string; index: number }>
    }

    if (!responsibility || !Array.isArray(order)) {
      return NextResponse.json({ error: 'Missing responsibility or order' }, { status: 400 })
    }

    const roleKey = String(responsibility)

    // Basic validation
    for (const item of order) {
      if (!item || typeof item.master_task_id !== 'string' || typeof item.index !== 'number' || item.index < 0) {
        return NextResponse.json({ error: 'Invalid order item' }, { status: 400 })
      }
    }

    // Perform updates in a transaction-like sequence (Supabase JS doesn't support multi-statement transactions directly)
    // We'll update each master task's custom_order for the given role key
    for (const { master_task_id, index } of order) {
      const { data, error } = await supabaseAdmin
        .from('master_tasks')
        .select('custom_order')
        .eq('id', master_task_id)
        .maybeSingle()

      if (error) {
        console.error('Failed to read current custom_order:', error)
        return NextResponse.json({ error: 'Database read error' }, { status: 500 })
      }

      const current = (data?.custom_order as Record<string, any>) || {}
      const updated = { ...current, [roleKey]: index }

      const { error: updateError } = await supabaseAdmin
        .from('master_tasks')
        .update({ custom_order: updated })
        .eq('id', master_task_id)

      if (updateError) {
        console.error('Failed to update custom_order:', updateError)
        return NextResponse.json({ error: 'Database update error' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Custom order API error:', error)

    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}