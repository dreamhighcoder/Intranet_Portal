import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAustralianToday, australianNowUtcISOString } from '@/lib/timezone-utils'
import { runNewDailyGeneration } from '@/lib/new-task-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Test endpoint for task activation and frequency logic
 * This endpoint allows admins to test the complete flow:
 * 1. Create a test task
 * 2. Set it to active (manually or via publish_delay)
 * 3. Verify frequency logic triggers correctly
 * 4. Clean up test data
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      action, 
      testTaskId,
      frequency = 'every_day',
      publishDelay,
      dueDate,
      testDate
    } = body

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const currentDate = testDate || getAustralianToday()

    switch (action) {
      case 'create_test_task':
        return await createTestTask(supabase, frequency, publishDelay, dueDate)
      
      case 'activate_task':
        return await activateTask(supabase, testTaskId)
      
      case 'test_frequency_logic':
        return await testFrequencyLogic(supabase, testTaskId, currentDate)
      
      case 'test_automatic_activation':
        return await testAutomaticActivation(supabase, currentDate)
      
      case 'cleanup_test_data':
        return await cleanupTestData(supabase)
      
      case 'full_test':
        return await runFullTest(supabase, frequency, publishDelay, dueDate, currentDate)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

async function createTestTask(supabase: any, frequency: string, publishDelay?: string, dueDate?: string) {
  const testTask = {
    title: `Test Task - ${frequency} - ${new Date().toISOString()}`,
    description: `Test task for frequency: ${frequency}`,
    responsibility: ['pharmacist-primary'],
    categories: ['general'],
    frequencies: [frequency],
    timing: 'anytime_during_day',
    due_time: '17:00:00',
    publish_status: publishDelay ? 'draft' : 'active',
    publish_delay: publishDelay || null,
    due_date: dueDate || null,
    sticky_once_off: frequency === 'once_off_sticky',
    allow_edit_when_locked: false
  }

  const { data: masterTask, error } = await supabase
    .from('master_tasks')
    .insert([testTask])
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create test task: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Test task created successfully',
    task: masterTask,
    nextSteps: publishDelay 
      ? 'Task created with publish_delay. Use test_automatic_activation to test activation.'
      : 'Task created as active. Use test_frequency_logic to verify instances are generated.'
  })
}

async function activateTask(supabase: any, taskId: string) {
  const { data: masterTask, error } = await supabase
    .from('master_tasks')
    .update({ 
      publish_status: 'active',
      updated_at: australianNowUtcISOString()
    })
    .eq('id', taskId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to activate task: ${error.message}`)
  }

  // Trigger frequency logic immediately
  try {
    const generationResult = await runNewDailyGeneration(getAustralianToday(), {
      testMode: false,
      dryRun: false,
      forceRegenerate: false
    })

    return NextResponse.json({
      success: true,
      message: 'Task activated and frequency logic triggered',
      task: masterTask,
      instancesGenerated: generationResult.totalInstances,
      generationDetails: generationResult
    })
  } catch (generationError) {
    return NextResponse.json({
      success: false,
      message: 'Task activated but frequency logic failed',
      task: masterTask,
      error: generationError instanceof Error ? generationError.message : 'Unknown error'
    })
  }
}

async function testFrequencyLogic(supabase: any, taskId: string, testDate: string) {
  // Check if task exists and is active
  const { data: task, error: taskError } = await supabase
    .from('master_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    throw new Error('Test task not found')
  }

  if (task.publish_status !== 'active') {
    throw new Error('Task is not active. Activate it first.')
  }

  // Run frequency logic for the test date
  const generationResult = await runNewDailyGeneration(testDate, {
    testMode: false,
    dryRun: false,
    forceRegenerate: true // Force regeneration for testing
  })

  // Check generated instances
  const { data: instances, error: instancesError } = await supabase
    .from('task_instances')
    .select('*')
    .eq('master_task_id', taskId)
    .eq('instance_date', testDate)

  if (instancesError) {
    throw new Error(`Failed to fetch instances: ${instancesError.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Frequency logic test completed',
    task: {
      id: task.id,
      title: task.title,
      frequencies: task.frequencies,
      publish_status: task.publish_status
    },
    testDate,
    instancesGenerated: generationResult.totalInstances,
    instancesForTask: instances?.length || 0,
    instances: instances || [],
    generationDetails: generationResult
  })
}

