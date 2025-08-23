import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    console.log('Public holidays GET - Starting request processing')
    
    // Authenticate the user
    const user = await requireAuth(request)
    console.log('Public holidays GET - Authentication successful for:', user.email)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
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

    console.log('Public holidays GET - Executing query...')
    const { data: holidays, error } = await query

    if (error) {
      console.error('Public holidays GET - Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch public holidays' }, { status: 500 })
    }

    console.log('Public holidays GET - Query successful, found', holidays?.length || 0, 'holidays')
    return NextResponse.json(holidays || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const user = await requireAuth(request)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
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
    console.log('Public holidays PATCH - Starting request processing')
    
    // Authenticate the user
    const user = await requireAuth(request)
    console.log('Public holidays PATCH - Authentication successful for:', user.email)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    const { date, name, region, source, originalRegion } = body
    
    console.log('Public holidays PATCH - Request data:', { date, name, region, source, originalRegion })

    if (!date || !name) {
      console.log('Public holidays PATCH - Missing required fields')
      return NextResponse.json({ error: 'Date and name are required' }, { status: 400 })
    }

    // Build the update query - use originalRegion if provided for precise identification
    let updateQuery = supabase
      .from('public_holidays')
      .update({ name, region, source })
      .eq('date', date)
    
    // If originalRegion is provided, use it to identify the exact record
    if (originalRegion) {
      updateQuery = updateQuery.eq('region', originalRegion)
      console.log('Public holidays PATCH - Updating with date and originalRegion:', { date, originalRegion })
    } else {
      console.log('Public holidays PATCH - Updating with date only:', { date })
    }

    const { data: holiday, error } = await updateQuery
      .select()
      .single()

    if (error) {
      console.error('Public holidays PATCH - Database error:', error)
      return NextResponse.json({ error: 'Failed to update public holiday' }, { status: 500 })
    }

    console.log('Public holidays PATCH - Successfully updated holiday:', holiday)
    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Public holidays PATCH - Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    console.log('Public holidays DELETE - Starting request processing')
    
    // Authenticate the user
    const user = await requireAuth(request)
    console.log('Public holidays DELETE - Authentication successful for:', user.email)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    const { date, region } = body
    
    console.log('Public holidays DELETE - Request data:', { date, region })

    if (!date) {
      console.log('Public holidays DELETE - Missing date parameter')
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // First, get the record that will be deleted for audit logging
    let selectQuery = supabase
      .from('public_holidays')
      .select('*')
      .eq('date', date)
    
    if (region) {
      selectQuery = selectQuery.eq('region', region)
    }
    
    const { data: holidayToDelete, error: selectError } = await selectQuery.single()
    
    if (selectError) {
      console.error('Public holidays DELETE - Error fetching holiday to delete:', selectError)
      return NextResponse.json({ 
        error: 'Holiday not found', 
        details: 'No matching holiday found to delete' 
      }, { status: 404 })
    }

    console.log('Public holidays DELETE - Found holiday to delete:', holidayToDelete)

    // Build the delete query - if region is provided, use it for precise deletion
    let deleteQuery = supabase
      .from('public_holidays')
      .delete()
      .eq('date', date)
    
    // If region is provided, add it to the query for precise deletion
    if (region) {
      deleteQuery = deleteQuery.eq('region', region)
      console.log('Public holidays DELETE - Deleting with date and region:', { date, region })
    } else {
      console.log('Public holidays DELETE - Deleting with date only:', { date })
    }

    const { error, count } = await deleteQuery

    if (error) {
      console.error('Public holidays DELETE - Database error:', error)
      
      // Check if it's the audit constraint error
      if (error.message && error.message.includes('audit_log_action_check')) {
        console.log('Public holidays DELETE - Audit constraint error detected, providing helpful message')
        return NextResponse.json({ 
          error: 'Database constraint error', 
          details: 'The audit log system needs to be updated to support holiday deletion. Please visit the Admin > Fix Audit page to resolve this issue.',
          code: error.code,
          hint: 'Go to /admin/fix-audit to apply the database fix, or contact your administrator.',
          fixUrl: '/admin/fix-audit'
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to delete public holiday', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    console.log('Public holidays DELETE - Successfully deleted', count, 'record(s)')
    
    // Check if any records were actually deleted
    if (count === 0) {
      console.log('Public holidays DELETE - No records were deleted, possibly not found')
      return NextResponse.json({ 
        error: 'Holiday not found', 
        details: 'No matching holiday found to delete' 
      }, { status: 404 })
    }

    // Manually log the audit entry with a valid action since the trigger might fail
    try {
      console.log('Public holidays DELETE - Manually logging audit entry...')
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          action: 'deleted', // Use 'deleted' instead of 'holiday_deleted' to avoid constraint issues
          old_values: holidayToDelete,
          new_values: null,
          metadata: {
            table: 'public_holidays',
            operation: 'DELETE',
            timestamp: new Date().toISOString(),
            date: holidayToDelete.date,
            region: holidayToDelete.region,
            manual_audit: true,
            reason: 'Trigger failed due to constraint, logged manually'
          }
        })
      console.log('Public holidays DELETE - Manual audit entry logged successfully')
    } catch (auditError) {
      console.warn('Public holidays DELETE - Failed to log manual audit entry:', auditError)
      // Don't fail the delete operation if audit logging fails
    }

    return NextResponse.json({ 
      message: 'Public holiday deleted successfully',
      deletedCount: count 
    })
  } catch (error) {
    console.error('Public holidays DELETE - Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}