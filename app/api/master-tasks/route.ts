import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  console.log('Master tasks GET - Starting request processing')
  try {
    console.log('Master tasks GET - Attempting authentication')
    const user = await requireAuth(request)
    console.log('Master tasks GET - Authentication successful for:', user.email)

    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const searchParams = request.nextUrl.searchParams
    const positionId = searchParams.get('position_id')
    const status = searchParams.get('status')

    console.log('Master tasks GET - Fetching data with filters:', { positionId, status })

    // First, let's check if there are ANY master tasks at all
    const { data: allTasks, error: countError } = await supabase
      .from('master_tasks')
      .select('id, title, publish_status')
      .limit(5)

    console.log('Master tasks GET - Raw task count check:', {
      count: allTasks?.length || 0,
      error: countError?.message,
      sampleTasks: allTasks
    })

    let query = supabase
      .from('master_tasks')
      .select(`
        *,
        positions!inner (
          id,
          name
        )
      `)

    // Filter by position if provided
    if (positionId) {
      console.log('Master tasks GET - Filtering by position_id:', positionId)
      query = query.eq('position_id', positionId)
    }

    // Filter by publish status if provided
    if (status && status !== 'all') {
      console.log('Master tasks GET - Filtering by status:', status)
      query = query.eq('publish_status', status)
    } else if (!status) {
      // By default, only show active tasks (when no status specified)
      console.log('Master tasks GET - Filtering by default status: active')
      query = query.eq('publish_status', 'active')
    } else {
      console.log('Master tasks GET - No status filter (showing all)')
    }

    query = query.order('created_at', { ascending: false })

    const { data: masterTasks, error } = await query

    console.log('Master tasks GET - Query result:', {
      success: !error,
      error: error?.message,
      count: masterTasks?.length || 0,
      sampleTask: masterTasks?.[0] ? {
        id: masterTasks[0].id,
        title: masterTasks[0].title,
        hasPosition: !!masterTasks[0].positions,
        positionName: masterTasks[0].positions?.name
      } : null
    })

    if (error) {
      console.error('Master tasks GET - Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch master tasks' }, { status: 500 })
    }

    console.log('Master tasks GET - Successfully fetched', masterTasks?.length || 0, 'tasks')
    return NextResponse.json(masterTasks || [])
  } catch (error) {
    console.error('Master tasks GET - Error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.log('Master tasks GET - Authentication error')
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    
    console.error('Master tasks GET - Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('Master task POST - Starting request processing')
  try {
    console.log('Master task POST - Attempting authentication')
    const user = await requireAuth(request)
    
    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('Master task POST - Access denied, user is not admin')
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.log('Master task creation - User info:', {
      id: user.id,
      email: user.email,
      role: user.role,
      position_id: user.position_id
    })
    
    console.log('Master task POST - Authentication successful, proceeding with task creation')
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    
    const {
      title,
      description,
      position_id,
      responsibility = [],
      categories = [],
      frequency_rules,
      timing,
      due_time,
      due_date,
      publish_status = 'draft',
      publish_delay,
      start_date,
      end_date,
      sticky_once_off = false,
      allow_edit_when_locked = false,
      // Legacy fields for backward compatibility
      frequency,
      weekdays = [],
      months = [],
      default_due_time,
      category,
      publish_delay_date
    } = body

    // Check for required fields - support both new and legacy formats
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // For now, convert new format to legacy format until migration is run
    let legacyFrequency = frequency
    if (frequency_rules && !frequency) {
      // Convert frequency_rules to legacy frequency
      switch (frequency_rules.type) {
        case 'once_off':
          legacyFrequency = 'once_off_sticky'
          break
        case 'daily':
          legacyFrequency = 'every_day'
          break
        case 'weekly':
          legacyFrequency = 'weekly'
          break
        case 'specific_weekdays':
          legacyFrequency = 'specific_weekdays'
          break
        case 'start_of_month':
          legacyFrequency = 'start_every_month'
          break
        case 'end_of_month':
          legacyFrequency = 'end_every_month'
          break
        case 'every_month':
          legacyFrequency = 'every_month'
          break
        case 'certain_months':
          legacyFrequency = 'certain_months'
          break
        default:
          legacyFrequency = 'every_day'
      }
    }

    if (!legacyFrequency) {
      return NextResponse.json({ error: 'Frequency is required' }, { status: 400 })
    }

    // Map responsibility to position_id for backward compatibility
    const responsibilityToPositionMap: { [key: string]: string } = {
      'pharmacist-primary': '550e8400-e29b-41d4-a716-446655440001',
      'pharmacist-supporting': '550e8400-e29b-41d4-a716-446655440002',
      'pharmacy-assistants': '550e8400-e29b-41d4-a716-446655440003',
      'dispensary-technicians': '550e8400-e29b-41d4-a716-446655440004',
      'daa-packers': '550e8400-e29b-41d4-a716-446655440005',
      'operational-managerial': '550e8400-e29b-41d4-a716-446655440006',
      'shared-exc-pharmacist': '550e8400-e29b-41d4-a716-446655440003', // Default to pharmacy assistants
      'shared-inc-pharmacist': '550e8400-e29b-41d4-a716-446655440001'  // Default to primary pharmacist
    }

    // Get position_id from responsibility or use provided position_id
    let mappedPositionId = position_id
    if (!mappedPositionId && responsibility && responsibility.length > 0) {
      mappedPositionId = responsibilityToPositionMap[responsibility[0]]
    }
    // Default to primary pharmacist if no mapping found
    if (!mappedPositionId) {
      mappedPositionId = '550e8400-e29b-41d4-a716-446655440001'
    }

    // Map timing values from TaskForm to database values
    const timingMap: { [key: string]: string } = {
      'opening': 'Morning',
      'anytime': 'Any Time',
      'before-cutoff': 'Before Close',
      'closing': 'Before Close'
    }
    
    const mappedTiming = timing ? (timingMap[timing] || timing) : 'Any Time'

    console.log('Master task POST - Creating task:', title, 'for position:', mappedPositionId)
    
    // Prepare data for insertion using current database schema
    const insertData: any = {
      title,
      description,
      position_id: mappedPositionId,
      frequency: legacyFrequency,
      timing: mappedTiming,
      default_due_time: due_time || default_due_time || '09:00:00',
      category: categories && categories.length > 0 ? categories[0] : (category || 'General'),
      publish_status: publish_status || 'draft',
      sticky_once_off: sticky_once_off || false,
      allow_edit_when_locked: allow_edit_when_locked || false
    }

    // Handle weekdays from frequency_rules or legacy
    if (frequency_rules && frequency_rules.weekdays) {
      insertData.weekdays = frequency_rules.weekdays
    } else if (weekdays && weekdays.length > 0) {
      insertData.weekdays = weekdays
    } else if (legacyFrequency === 'specific_weekdays') {
      insertData.weekdays = [1, 2, 3, 4, 5] // Default to weekdays
    }

    // Handle months from frequency_rules or legacy
    if (frequency_rules && frequency_rules.months) {
      insertData.months = frequency_rules.months
    } else if (months && months.length > 0) {
      insertData.months = months
    }

    console.log('Master task POST - Inserting with frequency:', legacyFrequency, 'timing:', mappedTiming)

    let { data: masterTask, error } = await supabase
      .from('master_tasks')
      .insert([insertData])
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .single()

    // Handle schema cache issue with default_due_time column
    if (error && error.message.includes('default_due_time')) {
      console.log('Schema cache issue detected - retrying without default_due_time field')
      
      // Remove the problematic field and retry
      const { default_due_time, ...insertDataWithoutDueTime } = insertData
      
      const retryResult = await supabase
        .from('master_tasks')
        .insert([insertDataWithoutDueTime])
        .select(`
          *,
          positions (
            id,
            name
          )
        `)
        .single()
      
      if (retryResult.error) {
        console.error('Master task POST - Retry failed:', retryResult.error)
        return NextResponse.json({ 
          error: `Database error: ${retryResult.error.message}`,
          details: retryResult.error.details,
          hint: retryResult.error.hint,
          code: retryResult.error.code,
          schemaIssue: 'The default_due_time column is not available in the schema cache. Please refresh your database schema.'
        }, { status: 500 })
      }
      
      masterTask = retryResult.data
      error = null
      
      console.log('Master task created successfully without default_due_time field')
    }

    if (error) {
      console.error('Master task POST - Database error:', error)
      console.error('Master task POST - Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      console.error('Master task POST - Insert data that failed:', JSON.stringify(insertData, null, 2))
      return NextResponse.json({ 
        error: `Database error: ${error.message}`,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 })
    }

    // After successfully creating the master task, generate task instances
    try {
      const { generateInstancesForTask } = await import('@/lib/task-instance-generator')
      const generationResult = await generateInstancesForTask(masterTask.id)
      console.log('Task instances generated for new master task:', generationResult)
    } catch (generationError) {
      console.error('Error generating task instances for new master task:', generationError)
      // Don't fail the master task creation if instance generation fails
    }

    return NextResponse.json(masterTask, { status: 201 })
  } catch (error) {
    console.error('Master task creation error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.log('Authentication error in master task creation')
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('Admin access required')) {
        console.log('Admin access error in master task creation')
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    console.error('Unexpected error in master task creation:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}