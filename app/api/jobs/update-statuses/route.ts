import { NextRequest, NextResponse } from 'next/server'
import { runNewStatusUpdate } from '@/lib/new-task-generator'
import { australianNowUtcISOString, getAustralianNow } from '@/lib/timezone-utils'

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

    // Run the new status update job
    const result = await runNewStatusUpdate({
      date,
      testMode,
      dryRun
    })

    return NextResponse.json({
      success: result.errors === 0,
      message: result.errors === 0 ? 'Status update completed successfully' : 'Status update completed with errors',
      stats: {
        totalInstances: result.totalInstances,
        instancesUpdated: result.instancesUpdated,
        instancesSkipped: result.instancesSkipped,
        errors: result.errors
      },
      details: result,
      timestamp: australianNowUtcISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Status update failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

// GET endpoint for manual triggers from admin panel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || undefined
    const testMode = searchParams.get('testMode') === 'true'
    const dryRun = searchParams.get('dryRun') === 'true'

    // Run the new status update job
    const result = await runNewStatusUpdate({
      date,
      testMode,
      dryRun
    })

    return NextResponse.json({
      success: result.errors === 0,
      message: result.errors === 0 ? 'Status update completed successfully' : 'Status update completed with errors',
      stats: {
        totalInstances: result.totalInstances,
        instancesUpdated: result.instancesUpdated,
        instancesSkipped: result.instancesSkipped,
        errors: result.errors
      },
      details: result,
      timestamp: australianNowUtcISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Status update failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}