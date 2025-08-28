import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Use service role key for positions API to bypass RLS (positions are reference data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Positions should be publicly accessible for the login modal
    // No authentication required for reading positions
    console.log('Positions GET - Public access request for login modal')

    // Try to select all fields including password_hash, but fall back gracefully
    let selectFields = '*'
    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select(selectFields)
      // Prefer explicit display order if available, then name
      // Order by display_order; NULLs (admins) should sort last
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name')

    console.log('Positions GET - Query result:', {
      success: !error,
      error: error?.message,
      count: positions?.length || 0,
      samplePosition: positions?.[0] ? {
        id: positions[0].id,
        name: positions[0].name,
        hasPasswordHash: 'password_hash' in positions[0],
        passwordHashValue: positions[0].password_hash ? positions[0].password_hash.substring(0, 10) + '...' : 'NONE'
      } : null,
      allPositions: positions?.map(p => ({
        id: p.id,
        name: p.name,
        hasPasswordHash: !!p.password_hash,
        passwordHashLength: p.password_hash?.length || 0
      }))
    })

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

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for creating positions
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { name, description, password } = body

    console.log('Creating position with data:', { name, description, hasPassword: !!password })

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate UUID for the new position
    const positionId = randomUUID()
    
    // Prepare insert data
    const insertData: any = { 
      id: positionId,
      name: name.trim(), 
      description: description?.trim() || null 
    }
    
    // Try to add password if provided
    if (password) {
      try {
        // Check for duplicate admin passwords if this is an admin position
        const isAdminPosition = name.toLowerCase().includes('administrator') || name.toLowerCase().includes('admin')
        
        if (isAdminPosition) {
          // Check if password conflicts with other admin positions
          const { data: existingAdminPositions, error: positionsError } = await supabaseAdmin
            .from('positions')
            .select('password_hash, name')
            .or('name.ilike.%administrator%,name.ilike.%admin%')
            .not('password_hash', 'is', null)
          
          if (positionsError) {
            console.error('Error checking admin positions:', positionsError)
            return NextResponse.json({ error: 'Failed to validate admin password' }, { status: 500 })
          }

          // Check if password matches any existing admin position password
          const encodedPassword = Buffer.from(password).toString('base64')
          const conflictingPosition = existingAdminPositions?.find(pos => pos.password_hash === encodedPassword)
          
          if (conflictingPosition) {
            return NextResponse.json({ 
              error: `This password is already in use by the "${conflictingPosition.name}" position. Please choose a different password.` 
            }, { status: 400 })
          }
        }
        
        // Generate a simple hash for position-based authentication
        const hashedPassword = Buffer.from(password).toString('base64')
        insertData.password_hash = hashedPassword
        console.log('Password hash added to insert data')
      } catch (error) {
        console.warn('Password hashing failed, continuing without password:', error)
      }
    }

    console.log('Insert data prepared:', { ...insertData, password_hash: insertData.password_hash ? '[REDACTED]' : undefined })

    const { data: position, error } = await supabaseAdmin
      .from('positions')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Error creating position:', error)
      
      // Check if it's a schema-related error
      if (error.message?.includes('password_hash') || error.message?.includes('column')) {
        // Try again without password_hash
        const { password_hash, ...insertDataWithoutPassword } = insertData
        console.log('Retrying without password_hash column...')
        
        const { data: retryPosition, error: retryError } = await supabaseAdmin
          .from('positions')
          .insert([insertDataWithoutPassword])
          .select()
          .single()
          
        if (retryError) {
          console.error('Error creating position (retry):', retryError)
          return NextResponse.json({ 
            error: 'Failed to create position', 
            details: retryError.message,
            note: 'The password_hash column may not exist in the database. Position created without password.'
          }, { status: 500 })
        }
        
        console.log('Position created successfully without password:', retryPosition.id)
        return NextResponse.json({
          ...retryPosition,
          warning: 'Position created without password due to database schema limitations'
        }, { status: 201 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to create position', 
        details: error.message 
      }, { status: 500 })
    }

    console.log('Position created successfully:', position.id)
    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}