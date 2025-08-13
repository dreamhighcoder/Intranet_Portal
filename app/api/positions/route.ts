import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for positions API to bypass RLS (positions are reference data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching positions:', error)
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
    }

    return NextResponse.json(positions)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}