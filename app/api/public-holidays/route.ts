import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year')
    const region = searchParams.get('region')

    let query = supabase
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true })

    // Filter by year if provided
    if (year) {
      query = query.gte('date', `${year}-01-01`).lt('date', `${parseInt(year) + 1}-01-01`)
    }

    // Filter by region if provided
    if (region) {
      query = query.eq('region', region)
    }

    const { data: holidays, error } = await query

    if (error) {
      console.error('Error fetching public holidays:', error)
      return NextResponse.json({ error: 'Failed to fetch public holidays' }, { status: 500 })
    }

    return NextResponse.json(holidays || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, name, region, source } = body

    if (!date || !name) {
      return NextResponse.json({ error: 'Date and name are required' }, { status: 400 })
    }

    const { data: holiday, error } = await supabase
      .from('public_holidays')
      .insert([{ date, name, region, source }])
      .select()
      .single()

    if (error) {
      console.error('Error creating public holiday:', error)
      return NextResponse.json({ error: 'Failed to create public holiday' }, { status: 500 })
    }

    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { date, name, region, source } = body

    if (!date || !name) {
      return NextResponse.json({ error: 'Date and name are required' }, { status: 400 })
    }

    const { data: holiday, error } = await supabase
      .from('public_holidays')
      .update({ name, region, source })
      .eq('date', date)
      .select()
      .single()

    if (error) {
      console.error('Error updating public holiday:', error)
      return NextResponse.json({ error: 'Failed to update public holiday' }, { status: 500 })
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('public_holidays')
      .delete()
      .eq('date', date)

    if (error) {
      console.error('Error deleting public holiday:', error)
      return NextResponse.json({ error: 'Failed to delete public holiday' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Public holiday deleted successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}