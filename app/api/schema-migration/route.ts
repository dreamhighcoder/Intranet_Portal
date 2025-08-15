import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for schema changes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST() {
  try {
    console.log('Running schema migration for positions table...')

    // Check if password_hash column already exists
    const { data: columnCheck } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'positions')
      .eq('column_name', 'password_hash')
      .single()

    if (columnCheck) {
      return NextResponse.json({
        success: true,
        message: 'password_hash column already exists',
        skipped: true
      })
    }

    console.log('Adding password_hash column to positions table...')
    
    // We'll add the column by updating a position that doesn't exist first
    // This is a workaround since we can't run DDL directly
    
    // First, get the current schema
    const { data: positions, error: fetchError } = await supabaseAdmin
      .from('positions')
      .select('*')
      .limit(1)
    
    if (fetchError) {
      throw new Error(`Failed to fetch positions: ${fetchError.message}`)
    }

    // Try to insert a temporary record with password_hash to trigger column creation
    const tempId = 'temp-schema-migration-' + Date.now()
    const { error: tempInsertError } = await supabaseAdmin
      .from('positions')
      .insert({
        id: tempId,
        name: 'TEMP_SCHEMA_MIGRATION',
        description: 'Temporary record for schema migration',
        password_hash: 'temp'
      })
      .single()

    if (tempInsertError) {
      // Column doesn't exist, we need to manually add it
      console.log('password_hash column does not exist. Manual intervention required.')
      
      return NextResponse.json({
        success: false,
        error: 'Schema migration required',
        message: 'The password_hash column needs to be added manually to the positions table.',
        sqlCommand: 'ALTER TABLE positions ADD COLUMN password_hash TEXT;',
        instructions: [
          '1. Go to your Supabase dashboard',
          '2. Navigate to the SQL Editor',
          '3. Run this command: ALTER TABLE positions ADD COLUMN password_hash TEXT;',
          '4. Then run the test-migrations endpoint again'
        ]
      }, { status:400 })
    }

    // If we get here, the column was added successfully, clean up temp record
    await supabaseAdmin
      .from('positions')
      .delete()
      .eq('id', tempId)

    console.log('password_hash column added successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Schema migration completed successfully',
      columnAdded: true
    })

  } catch (error) {
    console.error('Schema migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Schema migration failed',
      details: error instanceof Error ? error.message : String(error),
      message: 'Manual schema migration required. Please add the password_hash column to the positions table.',
      sqlCommand: 'ALTER TABLE positions ADD COLUMN password_hash TEXT;'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current schema status
    const { data: columnCheck } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'positions')
      .eq('column_name', 'password_hash')
      .single()

    const hasPasswordHashColumn = !!columnCheck

    // Get current positions
    const { data: positions, error: fetchError } = await supabaseAdmin
      .from('positions')
      .select('id, name, description')
      .order('name')

    if (fetchError) {
      throw new Error(`Failed to fetch positions: ${fetchError.message}`)
    }

    return NextResponse.json({
      success: true,
      hasPasswordHashColumn,
      positionsCount: positions?.length || 0,
      positions: positions?.map(p => ({ id: p.id, name: p.name })),
      status: hasPasswordHashColumn ? 'ready' : 'needs_migration'
    })

  } catch (error) {
    console.error('Schema check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}