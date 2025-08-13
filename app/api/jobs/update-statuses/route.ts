import { NextRequest, NextResponse } from 'next/server'
import { updateTaskStatuses, runStatusUpdateJob } from '@/lib/status-manager'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Simple API key authentication for cron jobs
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secure-api-key-here'
    
    if (authHeader !== `Bearer ${expectedApiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run the status update job
    const result = await runStatusUpdateJob()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        updated: result.updated,
        errors: result.errors,
        details: result.details
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in update-statuses job:', error)
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
export async function GET() {
  try {
    // This endpoint can be called manually by admins
    const result = await updateTaskStatuses()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        updated: result.updated,
        errors: result.errors,
        details: result.details
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual status update trigger:', error)
    return NextResponse.json(
      { 
        error: 'Status update failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}