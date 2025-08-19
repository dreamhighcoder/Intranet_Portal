/**
 * New Task Generator Service
 * Replaces the old task-instance-generator with the new recurrence engine
 */

import { NewRecurrenceEngine, createNewRecurrenceEngine, type MasterTask, type TaskInstance } from './new-recurrence-engine'
import { RecurrenceMigrationService, createMigrationService } from './recurrence-migration'
import { supabase } from './db'
import type { MasterChecklistTask } from '@/types/checklist'

// ========================================
// TYPES AND INTERFACES
// ========================================

export interface NewGenerationOptions {
  date: string // ISO date string (YYYY-MM-DD)
  testMode?: boolean // If true, don't actually insert records
  dryRun?: boolean // If true, return what would be generated without inserting
  forceRegenerate?: boolean // If true, delete existing instances before generating
  maxTasks?: number // Maximum number of tasks to process
  logLevel?: 'silent' | 'info' | 'debug'
  useNewEngine?: boolean // If true, use new recurrence engine
}

export interface NewGenerationResult {
  date: string
  totalTasks: number
  newInstances: number
  carryInstances: number
  instancesCreated: number
  instancesSkipped: number
  errors: number
  results: NewTaskGenerationResult[]
  executionTime: number
  testMode: boolean
  dryRun: boolean
  engineUsed: 'old' | 'new'
}

export interface NewTaskGenerationResult {
  taskId: string
  taskTitle: string
  frequency: string
  shouldAppear: boolean
  isCarryOver: boolean
  instanceCreated: boolean
  instanceId?: string
  dueDate?: string
  error?: string
  skipped?: boolean
  reason?: string
}

export interface BulkNewGenerationOptions {
  startDate: string
  endDate: string
  testMode?: boolean
  dryRun?: boolean
  maxTasksPerDay?: number
  logLevel?: 'silent' | 'info' | 'debug'
  useNewEngine?: boolean
}

export interface BulkNewGenerationResult {
  startDate: string
  endDate: string
  totalDays: number
  successfulDays: number
  failedDays: number
  totalInstancesCreated: number
  totalErrors: number
  dailyResults: Array<{
    date: string
    result: NewGenerationResult
  }>
  executionTime: number
  engineUsed: 'old' | 'new'
}

// ========================================
// NEW TASK GENERATOR CLASS
// ========================================

export class NewTaskGenerator {
  private recurrenceEngine: NewRecurrenceEngine
  private migrationService: RecurrenceMigrationService
  private logLevel: 'silent' | 'info' | 'debug'

  constructor(publicHolidays: any[] = [], logLevel: 'silent' | 'info' | 'debug' = 'info') {
    this.recurrenceEngine = createNewRecurrenceEngine(publicHolidays)
    this.migrationService = createMigrationService()
    this.logLevel = logLevel
  }

