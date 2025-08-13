import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: positions, error } = await supabase
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

    const { data: position, error } = await supabase
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