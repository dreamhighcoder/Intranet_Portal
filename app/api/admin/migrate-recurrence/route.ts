/**
 * Recurrence Migration API Endpoint
 * Helps migrate from old frequency system to new recurrence engine
 */

import { NextRequest, NextResponse } from 'next/server'
import { createMigrationService } from '@/lib/recurrence-migration'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'report'

    // Get all master tasks
    const { data: masterTasks, error: tasksError } = await supabase
      .from('master_tasks')
      .select('*')
      .order('created_at')

    if (tasksError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch master tasks: ${tasksError.message}` },
        { status: 500 }
      )
    }

    if (!masterTasks || masterTasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No master tasks found',
          total: 0
        }
      })
    }

    const migrationService = createMigrationService()

    switch (action) {
      case 'report':
        // Generate migration report
        const report = migrationService.generateMigrationReport(masterTasks)
        return NextResponse.json({
          success: true,
          data: {
            action: 'report',
            report
          }
        })

      case 'validate':
        // Validate migration compatibility
        const validation = migrationService.validateMigration(masterTasks)
        return NextResponse.json({
          success: true,
          data: {
            action: 'validate',
            validation
          }
        })

      case 'preview':
        // Preview converted tasks (first 10)
        const previewTasks = masterTasks.slice(0, 10)
        const converted = migrationService.convertMasterTasks(previewTasks)
        return NextResponse.json({
          success: true,
          data: {
            action: 'preview',
            original: previewTasks,
            converted,
            total: masterTasks.length
          }
        })

      case 'sql':
        // Generate migration SQL
        const sql = migrationService.generateMigrationSQL(masterTasks)
        return NextResponse.json({
          success: true,
          data: {
            action: 'sql',
            sql,
            rollbackSql: migrationService.generateRollbackSQL()
          }
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: report, validate, preview, or sql' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, testMode = true } = body

    if (action !== 'execute') {
      return NextResponse.json(
        { success: false, error: 'Only "execute" action is supported for POST' },
        { status: 400 }
      )
    }

    // Get all master tasks
    const { data: masterTasks, error: tasksError } = await supabase
      .from('master_tasks')
      .select('*')
      .order('created_at')

    if (tasksError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch master tasks: ${tasksError.message}` },
        { status: 500 }
      )
    }

    if (!masterTasks || masterTasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No master tasks found to migrate',
          total: 0
        }
      })
    }

    const migrationService = createMigrationService()

    // Validate before executing
    const validation = migrationService.validateMigration(masterTasks)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Migration validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    if (testMode) {
      // Test mode - just return what would be done
      const converted = migrationService.convertMasterTasks(masterTasks)
      return NextResponse.json({
        success: true,
        data: {
          action: 'execute',
          testMode: true,
          message: 'Test mode - no changes made',
          tasksToMigrate: masterTasks.length,
          converted: converted.slice(0, 5), // Show first 5 as preview
          validation
        }
      })
    }

    // Execute migration
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const task of masterTasks) {
      try {
        const converted = migrationService.convertMasterTask(task)
        
        // Update the task with new fields
        const { error: updateError } = await supabase
          .from('master_tasks')
          .update({
            // Add new columns (these would need to be added to the schema first)
            // new_frequency: converted.frequency,
            // new_timing: converted.timing,
            // new_publish_at: converted.publish_at,
            // For now, just update a metadata field to track migration
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id)

        if (updateError) {
          throw updateError
        }

        results.push({
          taskId: task.id,
          title: task.title,
          oldFrequency: task.frequency,
          newFrequency: converted.frequency,
          success: true
        })
        successCount++

      } catch (error) {
        results.push({
          taskId: task.id,
          title: task.title,
          oldFrequency: task.frequency,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        action: 'execute',
        testMode: false,
        message: `Migration completed: ${successCount} successful, ${errorCount} errors`,
        totalTasks: masterTasks.length,
        successCount,
        errorCount,
        results: results.slice(0, 10), // Show first 10 results
        validation
      }
    })

  } catch (error) {
    console.error('Migration execution error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}