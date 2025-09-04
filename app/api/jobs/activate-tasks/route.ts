import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAustralianToday, australianNowUtcISOString } from '@/lib/timezone-utils'
import { runNewDailyGeneration } from '@/lib/new-task-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Automatic Task Activation Job
 * 
 * This endpoint handles automatic activation of tasks based on publish_delay.
 * It should be called daily by a cron job to:
 * 1. Find tasks with publish_status = 'draft' or 'inactive' 
 * 2. Check if their publish_delay date has been reached
 * 3. Activate eligible tasks
 * 4. Immediately trigger frequency logic for newly activated tasks
 */

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Simple API key authentication for cron jobs
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secure-api-key-here'
    
    if (authHeader !== `Bearer ${expectedApiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { date, testMode = false, dryRun = false } = body
    
    const checkDate = date || getAustralianToday()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Starting automatic task activation for date: ${checkDate}`)
    console.log(`Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}`)

    // Step 1: Find tasks that should be activated
    const { data: tasksToActivate, error: fetchError } = await supabase
      .from('master_tasks')
      .select('*')
      .in('publish_status', ['draft', 'inactive'])
      .not('publish_delay', 'is', null)
      .lte('publish_delay', checkDate)

    if (fetchError) {
      throw new Error(`Failed to fetch tasks for activation: ${fetchError.message}`)
    }

    if (!tasksToActivate || tasksToActivate.length === 0) {
      console.log('No tasks found for activation')
      return NextResponse.json({
        success: true,
        message: 'No tasks found for activation',
        stats: {
          tasksActivated: 0,
          instancesGenerated: 0,
          errors: 0
        },
        timestamp: australianNowUtcISOString()
      })
    }

    console.log(`Found ${tasksToActivate.length} tasks eligible for activation`)

    let tasksActivated = 0
    let totalInstancesGenerated = 0
    let errors = 0
    const activatedTaskIds: string[] = []
    const errorDetails: string[] = []

    // Step 2: Activate each eligible task
    for (const task of tasksToActivate) {
      try {
        console.log(`Activating task: ${task.title} (ID: ${task.id})`)
        
        if (!dryRun && !testMode) {
          // Update task status to active
          const { error: updateError } = await supabase
            .from('master_tasks')
            .update({ 
              publish_status: 'active',
              updated_at: australianNowUtcISOString()
            })
            .eq('id', task.id)

          if (updateError) {
            throw new Error(`Failed to activate task ${task.id}: ${updateError.message}`)
          }
        }

        tasksActivated++
        activatedTaskIds.push(task.id)
        console.log(`Successfully activated task: ${task.title}`)

      } catch (error) {
        errors++
        const errorMsg = `Error activating task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errorDetails.push(errorMsg)
      }
    }

    // Step 3: Immediately trigger frequency logic for newly activated tasks
    if (activatedTaskIds.length > 0 && !dryRun && !testMode) {
      try {
        console.log(`Triggering frequency logic for ${activatedTaskIds.length} newly activated tasks`)
        
        // Generate instances for the current date and potentially future dates
        const generationResult = await runNewDailyGeneration(checkDate, {
          testMode,
          dryRun: false,
          forceRegenerate: false
        })

        totalInstancesGenerated = generationResult.totalInstances
        console.log(`Generated ${totalInstancesGenerated} instances for newly activated tasks`)

      } catch (generationError) {
        errors++
        const errorMsg = `Error generating instances for activated tasks: ${generationError instanceof Error ? generationError.message : 'Unknown error'}`
        console.error(errorMsg)
        errorDetails.push(errorMsg)
      }
    }

    const result = {
      success: errors === 0,
      message: errors === 0 
        ? `Successfully activated ${tasksActivated} tasks and generated ${totalInstancesGenerated} instances`
        : `Activation completed with ${errors} errors`,
      stats: {
        tasksEligible: tasksToActivate.length,
        tasksActivated,
        instancesGenerated: totalInstancesGenerated,
        errors
      },
      activatedTaskIds,
      errorDetails: errors > 0 ? errorDetails : undefined,
      timestamp: australianNowUtcISOString()
    }

    console.log('Task activation completed:', result)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Task activation job failed:', error)
    return NextResponse.json(
      { 
        error: 'Task activation failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: australianNowUtcISOString()
      }, 
      { status: 500 }
    )
  }
}

// GET endpoint for manual triggers from admin panel
export async function GET(request: NextRequest) {
  try {
    // Import auth function for user authentication
    const { requireAuth } = await import('@/lib/auth-middleware')
    
    // Authenticate user and verify admin role
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || undefined
    const testMode = searchParams.get('testMode') === 'true'
    const dryRun = searchParams.get('dryRun') === 'true'

    // Call the POST handler with the same logic
    const mockRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${process.env.CRON_API_KEY}` },
      body: JSON.stringify({ date, testMode, dryRun })
    })

    return await POST(mockRequest as NextRequest)

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    return NextResponse.json(
      { 
        error: 'Task activation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}