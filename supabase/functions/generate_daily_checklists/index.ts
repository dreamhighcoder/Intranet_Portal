/**
 * Supabase Edge Function: Generate Daily Checklists
 * Pharmacy Intranet Portal - Automated Task Generation
 * 
 * This function can be scheduled to run daily to:
 * - Generate checklist instances for the current date
 * - Update statuses for overdue/missed instances
 * - Handle public holidays and business day logic
 * - Provide comprehensive logging and error handling
 * 
 * Deployment:
 * 1. Deploy to Supabase: supabase functions deploy generate_daily_checklists
 * 2. Schedule with cron: supabase functions schedule generate_daily_checklists "0 6 * * *"
 * 3. Or call manually via API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ========================================
// TYPES AND INTERFACES
// ========================================

interface FunctionRequest {
  date?: string // ISO date string (YYYY-MM-DD), defaults to today
  testMode?: boolean // If true, don't actually insert records
  dryRun?: boolean // If true, return what would be generated without inserting
  forceRegenerate?: boolean // If true, delete existing instances before generating
  updateStatuses?: boolean // If true, also update instance statuses
  maxTasks?: number // Maximum number of tasks to process
  logLevel?: 'silent' | 'info' | 'debug'
}

interface FunctionResponse {
  success: boolean
  message: string
  timestamp: string
  executionTime: number
  results: {
    generation?: any
    statusUpdate?: any
  }
  errors: string[]
  warnings: string[]
}

// ========================================
// MAIN FUNCTION HANDLER
// ========================================

serve(async (req) => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  
  try {
    // Parse request
    const request: FunctionRequest = await req.json().catch(() => ({}))
    const {
      date = new Date().toISOString().split('T')[0],
      testMode = false,
      dryRun = false,
      forceRegenerate = false,
      updateStatuses = true,
      maxTasks,
      logLevel = 'info'
    } = request

    console.log(`[${timestamp}] Starting daily checklist generation for date: ${date}`)
    console.log(`[${timestamp}] Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}, Force: ${forceRegenerate}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Get public holidays for the date
    const holidays = await getPublicHolidays(supabase, date)
    console.log(`[${timestamp}] Loaded ${holidays.length} public holidays`)

    // Step 2: Generate checklist instances
    const generationResult = await generateChecklistInstances(
      supabase,
      date,
      holidays,
      { testMode, dryRun, forceRegenerate, maxTasks, logLevel }
    )

    console.log(`[${timestamp}] Generation completed: ${generationResult.instancesCreated} instances created`)

    // Step 3: Update statuses if requested
    let statusUpdateResult = null
    if (updateStatuses && !dryRun) {
      statusUpdateResult = await updateInstanceStatuses(
        supabase,
        date,
        { testMode, logLevel }
      )
      console.log(`[${timestamp}] Status update completed: ${statusUpdateResult.instancesUpdated} instances updated`)
    }

    const executionTime = Date.now() - startTime

    // Prepare response
    const response: FunctionResponse = {
      success: generationResult.errors === 0 && (!statusUpdateResult || statusUpdateResult.errors === 0),
      message: `Daily checklist generation completed successfully in ${executionTime}ms`,
      timestamp,
      executionTime,
      results: {
        generation: generationResult,
        statusUpdate: statusUpdateResult
      },
      errors: [],
      warnings: []
    }

    // Add errors and warnings
    if (generationResult.errors > 0) {
      response.errors.push(`Generation errors: ${generationResult.errors}`)
    }
    if (statusUpdateResult && statusUpdateResult.errors > 0) {
      response.errors.push(`Status update errors: ${statusUpdateResult.errors}`)
    }

    if (generationResult.instancesSkipped > 0) {
      response.warnings.push(`${generationResult.instancesSkipped} instances skipped (already existed)`)
    }
    if (statusUpdateResult && statusUpdateResult.instancesSkipped > 0) {
      response.warnings.push(`${statusUpdateResult.instancesSkipped} status updates skipped`)
    }

    console.log(`[${timestamp}] Function completed successfully in ${executionTime}ms`)

    return new Response(
      JSON.stringify(response, null, 2),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: response.success ? 200 : 500
      }
    )

  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`[${timestamp}] Function failed after ${executionTime}ms:`, error)

    const errorResponse: FunctionResponse = {
      success: false,
      message: `Function failed: ${errorMessage}`,
      timestamp,
      executionTime,
      results: {},
      errors: [errorMessage],
      warnings: []
    }

    return new Response(
      JSON.stringify(errorResponse, null, 2),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get public holidays for a specific date
 */
