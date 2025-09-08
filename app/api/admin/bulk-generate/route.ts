import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { runBulkGeneration } from '@/lib/new-task-generator'
import { getAustralianToday } from '@/lib/timezone-utils'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admin users can trigger bulk generation
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 403 })
    }

    const body = await request.json()
    const { 
      baseDate = getAustralianToday(),
      testMode = false,
      dryRun = false,
      forceRegenerate = false,
      logLevel = 'info'
    } = body

    console.log(`Starting bulk task generation for base date: ${baseDate}`)
    
    const results = await runBulkGeneration(baseDate, {
      testMode,
      dryRun,
      forceRegenerate,
      logLevel
    })

    // Calculate summary statistics
    const summary = results.reduce((acc, result) => {
      acc.totalTasks += result.totalTasks
      acc.newInstances += result.newInstances
      acc.carryInstances += result.carryInstances
      acc.totalInstances += result.totalInstances
      acc.errors += result.errors
      acc.datesProcessed++
      return acc
    }, {
      totalTasks: 0,
      newInstances: 0,
      carryInstances: 0,
      totalInstances: 0,
      errors: 0,
      datesProcessed: 0
    })

    const success = summary.errors === 0

    return NextResponse.json({
      success,
      message: success 
        ? `Bulk generation completed successfully for ${summary.datesProcessed} dates`
        : `Bulk generation completed with ${summary.errors} errors`,
      summary,
      results: dryRun ? results : undefined, // Only include detailed results for dry runs
      baseDate,
      settings: {
        testMode,
        dryRun,
        forceRegenerate,
        logLevel
      }
    })
  } catch (error) {
    console.error('Bulk generation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to run bulk generation'
    }, { status: 500 })
  }
}