  /**
   * Generate task instances for a specific date using the new engine
   */
  async generateForDate(options: NewGenerationOptions): Promise<NewGenerationResult> {
    const startTime = Date.now()
    const { 
      date, 
      testMode = false, 
      dryRun = false, 
      forceRegenerate = false, 
      maxTasks,
      useNewEngine = true 
    } = options

    this.log('info', `Starting new task generation for date: ${date}`)
    this.log('info', `Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}, Engine: ${useNewEngine ? 'NEW' : 'OLD'}`)

    try {
      // Step 1: Get all active master tasks
      const { data: masterTasks, error: tasksError } = await supabase
        .from('master_tasks')
        .select('*')
        .eq('publish_status', 'active')
        .or(`publish_delay.is.null,publish_delay.lte.${date}`)
        .order('created_at', { ascending: true })

      if (tasksError) {
        throw new Error(`Failed to fetch master tasks: ${tasksError.message}`)
      }

      if (!masterTasks || masterTasks.length === 0) {
        this.log('info', 'No active master tasks found')
        return this.createEmptyResult(date, testMode, dryRun, startTime, useNewEngine ? 'new' : 'old')
      }

      // Apply max tasks limit if specified
      const tasksToProcess = maxTasks ? masterTasks.slice(0, maxTasks) : masterTasks
      this.log('info', `Processing ${tasksToProcess.length} master tasks`)

      // Step 2: Check existing instances if not forcing regeneration
      if (!forceRegenerate && !dryRun) {
        const existingInstances = await this.checkExistingInstances(date)
        if (existingInstances.length > 0) {
          this.log('info', `Found ${existingInstances.length} existing instances for ${date}`)
          
          if (!testMode) {
            const tasksWithInstances = new Set(existingInstances.map(inst => inst.master_task_id))
            const allTasksHaveInstances = tasksToProcess.every(task => tasksWithInstances.has(task.id))
            
            if (allTasksHaveInstances) {
              this.log('info', 'All tasks already have instances for this date, skipping generation')
              return this.createEmptyResult(date, testMode, dryRun, startTime, useNewEngine ? 'new' : 'old', tasksToProcess.length)
            }
          }
        }
      }

      // Step 3: Force delete existing instances if requested
      if (forceRegenerate && !dryRun && !testMode) {
        const deletedCount = await this.deleteExistingInstances(date)
        this.log('info', `Deleted ${deletedCount} existing instances for regeneration`)
      }

      // Step 4: Process tasks with appropriate engine
      let results: NewTaskGenerationResult[]
      let newInstances = 0
      let carryInstances = 0
      let instancesCreated = 0
      let instancesSkipped = 0
      let errors = 0

      if (useNewEngine) {
        // Use new recurrence engine
        const convertedTasks = this.migrationService.convertMasterTasks(tasksToProcess)
        const generationResult = this.recurrenceEngine.generateInstancesForDate(convertedTasks, date)
        
        results = []
        
        // Process new instances
        for (const instance of generationResult.instances) {
          const masterTask = tasksToProcess.find(t => t.id === instance.master_task_id)
          if (!masterTask) continue

          try {
            const result = await this.createTaskInstance(instance, masterTask, testMode, dryRun, false)
            results.push(result)
            
            if (result.instanceCreated) {
              instancesCreated++
              newInstances++
            } else if (result.skipped) {
              instancesSkipped++
            }
            
            if (result.error) {
              errors++
            }
          } catch (error) {
            const errorResult = this.createErrorResult(masterTask, error)
            results.push(errorResult)
            errors++
          }
        }

        // Process carry-over instances
        for (const instance of generationResult.carry_instances) {
          const masterTask = tasksToProcess.find(t => t.id === instance.master_task_id)
          if (!masterTask) continue

          try {
            const result = await this.createTaskInstance(instance, masterTask, testMode, dryRun, true)
            results.push(result)
            
            if (result.instanceCreated) {
              instancesCreated++
              carryInstances++
            } else if (result.skipped) {
              instancesSkipped++
            }
            
            if (result.error) {
              errors++
            }
          } catch (error) {
            const errorResult = this.createErrorResult(masterTask, error)
            results.push(errorResult)
            errors++
          }
        }
      } else {
        // Fallback to old logic (simplified for now)
        results = []
        this.log('info', 'Using old engine logic (not implemented in this version)')
      }

      const executionTime = Date.now() - startTime

      const finalResult: NewGenerationResult = {
        date,
        totalTasks: tasksToProcess.length,
        newInstances,
        carryInstances,
        instancesCreated,
        instancesSkipped,
        errors,
        results,
        executionTime,
        testMode,
        dryRun,
        engineUsed: useNewEngine ? 'new' : 'old'
      }

      this.log('info', `Generation completed in ${executionTime}ms`)
      this.log('info', `Results: ${newInstances} new, ${carryInstances} carry, ${instancesCreated} created, ${instancesSkipped} skipped, ${errors} errors`)

      return finalResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.log('info', `Generation failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      return {
        date,
        totalTasks: 0,
        newInstances: 0,
        carryInstances: 0,
        instancesCreated: 0,
        instancesSkipped: 0,
        errors: 1,
        results: [{
          taskId: 'error',
          taskTitle: 'Generation Error',
          frequency: 'unknown',
          shouldAppear: false,
          isCarryOver: false,
          instanceCreated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          skipped: false
        }],
        executionTime,
        testMode,
        dryRun,
        engineUsed: useNewEngine ? 'new' : 'old'
      }
    }
  }

  /**
   * Generate instances for a date range
   */
  async generateForDateRange(options: BulkNewGenerationOptions): Promise<BulkNewGenerationResult> {
    const startTime = Date.now()
    const { 
      startDate, 
      endDate, 
      testMode = false, 
      dryRun = false, 
      maxTasksPerDay,
      useNewEngine = true 
    } = options

    this.log('info', `Starting bulk generation from ${startDate} to ${endDate}`)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const dailyResults: Array<{ date: string; result: NewGenerationResult }> = []
    let successfulDays = 0
    let failedDays = 0
    let totalInstancesCreated = 0
    let totalErrors = 0

    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(start)
      currentDate.setDate(start.getDate() + i)
      const dateString = currentDate.toISOString().split('T')[0]

      try {
        const result = await this.generateForDate({
          date: dateString,
          testMode,
          dryRun,
          maxTasks: maxTasksPerDay,
          logLevel: this.logLevel,
          useNewEngine
        })

        dailyResults.push({ date: dateString, result })
        totalInstancesCreated += result.instancesCreated
        totalErrors += result.errors

        if (result.errors === 0) {
          successfulDays++
        } else {
          failedDays++
        }

        this.log('info', `Completed ${dateString}: ${result.instancesCreated} instances, ${result.errors} errors`)
      } catch (error) {
        failedDays++
        totalErrors++
        this.log('info', `Failed to generate for ${dateString}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        dailyResults.push({
          date: dateString,
          result: this.createEmptyResult(dateString, testMode, dryRun, Date.now(), useNewEngine ? 'new' : 'old', 0, error)
        })
      }
    }

    const executionTime = Date.now() - startTime

    const bulkResult: BulkNewGenerationResult = {
      startDate,
      endDate,
      totalDays,
      successfulDays,
      failedDays,
      totalInstancesCreated,
      totalErrors,
      dailyResults,
      executionTime,
      engineUsed: useNewEngine ? 'new' : 'old'
    }

    this.log('info', `Bulk generation completed in ${executionTime}ms`)
    this.log('info', `Summary: ${successfulDays}/${totalDays} days successful, ${totalInstancesCreated} total instances, ${totalErrors} total errors`)

    return bulkResult
  }

