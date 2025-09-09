import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { toKebabCase, toDisplayFormat } from '@/lib/responsibility-mapper'
import { getResponsibilityForPosition, getResponsibilityOptions } from '@/lib/position-utils'
import { DEFAULT_DUE_TIMES } from '@/lib/constants'

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
      .select(`*`)

    // Legacy: support filter by position by mapping to responsibility values
    if (positionId) {
      console.log('Master tasks GET - Filtering by responsibility for position_id:', positionId)
      
      const responsibilityValue = await getResponsibilityForPosition(positionId)
      if (responsibilityValue) {
        // Filter by responsibility array containing the responsibility value
        query = query.contains('responsibility', [responsibilityValue])
      }
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

    // Order by custom_order first (if exists and not reset value), then by created_at
    // Note: 999999 is used as a reset value since custom_order has NOT NULL constraint
    query = query.order('custom_order', { ascending: true, nullsLast: true })
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

    // Add due_time based on timing for each task (only if due_time is null/undefined)
    const tasksWithDueTime = (masterTasks || []).map(task => ({
      ...task,
      due_time: task.due_time ?? DEFAULT_DUE_TIMES[task.timing as keyof typeof DEFAULT_DUE_TIMES] ?? '17:00'
    }))

    console.log('Master tasks GET - Successfully fetched', tasksWithDueTime.length, 'tasks')
    return NextResponse.json(tasksWithDueTime)
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
      responsibility = [],
      categories = [],
      frequencies = [],
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
      position_id,
      weekdays = [],
      months = [],
      default_due_time,
      category,
      publish_delay_date
    } = body
    
    console.log('Request body:', body)

    // Check for required fields (Title is optional)
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    if (!responsibility || responsibility.length === 0) {
      return NextResponse.json({ error: 'At least one responsibility is required' }, { status: 400 })
    }
    if (!categories || categories.length === 0) {
      return NextResponse.json({ error: 'At least one category is required' }, { status: 400 })
    }
    // Frequencies array is required
    if (!frequencies || frequencies.length === 0) {
      return NextResponse.json({ error: 'At least one frequency is required' }, { status: 400 })
    }
    if (!timing) {
      return NextResponse.json({ error: 'Timing is required' }, { status: 400 })
    }

    // Note: responsibilities come from the UI dynamic list; server-side strict validation is removed to avoid blocking creation.

    // The new schema uses responsibility values directly, no position_id mapping needed

    // Timing values are now stored directly as per new schema
    // No mapping needed - use the values directly from the form

    // Block Administrator responsibility at API level as well (defense-in-depth)
    if (responsibility.some((r: string) => r.toLowerCase().includes('administrator'))) {
      return NextResponse.json({ error: 'Administrator cannot be assigned as a responsibility' }, { status: 400 })
    }

    console.log('Master task POST - Creating task:', title)
    
    // Prepare data for insertion using the new schema
    const insertData: any = {
      title: (title ?? '').toString(),
      description,
      responsibility: responsibility && responsibility.length > 0 ? responsibility : [],
      categories: categories && categories.length > 0 ? categories : ['general-pharmacy-operations'],
      timing: timing,
      due_time: due_time || '09:00:00',
      publish_status: publish_status || 'draft',
      sticky_once_off: sticky_once_off || false,
      allow_edit_when_locked: allow_edit_when_locked || false
    }
    
    // Store frequencies array
    insertData.frequencies = frequencies
    
    // Note: position_id is no longer used in the new schema
    // The responsibility array field is used instead
    
    // Handle optional date fields
    if (due_date && due_date.trim() !== '') {
      insertData.due_date = due_date
    }
    
    if (start_date && start_date.trim() !== '') {
      insertData.start_date = start_date
    }
    
    if (end_date && end_date.trim() !== '') {
      insertData.end_date = end_date
    }
    
    // Only add publish_delay if it has valid value (renamed from publish_delay_date)
    if (publish_delay && publish_delay.trim() !== '') {
      insertData.publish_delay = publish_delay
    }

    // Optional legacy fields: keep if provided (harmless for updated schema)
    if (weekdays && weekdays.length > 0) {
      insertData.weekdays = weekdays
    }
    if (months && months.length > 0) {
      insertData.months = months
    }

    console.log('Master task POST - Inserting with timing:', timing)

    let { data: masterTask, error } = await supabase
      .from('master_tasks')
      .insert([insertData])
      .select('*')
      .single()

    // Handle database errors
    if (error) {
      console.error('Master task POST - Database error:', error)
      console.error('Master task POST - Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      console.error('Master task POST - Insert data that failed:', JSON.stringify(insertData, null, 2))
      
      // Provide more specific error messages based on the error
      if (error.message.includes('responsibility') && error.message.includes('not found')) {
        return NextResponse.json({ 
          error: 'Database schema issue: responsibility column not found',
          details: 'The database schema migration may not have been applied correctly.',
          hint: 'Run the database migration: supabase/migrations/001_add_master_checklist_and_instances.sql'
        }, { status: 500 })
      }
      
      if (error.message.includes('categories') && error.message.includes('not found')) {
        return NextResponse.json({ 
          error: 'Database schema issue: categories column not found',
          details: 'The database schema migration may not have been applied correctly.',
          hint: 'Run the database migration: supabase/migrations/001_add_master_checklist_and_instances.sql'
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: `Database error: ${error.message}`,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, { status: 500 })
    }



    // After successfully creating the master task, generate task instances for today and future dates
    try {
      const { runNewDailyGeneration } = await import('@/lib/new-task-generator')
      const { getAustralianToday } = await import('@/lib/timezone-utils')
      
      const today = getAustralianToday()
      console.log(`Generating task instances for new master task starting from: ${today}`)
      
      // Generate instances for today (this will create instances for all active tasks including the new one)
      const generationResult = await runNewDailyGeneration(today, {
        testMode: false,
        dryRun: false,
        forceRegenerate: false,
        logLevel: 'info'
      })
      
      console.log('Task instances generated for new master task:', {
        date: today,
        totalTasks: generationResult.totalTasks,
        newInstances: generationResult.newInstances,
        carryInstances: generationResult.carryInstances,
        totalInstances: generationResult.totalInstances,
        errors: generationResult.errors
      })
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