import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Use service role key for positions API to bypass RLS (positions are reference data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Check if this is a position-based auth request
    const isPositionAuth = request.headers.get('X-Position-Auth') === 'true'
    
    if (isPositionAuth) {
      console.log('Positions GET - Position-based auth request, allowing access to reference data')
    } else {
      // For Supabase auth, require authentication
      const user = await requireAuth(request)
      console.log('Positions GET - Supabase authentication successful for:', user.email)
    }

    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select('*')
      .order('name')

    console.log('Positions GET - Query result:', {
      success: !error,
      error: error?.message,
      count: positions?.length || 0,
      samplePosition: positions?.[0] ? {
        id: positions[0].id,
        name: positions[0].name
      } : null
    })

    if (error) {
      console.error('Error fetching positions:', error)
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
    }

    return NextResponse.json(positions)
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for creating positions
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: position, error } = await supabaseAdmin
      .from('positions')
      .insert([{ name, description }])
      .select()
      .single()

    if (error) {
      console.error('Error creating position:', error)
      return NextResponse.json({ error: 'Failed to create position' }, { status: 500 })
    }

    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}