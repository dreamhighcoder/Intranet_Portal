import { NextRequest, NextResponse } from 'next/server'
import { runNewDailyGeneration } from '@/lib/new-task-generator'

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
    const { date, testMode = false, dryRun = false, forceRegenerate = false } = body

    // Run the new daily generation job
    const result = await runNewDailyGeneration(date, {
      testMode,
      dryRun,
      forceRegenerate
    })

    return NextResponse.json({
      success: result.errors === 0,
      message: result.errors === 0 ? 'Generation completed successfully' : 'Generation completed with errors',
      stats: {
        totalTasks: result.totalTasks,
        newInstances: result.newInstances,
        carryInstances: result.carryInstances,
        totalInstances: result.totalInstances,
        errors: result.errors
      },
      details: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
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
    const forceRegenerate = searchParams.get('forceRegenerate') === 'true'

    // Run the new daily generation job
    const result = await runNewDailyGeneration(date, {
      testMode,
      dryRun,
      forceRegenerate
    })

    return NextResponse.json({
      success: result.errors === 0,
      message: result.errors === 0 ? 'Generation completed successfully' : 'Generation completed with errors',
      stats: {
        totalTasks: result.totalTasks,
        newInstances: result.newInstances,
        carryInstances: result.carryInstances,
        totalInstances: result.totalInstances,
        errors: result.errors
      },
      details: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    return NextResponse.json(
      { 
        error: 'Instance generation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}