  /**
   * Update task statuses using the new engine
   */
  async updateStatusesForDate(date: string, testMode: boolean = false): Promise<{
    date: string
    instancesUpdated: number
    errors: number
    results: any[]
  }> {
    this.log('info', `Updating statuses for date: ${date}`)

    try {
      // Get all instances for the date
      const { data: instances, error: fetchError } = await supabase
        .from('task_instances')
        .select('*')
        .eq('instance_date', date)

      if (fetchError) {
        throw new Error(`Failed to fetch instances: ${fetchError.message}`)
      }

      if (!instances || instances.length === 0) {
        this.log('info', 'No instances found for status update')
        return {
          date,
          instancesUpdated: 0,
          errors: 0,
          results: []
        }
      }

      // Convert to new format and update statuses
      const taskInstances: TaskInstance[] = instances.map(inst => ({
        id: inst.id,
        master_task_id: inst.master_task_id,
        date: inst.instance_date,
        due_date: inst.due_date,
        due_time: inst.due_time || '09:00',
        status: inst.status as any,
        locked: inst.locked || false,
        created_at: inst.created_at,
        updated_at: inst.updated_at,
        due_date_override: undefined,
        due_time_override: undefined
      }))

      const currentDateTime = new Date()
      const statusUpdates = this.recurrenceEngine.updateInstanceStatuses(taskInstances, currentDateTime)

      let instancesUpdated = 0
      const results = []

      for (const update of statusUpdates) {
        if (!testMode) {
          // Apply the status update to the database
          const { error: updateError } = await supabase
            .from('task_instances')
            .update({
              status: update.new_status,
              locked: update.locked,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.instance_id)

          if (updateError) {
            this.log('info', `Failed to update instance ${update.instance_id}: ${updateError.message}`)
            results.push({ ...update, error: updateError.message })
          } else {
            instancesUpdated++
            results.push(update)
          }
        } else {
          instancesUpdated++
          results.push(update)
        }
      }

      this.log('info', `Status update completed: ${instancesUpdated} instances updated`)

      return {
        date,
        instancesUpdated,
        errors: statusUpdates.length - instancesUpdated,
        results
      }

    } catch (error) {
      this.log('info', `Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        date,
        instancesUpdated: 0,
        errors: 1,
        results: [{
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      }
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async createTaskInstance(
    instance: TaskInstance,
    masterTask: MasterChecklistTask,
    testMode: boolean,
    dryRun: boolean,
    isCarryOver: boolean
  ): Promise<NewTaskGenerationResult> {
    try {
      if (dryRun || testMode) {
        return {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          frequency: masterTask.frequency,
          shouldAppear: true,
          isCarryOver,
          instanceCreated: true,
          instanceId: instance.id,
          dueDate: instance.due_date,
          reason: testMode ? 'Test mode' : 'Dry run'
        }
      }

      // Check if instance already exists
      const { data: existing } = await supabase
        .from('task_instances')
        .select('id')
        .eq('master_task_id', instance.master_task_id)
        .eq('instance_date', instance.date)
        .single()

      if (existing) {
        return {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          frequency: masterTask.frequency,
          shouldAppear: true,
          isCarryOver,
          instanceCreated: false,
          skipped: true,
          reason: 'Instance already exists'
        }
      }

      // Create new instance
      const { data: newInstance, error: insertError } = await supabase
        .from('task_instances')
        .insert({
          master_task_id: instance.master_task_id,
          instance_date: instance.date,
          due_date: instance.due_date,
          due_time: instance.due_time,
          status: 'not_due', // Map from new status to old status
          is_published: true,
          locked: false,
          acknowledged: false,
          resolved: false
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create instance: ${insertError.message}`)
      }

      return {
        taskId: masterTask.id,
        taskTitle: masterTask.title || 'Unknown',
        frequency: masterTask.frequency,
        shouldAppear: true,
        isCarryOver,
        instanceCreated: true,
        instanceId: newInstance.id,
        dueDate: instance.due_date
      }

    } catch (error) {
      return {
        taskId: masterTask.id,
        taskTitle: masterTask.title || 'Unknown',
        frequency: masterTask.frequency,
        shouldAppear: true,
        isCarryOver,
        instanceCreated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private createErrorResult(masterTask: MasterChecklistTask, error: any): NewTaskGenerationResult {
    return {
      taskId: masterTask.id,
      taskTitle: masterTask.title || 'Unknown',
      frequency: masterTask.frequency,
      shouldAppear: false,
      isCarryOver: false,
      instanceCreated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      skipped: false
    }
  }

  private createEmptyResult(
    date: string, 
    testMode: boolean, 
    dryRun: boolean, 
    startTime: number, 
    engineUsed: 'old' | 'new',
    totalTasks: number = 0,
    error?: any
  ): NewGenerationResult {
    return {
      date,
      totalTasks,
      newInstances: 0,
      carryInstances: 0,
      instancesCreated: 0,
      instancesSkipped: 0,
      errors: error ? 1 : 0,
      results: error ? [{
        taskId: 'error',
        taskTitle: 'Error',
        frequency: 'unknown',
        shouldAppear: false,
        isCarryOver: false,
        instanceCreated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }] : [],
      executionTime: Date.now() - startTime,
      testMode,
      dryRun,
      engineUsed
    }
  }

  private async checkExistingInstances(date: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('task_instances')
      .select('id, master_task_id')
      .eq('instance_date', date)

    if (error) {
      throw new Error(`Failed to check existing instances: ${error.message}`)
    }

    return data || []
  }

  private async deleteExistingInstances(date: string): Promise<number> {
    const { data, error } = await supabase
      .from('task_instances')
      .delete()
      .eq('instance_date', date)
      .select()

    if (error) {
      throw new Error(`Failed to delete existing instances: ${error.message}`)
    }

    return data?.length || 0
  }

  private log(level: 'silent' | 'info' | 'debug', message: string): void {
    if (this.logLevel !== 'silent' && (this.logLevel === 'debug' || level === 'info')) {
      console.log(`[NewTaskGenerator] ${message}`)
    }
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

export function createNewTaskGenerator(publicHolidays: any[] = []): NewTaskGenerator {
  return new NewTaskGenerator(publicHolidays)
}

export function createNewTaskGeneratorWithConfig(
  publicHolidays: any[] = [],
  logLevel: 'silent' | 'info' | 'debug' = 'info'
): NewTaskGenerator {
  return new NewTaskGenerator(publicHolidays, logLevel)
}