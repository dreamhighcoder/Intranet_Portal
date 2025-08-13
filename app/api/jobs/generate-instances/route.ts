import { NextRequest, NextResponse } from 'next/server'
import { generateTaskInstances, runDailyGeneration } from '@/lib/task-instance-generator'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Simple API key authentication for cron jobs
    // In production, you'd want a more secure authentication method
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secure-api-key-here'
    
    if (authHeader !== `Bearer ${expectedApiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { mode = 'daily', masterTaskId, forceRegenerate = false } = body

    let result
    
    if (mode === 'daily') {
      // Run the daily generation job
      result = await runDailyGeneration()
    } else if (mode === 'custom') {
      // Custom generation with parameters
      const startDate = body.startDate ? new Date(body.startDate) : undefined
      const endDate = body.endDate ? new Date(body.endDate) : undefined
      
      result = await generateTaskInstances({
        startDate,
        endDate,
        masterTaskId,
        forceRegenerate
      })
    } else {
      return NextResponse.json({ error: 'Invalid mode. Use "daily" or "custom"' }, { status: 400 })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        generated: result.generated,
        skipped: result.skipped,
        errors: result.errors
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in generate-instances job:', error)
    return NextResponse.json(
      { 
        error: 'Instance generation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

// GET endpoint for manual triggers from admin panel
export async function GET(request: NextRequest) {
  try {
    // This endpoint can be called manually by admins
    // You could add user authentication here to verify admin role
    
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'daily'
    const masterTaskId = searchParams.get('masterTaskId') || undefined
    const forceRegenerate = searchParams.get('forceRegenerate') === 'true'

    let result
    
    if (mode === 'daily') {
      result = await runDailyGeneration()
    } else {
      result = await generateTaskInstances({
        masterTaskId,
        forceRegenerate
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        generated: result.generated,
        skipped: result.skipped,
        errors: result.errors
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual generate-instances trigger:', error)
    return NextResponse.json(
      { 
        error: 'Instance generation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}