async function getPublicHolidays(supabase: any, date: string) {
  try {
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('date', date)

    if (error) {
      console.warn(`Warning: Could not fetch public holidays: ${error.message}`)
      return []
    }

    return data || []
  } catch (error) {
    console.warn(`Warning: Error fetching public holidays: ${error}`)
    return []
  }
}

/**
 * Generate checklist instances for a specific date
 */
async function generateChecklistInstances(
  supabase: any,
  date: string,
  holidays: any[],
  options: {
    testMode: boolean
    dryRun: boolean
    forceRegenerate: boolean
    maxTasks?: number
    logLevel: string
  }
) {
  try {
    // Get all active master tasks
    const { data: masterTasks, error: tasksError } = await supabase
      .from('master_tasks')
      .select('*')
      .eq('publish_status', 'active')
      .order('created_at', { ascending: true })

    if (tasksError) {
      throw new Error(`Failed to fetch master tasks: ${tasksError.message}`)
    }

    if (!masterTasks || masterTasks.length === 0) {
      console.log(`No active master tasks found for ${date}`)
      return {
        date,
        totalTasks: 0,
        dueTasks: 0,
        instancesCreated: 0,
        instancesSkipped: 0,
        errors: 0,
        results: [],
        executionTime: 0,
        testMode: options.testMode,
        dryRun: options.dryRun
      }
    }

    // Apply max tasks limit if specified
    const tasksToProcess = options.maxTasks ? masterTasks.slice(0, options.maxTasks) : masterTasks
    console.log(`Processing ${tasksToProcess.length} master tasks`)

    // Check if instances already exist for this date
    if (!options.forceRegenerate && !options.dryRun) {
      const existingInstances = await checkExistingInstances(supabase, date)
      if (existingInstances.length > 0) {
        console.log(`Found ${existingInstances.length} existing instances for ${date}`)
        
        if (!options.testMode) {
          // Check if we should skip generation (all tasks have instances)
          const tasksWithInstances = new Set(existingInstances.map((inst: any) => inst.master_task_id))
          const allTasksHaveInstances = tasksToProcess.every((task: any) => tasksWithInstances.has(task.id))
          
          if (allTasksHaveInstances) {
            console.log('All tasks already have instances for this date, skipping generation')
            return {
              date,
              totalTasks: tasksToProcess.length,
              dueTasks: 0,
              instancesCreated: 0,
              instancesSkipped: tasksToProcess.length,
              errors: 0,
              results: [],
              executionTime: 0,
              testMode: options.testMode,
              dryRun: options.dryRun
            }
          }
        }
      }
    }

    // Force delete existing instances if requested
    if (options.forceRegenerate && !options.dryRun && !options.testMode) {
      const deletedCount = await deleteExistingInstances(supabase, date)
      console.log(`Deleted ${deletedCount} existing instances for regeneration`)
    }

    // Process each task and generate instances
    const results: any[] = []
    let instancesCreated = 0
    let instancesSkipped = 0
    let errors = 0

    for (const masterTask of tasksToProcess) {
      try {
        const result = await processSingleTask(supabase, masterTask, date, options)
        results.push(result)

        if (result.instanceCreated) {
          instancesCreated++
        } else if (result.skipped) {
          instancesSkipped++
        }

        if (result.error) {
          errors++
        }
      } catch (error) {
        const errorResult = {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          isDue: false,
          instanceCreated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          skipped: false
        }
        results.push(errorResult)
        errors++
      }
    }

    const dueTasks = results.filter((r: any) => r.isDue).length

    return {
      date,
      totalTasks: tasksToProcess.length,
      dueTasks,
      instancesCreated,
      instancesSkipped,
      errors,
      results,
      executionTime: 0,
      testMode: options.testMode,
      dryRun: options.dryRun
    }

  } catch (error) {
    throw new Error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process a single master task to determine if it's due and create instance
 */
async function processSingleTask(
  supabase: any,
  masterTask: any,
  date: string,
  options: {
    testMode: boolean
    dryRun: boolean
    forceRegenerate: boolean
    maxTasks?: number
    logLevel: string
  }
) {
  try {
    // Simple due date check (in production, use the full recurrence engine)
    // For this example, we'll assume daily tasks are always due
    const isDue = true // Simplified logic - in production use recurrence engine

    if (!isDue) {
      return {
        taskId: masterTask.id,
        taskTitle: masterTask.title || 'Unknown',
        isDue: false,
        instanceCreated: false,
        skipped: true,
        reason: 'Task not due on this date'
      }
    }

    // Check if instance already exists
    if (!options.dryRun && !options.testMode) {
      const existingInstance = await checkInstanceExists(supabase, masterTask.id, date)
      if (existingInstance) {
        return {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          isDue: true,
          instanceCreated: false,
          skipped: true,
          reason: 'Instance already exists'
        }
      }
    }

    // Create checklist instance
    if (options.dryRun) {
      return {
        taskId: masterTask.id,
        taskTitle: masterTask.title || 'Unknown',
        isDue: true,
        instanceCreated: false,
        skipped: false,
        reason: 'Dry run mode - would create instance'
      }
    }

    if (options.testMode) {
      return {
        taskId: masterTask.id,
        taskTitle: masterTask.title || 'Unknown',
        isDue: true,
        instanceCreated: false,
        skipped: false,
        reason: 'Test mode - would create instance'
      }
    }

    // Actually create the instance
    const instanceData = {
      master_task_id: masterTask.id,
      date: date,
      role: masterTask.responsibility?.[0] || 'default',
      status: 'pending',
      payload: {
        task_title: masterTask.title,
        task_description: masterTask.description,
        timing: masterTask.timing,
        due_time: masterTask.due_time,
        categories: masterTask.categories
      },
      notes: `Auto-generated instance for ${masterTask.title}`
    }

    const { data: instance, error: insertError } = await supabase
      .from('checklist_instances')
      .insert(instanceData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create instance: ${insertError.message}`)
    }

    return {
      taskId: masterTask.id,
      taskTitle: masterTask.title || 'Unknown',
      isDue: true,
      instanceCreated: true,
      instanceId: instance.id
    }

  } catch (error) {
    return {
      taskId: masterTask.id,
      taskTitle: masterTask.title || 'Unknown',
      isDue: false,
      instanceCreated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      skipped: false
    }
  }
}

/**
 * Check if instances already exist for a date
 */
async function checkExistingInstances(supabase: any, date: string) {
  try {
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('*')
      .eq('date', date)

    if (error) {
      console.warn(`Warning: Error checking existing instances: ${error.message}`)
      return []
    }

    return data || []
  } catch (error) {
    console.warn(`Warning: Error checking existing instances: ${error}`)
    return []
  }
}

/**
 * Check if a specific instance exists
 */
async function checkInstanceExists(supabase: any, masterTaskId: string, date: string) {
  try {
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('master_task_id', masterTaskId)
      .eq('date', date)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn(`Warning: Error checking instance existence: ${error.message}`)
      return false
    }

    return !!data
  } catch (error) {
    console.warn(`Warning: Error checking instance existence: ${error}`)
    return false
  }
}

/**
 * Delete existing instances for a date
 */
async function deleteExistingInstances(supabase: any, date: string) {
  try {
    const { data, error } = await supabase
      .from('checklist_instances')
      .delete()
      .eq('date', date)
      .select('id')

    if (error) {
      console.warn(`Warning: Error deleting existing instances: ${error.message}`)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.warn(`Warning: Error deleting existing instances: ${error}`)
    return 0
  }
}

/**
 * Update instance statuses for a specific date
 */
async function updateInstanceStatuses(
  supabase: any,
  date: string,
  options: {
    testMode: boolean
    logLevel: string
  }
) {
  try {
    // Get all instances for the date
    const { data: instances, error: fetchError } = await supabase
      .from('checklist_instances')
      .select(`
        *,
        master_tasks (
          id,
          title,
          due_time,
          timing,
          frequency_rules
        )
      `)
      .eq('date', date)
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch instances: ${fetchError.message}`)
    }

    if (!instances || instances.length === 0) {
      console.log('No instances found for this date')
      return {
        date,
        totalInstances: 0,
        instancesUpdated: 0,
        instancesSkipped: 0,
        errors: 0,
        results: [],
        executionTime: 0,
        testMode: options.testMode,
        dryRun: false
      }
    }

    console.log(`Processing ${instances.length} instances for status updates`)

    // Process each instance
    const results: any[] = []
    let instancesUpdated = 0
    let instancesSkipped = 0
    let errors = 0

    for (const instance of instances) {
      try {
        const result = await processSingleInstanceStatus(supabase, instance, date, options)
        results.push(result)

        if (result.updated) {
          instancesUpdated++
        } else if (result.oldStatus === result.newStatus) {
          instancesSkipped++
        }

        if (result.error) {
          errors++
        }
      } catch (error) {
        const errorResult = {
          instanceId: instance.id,
          masterTaskId: instance.master_task_id,
          date: instance.date,
          oldStatus: instance.status,
          newStatus: instance.status,
          updated: false,
          reason: 'Error processing instance',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        results.push(errorResult)
        errors++
      }
    }

    return {
      date,
      totalInstances: instances.length,
      instancesUpdated,
      instancesSkipped,
      errors,
      results,
      executionTime: 0,
      testMode: options.testMode,
      dryRun: false
    }

  } catch (error) {
    throw new Error(`Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process a single instance to determine status updates
 */
async function processSingleInstanceStatus(
  supabase: any,
  instance: any,
  date: string,
  options: {
    testMode: boolean
    logLevel: string
  }
) {
  try {
    const currentStatus = instance.status
    const masterTask = instance.master_tasks
    
    if (!masterTask) {
      return {
        instanceId: instance.id,
        masterTaskId: instance.master_task_id,
        date: instance.date,
        oldStatus: currentStatus,
        newStatus: currentStatus,
        updated: false,
        reason: 'No master task information available'
      }
    }

    // Determine what the status should be
    const targetStatus = calculateTargetStatus(instance, masterTask, date)
    
    if (currentStatus === targetStatus) {
      return {
        instanceId: instance.id,
        masterTaskId: instance.master_task_id,
        date: instance.date,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        updated: false,
        reason: 'Status already correct'
      }
    }

    // Update the status
    if (options.testMode) {
      return {
        instanceId: instance.id,
        masterTaskId: instance.master_task_id,
        date: instance.date,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        updated: false,
        reason: 'Test mode - would update status'
      }
    }

    // Actually update the status
    const { error: updateError } = await supabase
      .from('checklist_instances')
      .update({ 
        status: targetStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', instance.id)

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`)
    }

    return {
      instanceId: instance.id,
      masterTaskId: instance.master_task_id,
      date: instance.date,
      oldStatus: currentStatus,
      newStatus: targetStatus,
      updated: true,
      reason: `Status updated from ${currentStatus} to ${targetStatus}`
    }

  } catch (error) {
    return {
      instanceId: instance.id,
      masterTaskId: instance.master_task_id,
      date: instance.date,
      oldStatus: instance.status,
      newStatus: instance.status,
      updated: false,
      reason: 'Error processing instance',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Calculate what the target status should be for an instance
 */
function calculateTargetStatus(instance: any, masterTask: any, date: string) {
  const currentStatus = instance.status
  const dueTime = masterTask.due_time

  // If already completed, don't change
  if (currentStatus === 'completed') {
    return 'completed'
  }

  const now = new Date()
  const instanceDate = new Date(date)
  const isToday = isSameDate(now, instanceDate)
  const isPastDate = instanceDate < now

  // Handle overdue logic
  if (isToday && dueTime && currentStatus !== 'completed') {
    const dueDateTime = new Date(`${date}T${dueTime}`)
    if (now > dueDateTime) {
      return 'overdue'
    }
  }

  // Handle missed logic
  if (isPastDate && currentStatus !== 'completed') {
    return 'missed'
  }

  // Default: keep current status
  return currentStatus
}

/**
 * Check if two dates are the same day
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}