async function testAutomaticActivation(supabase: any, testDate: string) {
  // Find tasks that should be activated on this date
  const { data: tasksToActivate, error: fetchError } = await supabase
    .from('master_tasks')
    .select('*')
    .in('publish_status', ['draft', 'inactive'])
    .not('publish_delay', 'is', null)
    .lte('publish_delay', testDate)
    .ilike('title', '%Test Task%') // Only test tasks

  if (fetchError) {
    throw new Error(`Failed to fetch tasks for activation: ${fetchError.message}`)
  }

  if (!tasksToActivate || tasksToActivate.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No test tasks found for automatic activation',
      tasksEligible: 0,
      tasksActivated: 0
    })
  }

  // Simulate automatic activation
  let activatedCount = 0
  const activatedTasks = []

  for (const task of tasksToActivate) {
    const { data: activatedTask, error: activationError } = await supabase
      .from('master_tasks')
      .update({ 
        publish_status: 'active',
        updated_at: australianNowUtcISOString()
      })
      .eq('id', task.id)
      .select('*')
      .single()

    if (!activationError) {
      activatedCount++
      activatedTasks.push(activatedTask)
    }
  }

  // Trigger frequency logic for activated tasks
  let instancesGenerated = 0
  if (activatedCount > 0) {
    try {
      const generationResult = await runNewDailyGeneration(testDate, {
        testMode: false,
        dryRun: false,
        forceRegenerate: false
      })
      instancesGenerated = generationResult.totalInstances
    } catch (generationError) {
      console.error('Error generating instances:', generationError)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Automatic activation test completed. Activated ${activatedCount} tasks.`,
    tasksEligible: tasksToActivate.length,
    tasksActivated: activatedCount,
    instancesGenerated,
    activatedTasks
  })
}

async function cleanupTestData(supabase: any) {
  // Delete test task instances
  const { error: instancesError } = await supabase
    .from('task_instances')
    .delete()
    .in('master_task_id', supabase
      .from('master_tasks')
      .select('id')
      .ilike('title', '%Test Task%')
    )

  // Delete test master tasks
  const { data: deletedTasks, error: tasksError } = await supabase
    .from('master_tasks')
    .delete()
    .ilike('title', '%Test Task%')
    .select('*')

  if (tasksError) {
    throw new Error(`Failed to cleanup test tasks: ${tasksError.message}`)
  }

  return NextResponse.json({
    success: true,
    message: 'Test data cleaned up successfully',
    deletedTasks: deletedTasks?.length || 0,
    instancesCleanupError: instancesError?.message || null
  })
}

async function runFullTest(supabase: any, frequency: string, publishDelay?: string, dueDate?: string, testDate?: string) {
  const results = []
  let testTaskId = null

  try {
    // Step 1: Create test task
    const createResult = await createTestTask(supabase, frequency, publishDelay, dueDate)
    const createData = await createResult.json()
    testTaskId = createData.task.id
    results.push({ step: 'create', success: true, data: createData })

    // Step 2: Test activation (manual or automatic)
    if (publishDelay) {
      const activationResult = await testAutomaticActivation(supabase, testDate || getAustralianToday())
      const activationData = await activationResult.json()
      results.push({ step: 'automatic_activation', success: true, data: activationData })
    } else {
      const activationResult = await activateTask(supabase, testTaskId)
      const activationData = await activationResult.json()
      results.push({ step: 'manual_activation', success: activationData.success, data: activationData })
    }

    // Step 3: Test frequency logic
    const frequencyResult = await testFrequencyLogic(supabase, testTaskId, testDate || getAustralianToday())
    const frequencyData = await frequencyResult.json()
    results.push({ step: 'frequency_logic', success: true, data: frequencyData })

    return NextResponse.json({
      success: true,
      message: 'Full test completed successfully',
      testTaskId,
      frequency,
      publishDelay,
      dueDate,
      testDate: testDate || getAustralianToday(),
      results
    })

  } catch (error) {
    // Cleanup on error
    if (testTaskId) {
      try {
        await supabase
          .from('master_tasks')
          .delete()
          .eq('id', testTaskId)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Full test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      results
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return NextResponse.json({
      message: 'Task Activation Test Endpoint',
      availableActions: [
        'create_test_task',
        'activate_task', 
        'test_frequency_logic',
        'test_automatic_activation',
        'cleanup_test_data',
        'full_test'
      ],
      usage: {
        create_test_task: {
          method: 'POST',
          body: { action: 'create_test_task', frequency: 'every_day', publishDelay: '2024-01-15', dueDate: '2024-01-20' }
        },
        activate_task: {
          method: 'POST', 
          body: { action: 'activate_task', testTaskId: 'task-id' }
        },
        test_frequency_logic: {
          method: 'POST',
          body: { action: 'test_frequency_logic', testTaskId: 'task-id', testDate: '2024-01-15' }
        },
        test_automatic_activation: {
          method: 'POST',
          body: { action: 'test_automatic_activation', testDate: '2024-01-15' }
        },
        cleanup_test_data: {
          method: 'POST',
          body: { action: 'cleanup_test_data' }
        },
        full_test: {
          method: 'POST',
          body: { action: 'full_test', frequency: 'every_day', publishDelay: '2024-01-15', dueDate: '2024-01-20', testDate: '2024-01-15' }
        }
      }
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    return NextResponse.json(
      { 
        error: 'Test endpoint failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}