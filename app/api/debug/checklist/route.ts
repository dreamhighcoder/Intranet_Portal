import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS for server-side reads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role') || 'pharmacist-primary'
    const date = searchParams.get('date') || '2025-08-19'
    
    console.log('Debug API - Role:', role, 'Date:', date)
    
    // Test 1: Check if we can connect to Supabase
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .limit(1)
    
    if (connectionError) {
      return NextResponse.json({
        error: 'Database connection failed',
        details: connectionError
      }, { status: 500 })
    }
    
    // Test 2: Check all master tasks
    const { data: allTasks, error: allTasksError } = await supabaseAdmin
      .from('master_tasks')
      .select(`
        id,
        title,
        position_id,
        frequency,
        publish_status,
        positions!inner(id, name)
      `)
    
    if (allTasksError) {
      return NextResponse.json({
        error: 'Failed to fetch master tasks',
        details: allTasksError
      }, { status: 500 })
    }
    
    // Test 3: Check tasks for specific position
    const positionIdMap: Record<string, string> = {
      'pharmacist-primary': '550e8400-e29b-41d4-a716-446655440001',
      'pharmacist-supporting': '550e8400-e29b-41d4-a716-446655440002', 
      'pharmacy-assistants': '550e8400-e29b-41d4-a716-446655440003',
      'dispensary-technicians': '550e8400-e29b-41d4-a716-446655440004',
      'daa-packers': '550e8400-e29b-41d4-a716-446655440005',
      'operational-managerial': '550e8400-e29b-41d4-a716-446655440006'
    }
    
    const positionId = positionIdMap[role]
    
    const { data: positionTasks, error: positionTasksError } = await supabaseAdmin
      .from('master_tasks')
      .select(`
        id,
        title,
        position_id,
        frequency,
        publish_status,
        positions!inner(id, name)
      `)
      .eq('position_id', positionId)
      .eq('publish_status', 'active')
    
    if (positionTasksError) {
      return NextResponse.json({
        error: 'Failed to fetch position tasks',
        details: positionTasksError
      }, { status: 500 })
    }
    
    // Test 4: Check existing task instances for the date
    const masterTaskIds = (positionTasks || []).map(task => task.id)
    const { data: existingInstances, error: instancesError } = await supabaseAdmin
      .from('task_instances')
      .select('master_task_id, status, instance_date')
      .in('master_task_id', masterTaskIds)
      .eq('instance_date', date)
    
    return NextResponse.json({
      success: true,
      debug: {
        role,
        date,
        positionId,
        connectionTest: connectionTest?.length || 0,
        allTasksCount: allTasks?.length || 0,
        positionTasksCount: positionTasks?.length || 0,
        existingInstancesCount: existingInstances?.length || 0,
        allTasks: allTasks?.map(t => ({
          id: t.id,
          title: t.title,
          position: t.positions?.name,
          frequency: t.frequency,
          status: t.publish_status
        })),
        positionTasks: positionTasks?.map(t => ({
          id: t.id,
          title: t.title,
          position: t.positions?.name,
          frequency: t.frequency
        })),
        existingInstances: existingInstances?.map(i => ({
          master_task_id: i.master_task_id,
          status: i.status,
          date: i.instance_date
        }))
      }
    })
    
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      error: 'Debug API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}