import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    console.log('=== DATABASE TEST START ===')
    
    // Use service role key for direct database access
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Test 1: Count master tasks
    const { data: masterTasks, error: masterTasksError, count: masterTasksCount } = await adminSupabase
      .from('master_tasks')
      .select('*', { count: 'exact' })
    
    console.log('Master tasks query result:', { 
      count: masterTasksCount,
      dataLength: masterTasks?.length,
      error: masterTasksError,
      sampleData: masterTasks?.slice(0, 2)
    })
    
    // Test 2: Count positions
    const { data: positions, error: positionsError, count: positionsCount } = await adminSupabase
      .from('positions')
      .select('*', { count: 'exact' })
    
    console.log('Positions query result:', { 
      count: positionsCount,
      dataLength: positions?.length,
      error: positionsError,
      data: positions
    })
    
    // Test 3: Count task instances
    const { data: taskInstances, error: taskInstancesError, count: taskInstancesCount } = await adminSupabase
      .from('task_instances')
      .select('*', { count: 'exact' })
      .limit(10)
    
    console.log('Task instances query result:', { 
      count: taskInstancesCount,
      dataLength: taskInstances?.length,
      error: taskInstancesError,
      sampleData: taskInstances?.slice(0, 2)
    })
    
    return NextResponse.json({
      success: true,
      data: {
        masterTasks: {
          count: masterTasksCount,
          data: masterTasks || [],
          error: masterTasksError?.message
        },
        positions: {
          count: positionsCount,
          data: positions || [],
          error: positionsError?.message
        },
        taskInstances: {
          count: taskInstancesCount,
          data: taskInstances || [],
          error: taskInstancesError?.message
        }
      }
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  } finally {
    console.log('=== DATABASE TEST END ===')
  }
}