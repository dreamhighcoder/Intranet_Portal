import { NextRequest, NextResponse } from 'next/server'
import { requireAuthEnhanced } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { NewRecurrenceEngine, type MasterTask as NewMasterTask } from '@/lib/new-recurrence-engine'
import { createHolidayChecker } from '@/lib/holiday-checker'
import { getAustralianToday, parseAustralianDate } from '@/lib/timezone-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request and ensure admin access
    const user = await requireAuthEnhanced(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const testType = searchParams.get('test')

    switch (testType) {
      case 'recurrence':
        return await runRecurrenceTest()
      case 'performance':
        return await runPerformanceTest()
      case 'data-integrity':
        return await runDataIntegrityTest()
      default:
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid test type. Available: recurrence, performance, data-integrity' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Diagnostic test failed:', error)
    return NextResponse.json({
      success: false,
      message: `Diagnostic test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
}

async function runRecurrenceTest() {
  const startTime = Date.now()
  
  try {
    // Test the recurrence engine with sample data
    const holidayChecker = await createHolidayChecker()
    const recurrenceEngine = new NewRecurrenceEngine(holidayChecker)
    
    // Get a few active master tasks to test
    const { data: masterTasks, error } = await supabaseAdmin
      .from('master_tasks')
      .select('*')
      .eq('publish_status', 'active')
      .limit(5)
    
    if (error) throw error
    
    const today = getAustralianToday()
    const testResults = []
    
    for (const task of masterTasks || []) {
      const masterTask: NewMasterTask = {
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        responsibility: task.responsibility || [],
        categories: task.categories || [],
        frequencies: (task.frequencies || []) as any,
        timing: task.timing || 'anytime_during_day',
        active: task.publish_status === 'active',
        publish_delay: task.publish_delay || undefined,
        due_date: task.due_date || undefined,
      }
      
      const shouldAppear = recurrenceEngine.shouldTaskAppearOnDate(masterTask, today)
      testResults.push({
        taskId: task.id,
        title: task.title,
        frequencies: task.frequencies,
        shouldAppearToday: shouldAppear
      })
    }
    
    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      message: `Recurrence engine test completed successfully in ${duration}ms`,
      stats: {
        tasksProcessed: testResults.length,
        duration,
        results: testResults
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Recurrence test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

async function runPerformanceTest() {
  const startTime = Date.now()
  
  try {
    // Test database query performance
    const queries = [
      supabaseAdmin.from('master_tasks').select('count', { count: 'exact', head: true }),
      supabaseAdmin.from('task_instances').select('count', { count: 'exact', head: true }),
      supabaseAdmin.from('positions').select('count', { count: 'exact', head: true }),
      supabaseAdmin.from('task_position_completions').select('count', { count: 'exact', head: true })
    ]
    
    const queryStartTime = Date.now()
    const results = await Promise.all(queries)
    const queryDuration = Date.now() - queryStartTime
    
    // Test API endpoint performance
    const apiStartTime = Date.now()
    let response: Response
    let apiDuration: number
    
    try {
      response = await fetch(`${request.nextUrl.origin}/api/checklist/counts?role=pharmacist&date=${getAustralianToday()}`)
      apiDuration = Date.now() - apiStartTime
    } catch (error) {
      // If API call fails, just measure the time it took to fail
      apiDuration = Date.now() - apiStartTime
      response = { status: 500 } as Response
    }
    
    const totalDuration = Date.now() - startTime
    
    // Determine performance status
    let status = 'excellent'
    if (queryDuration > 1000 || apiDuration > 2000) status = 'slow'
    if (queryDuration > 2000 || apiDuration > 5000) status = 'poor'
    
    return NextResponse.json({
      success: true,
      message: `Performance test completed - ${status} performance`,
      stats: {
        totalDuration,
        databaseQueryTime: queryDuration,
        apiResponseTime: apiDuration,
        status,
        queriesExecuted: queries.length,
        apiStatusCode: response.status
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

async function runDataIntegrityTest() {
  try {
    const issues = []
    
    // Check for master tasks without frequencies
    const { data: tasksWithoutFreq, error: freqError } = await supabaseAdmin
      .from('master_tasks')
      .select('id, title, frequencies')
      .eq('publish_status', 'active')
      .or('frequencies.is.null,frequencies.eq.{}')
    
    if (freqError) throw freqError
    
    if (tasksWithoutFreq && tasksWithoutFreq.length > 0) {
      issues.push(`${tasksWithoutFreq.length} active tasks have no frequencies defined`)
    }
    
    // Check for master tasks without responsibility
    const { data: tasksWithoutResp, error: respError } = await supabaseAdmin
      .from('master_tasks')
      .select('id, title, responsibility')
      .eq('publish_status', 'active')
      .or('responsibility.is.null,responsibility.eq.{}')
    
    if (respError) throw respError
    
    if (tasksWithoutResp && tasksWithoutResp.length > 0) {
      issues.push(`${tasksWithoutResp.length} active tasks have no responsibility assigned`)
    }
    
    // Check for orphaned task instances
    const { data: orphanedInstances, error: orphanError } = await supabaseAdmin
      .from('task_instances')
      .select(`
        id,
        master_task_id,
        master_tasks!inner(id)
      `)
      .is('master_tasks.id', null)
    
    if (orphanError && !orphanError.message.includes('foreign key')) {
      // Only report if it's not a foreign key constraint (which would prevent orphans)
      throw orphanError
    }
    
    // Check for positions without names
    const { data: positionsWithoutNames, error: posError } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .or('name.is.null,name.eq.""')
    
    if (posError) throw posError
    
    if (positionsWithoutNames && positionsWithoutNames.length > 0) {
      issues.push(`${positionsWithoutNames.length} positions have no name`)
    }
    
    const isHealthy = issues.length === 0
    
    return NextResponse.json({
      success: true,
      message: isHealthy ? 'Data integrity check passed - no issues found' : `Found ${issues.length} data integrity issues`,
      stats: {
        issuesFound: issues.length,
        issues,
        status: isHealthy ? 'healthy' : 'issues_detected'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Data integrity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}