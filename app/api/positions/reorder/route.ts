import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Service role client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Payload shape: { order: Array<{ id: string, display_order: number }> }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const order: Array<{ id: string; display_order: number }> = body?.order || []

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 })
    }

    // Validate there is no administrator in payload
    const { data: namesMap, error: namesError } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .in('id', order.map(o => o.id))

    if (namesError) {
      console.error('Reorder - fetch names error:', namesError)
      return NextResponse.json({ error: 'Failed to validate positions' }, { status: 500 })
    }

    const invalid = (namesMap || []).find(p => p.name === 'Administrator')
    if (invalid) {
      return NextResponse.json({ error: 'Administrator positions cannot be reordered' }, { status: 400 })
    }

    // Perform updates in a transaction-like manner (Supabase lacks multi-update in one call)
    for (const item of order) {
      const { error } = await supabaseAdmin
        .from('positions')
        .update({ display_order: item.display_order })
        .eq('id', item.id)
      if (error) {
        console.error('Reorder - update error for', item.id, error)
        return NextResponse.json({ error: 'Failed to update display order' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}