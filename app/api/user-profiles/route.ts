import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')

    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)

    if (userId) {
      query = query.eq('id', userId)
    }

    const { data: profiles, error } = await query

    if (error) {
      console.error('Error fetching user profiles:', error)
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
    }

    return NextResponse.json(profiles || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      display_name,
      position_id,
      role = 'viewer'
    } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .insert([{
        id,
        display_name,
        position_id,
        role
      }])
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Error creating user profile:', error)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      display_name,
      position_id,
      role
    } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        display_name,
        position_id,
        role
      })
      .eq('id', id)
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}