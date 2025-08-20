/**
 * Task Instance Generator for Master Checklist System
 * Pharmacy Intranet Portal - Daily Task Generation
 * 
 * This module provides functionality to:
 * - Generate checklist instances for a specific date
 * - Query active master tasks from the database
 * - Use recurrence engine to determine which tasks are due
 * - Insert checklist instances with idempotent behavior
 * - Handle bulk generation for date ranges
 */

import { supabase } from './db'
import { createRecurrenceEngine } from './recurrence-engine'
import { createSimpleFrequencyHandler } from './simple-frequency-handler'
import { createHolidayHelper } from './public-holidays'
import type { 
  TaskRow, 
  InstanceRow,
  CreateChecklistInstanceRequest 
} from './db'
import type { Task } from './recurrence-engine'
import type { SimpleTask } from './simple-frequency-handler'
import type { PublicHoliday } from './public-holidays'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Generation options for task instances
 */
export interface GenerationOptions {
  date: string // ISO date string (YYYY-MM-DD)
  testMode?: boolean // If true, don't actually insert records
  dryRun?: boolean // If true, return what would be generated without inserting
  forceRegenerate?: boolean // If true, delete existing instances before generating
  maxTasks?: number // Maximum number of tasks to process
  logLevel?: 'silent' | 'info' | 'debug'
}

/**
 * Generation result for a single task
 */
export interface TaskGenerationResult {
  taskId: string
  taskTitle: string
  isDue: boolean
  instanceCreated: boolean
  instanceId?: string
  error?: string
  skipped?: boolean
  reason?: string
}

/**
 * Overall generation result
 */
export interface GenerationResult {
  date: string
  totalTasks: number
  dueTasks: number
  instancesCreated: number
  instancesSkipped: number
  errors: number
  results: TaskGenerationResult[]
  executionTime: number
  testMode: boolean
  dryRun: boolean
}

/**
 * Bulk generation options
 */
export interface BulkGenerationOptions {
  startDate: string
  endDate: string
  testMode?: boolean
  dryRun?: boolean
  maxTasksPerDay?: number
  logLevel?: 'silent' | 'info' | 'debug'
}

/**
 * Bulk generation result
 */
export interface BulkGenerationResult {
  startDate: string
  endDate: string
  totalDays: number
  successfulDays: number
  failedDays: number
  totalInstancesCreated: number
  totalErrors: number
  dailyResults: Array<{
    date: string
    result: GenerationResult
  }>
  executionTime: number
}

// ========================================
// TASK INSTANCE GENERATOR CLASS
// ========================================

/**
 * Main task instance generator class
 * Handles daily generation of checklist instances
 */
export class TaskInstanceGenerator {
  private recurrenceEngine: ReturnType<typeof createRecurrenceEngine>
  private simpleFrequencyHandler: ReturnType<typeof createSimpleFrequencyHandler>
  private logLevel: 'silent' | 'info' | 'debug'

  constructor(publicHolidays: PublicHoliday[] = [], logLevel: 'silent' | 'info' | 'debug' = 'info') {
    const holidayHelper = createHolidayHelper(publicHolidays)
    this.recurrenceEngine = createRecurrenceEngine(holidayHelper)
    this.simpleFrequencyHandler = createSimpleFrequencyHandler({ holidayChecker: holidayHelper })
    this.logLevel = logLevel
  }

  /**
   * Generate checklist instances for a specific date
   * 
   * @param options - Generation options
   * @returns Promise<GenerationResult>
   */
  async generateForDate(options: GenerationOptions): Promise<GenerationResult> {
    const startTime = Date.now()
    const { date, testMode = false, dryRun = false, forceRegenerate = false, maxTasks } = options

    this.log('info', `Starting task instance generation for date: ${date}`)
    this.log('info', `Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}, Force: ${forceRegenerate}`)

    try {
      // Step 1: Get all active master tasks that respect publish_delay
      const { data: masterTasks, error: tasksError } = await supabase
        .from('master_tasks')
        .select('*')
        .eq('publish_status', 'active')
        .or(`publish_delay.is.null,publish_delay.lte.${date}`) // Only include tasks that are past their publish delay
        .order('created_at', { ascending: true })

      if (tasksError) {
        throw new Error(`Failed to fetch master tasks: ${tasksError.message}`)
      }

      if (!masterTasks || masterTasks.length === 0) {
        this.log('info', 'No active master tasks found')
        return this.createEmptyResult(date, testMode, dryRun, startTime)
      }

      // Apply max tasks limit if specified
      const tasksToProcess = maxTasks ? masterTasks.slice(0, maxTasks) : masterTasks
      this.log('info', `Processing ${tasksToProcess.length} master tasks`)

      // Step 2: Check if instances already exist for this date
      if (!forceRegenerate && !dryRun) {
        const existingInstances = await this.checkExistingInstances(date)
        if (existingInstances.length > 0) {
          this.log('info', `Found ${existingInstances.length} existing instances for ${date}`)
          
          if (!testMode) {
            // Check if we should skip generation (all tasks have instances)
            const tasksWithInstances = new Set(existingInstances.map(inst => inst.master_task_id))
            const allTasksHaveInstances = tasksToProcess.every(task => tasksWithInstances.has(task.id))
            
            if (allTasksHaveInstances) {
              this.log('info', 'All tasks already have instances for this date, skipping generation')
              return this.createEmptyResult(date, testMode, dryRun, startTime, tasksToProcess.length)
            }
          }
        }
      }

      // Step 3: Force delete existing instances if requested
      if (forceRegenerate && !dryRun && !testMode) {
        const deletedCount = await this.deleteExistingInstances(date)
        this.log('info', `Deleted ${deletedCount} existing instances for regeneration`)
      }

      // Step 4: Process each task and generate instances
      const results: TaskGenerationResult[] = []
      let instancesCreated = 0
      let instancesSkipped = 0
      let errors = 0

      for (const masterTask of tasksToProcess) {
        try {
          const result = await this.processSingleTask(masterTask, date, testMode, dryRun)
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
          const errorResult: TaskGenerationResult = {
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

      const executionTime = Date.now() - startTime
      const dueTasks = results.filter(r => r.isDue).length

      const finalResult: GenerationResult = {
        date,
        totalTasks: tasksToProcess.length,
        dueTasks,
        instancesCreated,
        instancesSkipped,
        errors,
        results,
        executionTime,
        testMode,
        dryRun
      }

      this.log('info', `Generation completed in ${executionTime}ms`)
      this.log('info', `Results: ${dueTasks} due, ${instancesCreated} created, ${instancesSkipped} skipped, ${errors} errors`)

      return finalResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.log('info', `Generation failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      return {
        date,
        totalTasks: 0,
        dueTasks: 0,
        instancesCreated: 0,
        instancesSkipped: 0,
        errors: 1,
        results: [{
          taskId: 'error',
          taskTitle: 'Generation Error',
          isDue: false,
          instanceCreated: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          skipped: false
        }],
        executionTime,
        testMode,
        dryRun
      }
    }
  }

  /**
   * Generate instances for a date range
   * 
   * @param options - Bulk generation options
   * @returns Promise<BulkGenerationResult>
   */
  async generateForDateRange(options: BulkGenerationOptions): Promise<BulkGenerationResult> {
    const startTime = Date.now()
    const { startDate, endDate, testMode = false, dryRun = false, maxTasksPerDay } = options

    this.log('info', `Starting bulk generation from ${startDate} to ${endDate}`)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const dailyResults: Array<{ date: string; result: GenerationResult }> = []
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
          logLevel: this.logLevel
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
          result: {
            date: dateString,
            totalTasks: 0,
            dueTasks: 0,
            instancesCreated: 0,
            instancesSkipped: 0,
            errors: 1,
            results: [{
              taskId: 'error',
              taskTitle: 'Generation Error',
              isDue: false,
              instanceCreated: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              skipped: false
            }],
            executionTime: 0,
            testMode,
            dryRun
          }
        })
      }
    }

    const executionTime = Date.now() - startTime

    const bulkResult: BulkGenerationResult = {
      startDate,
      endDate,
      totalDays,
      successfulDays,
      failedDays,
      totalInstancesCreated,
      totalErrors,
      dailyResults,
      executionTime
    }

    this.log('info', `Bulk generation completed in ${executionTime}ms`)
    this.log('info', `Summary: ${successfulDays}/${totalDays} days successful, ${totalInstancesCreated} total instances, ${totalErrors} total errors`)

    return bulkResult
  }

  /**
   * Process a single master task to determine if it's due and create instance
   */
  private async processSingleTask(
    masterTask: TaskRow,
    date: string,
    testMode: boolean,
    dryRun: boolean
  ): Promise<TaskGenerationResult> {
    try {
      // Check if task is due on this date
      const checkDate = new Date(date)
      
      // First check if it's a holiday - no tasks should appear on holidays
      const isHoliday = this.recurrenceEngine.holidayHelper.isHoliday(checkDate)
      if (isHoliday) {
        return {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          isDue: false,
          instanceCreated: false,
          skipped: true,
          reason: 'Date is a public holiday'
        }
      }
      
      let isDue = false
      
      // Check using new frequencies array if available
      if (masterTask.frequencies && masterTask.frequencies.length > 0) {
        const simpleTask: SimpleTask = {
          id: masterTask.id,
          frequencies: masterTask.frequencies,
          due_date: masterTask.due_date,
          start_date: masterTask.start_date,
          end_date: masterTask.end_date
        }
        
        isDue = this.simpleFrequencyHandler.isTaskDue(simpleTask, date)
      }
      // Fall back to legacy frequency_rules if no frequencies array
      else if (masterTask.frequency_rules) {
        const task: Task = {
          id: masterTask.id,
          frequency_rules: masterTask.frequency_rules,
          start_date: masterTask.created_at,
          end_date: undefined // No end date for now
        }
        
        isDue = this.recurrenceEngine.isDueOnDate(task, checkDate)
      }

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
      if (!dryRun && !testMode) {
        const existingInstance = await this.checkInstanceExists(masterTask.id, date)
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
      if (dryRun) {
        return {
          taskId: masterTask.id,
          taskTitle: masterTask.title || 'Unknown',
          isDue: true,
          instanceCreated: false,
          skipped: false,
          reason: 'Dry run mode - would create instance'
        }
      }

      if (testMode) {
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
      const instanceData: CreateChecklistInstanceRequest = {
        master_task_id: masterTask.id,
        date: date,
        role: masterTask.responsibility?.[0] || 'default', // Use first responsibility as default role
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
  private async checkExistingInstances(date: string): Promise<InstanceRow[]> {
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('*')
      .eq('date', date)

    if (error) {
      this.log('debug', `Error checking existing instances: ${error.message}`)
      return []
    }

    return data || []
  }

  /**
   * Check if a specific instance exists
   */
  private async checkInstanceExists(masterTaskId: string, date: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('master_task_id', masterTaskId)
      .eq('date', date)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      this.log('debug', `Error checking instance existence: ${error.message}`)
      return false
    }

    return !!data
  }

  /**
   * Delete existing instances for a date
   */
  private async deleteExistingInstances(date: string): Promise<number> {
    const { data, error } = await supabase
      .from('checklist_instances')
      .delete()
      .eq('date', date)
      .select('id')

    if (error) {
      this.log('debug', `Error deleting existing instances: ${error.message}`)
      return 0
    }

    return data?.length || 0
  }

  /**
   * Create an empty result for cases with no tasks
   */
  private createEmptyResult(
    date: string,
    testMode: boolean,
    dryRun: boolean,
    startTime: number,
    totalTasks: number = 0
  ): GenerationResult {
    const executionTime = Date.now() - startTime
    
    return {
      date,
      totalTasks,
      dueTasks: 0,
      instancesCreated: 0,
      instancesSkipped: 0,
      errors: 0,
      results: [],
      executionTime,
      testMode,
      dryRun
    }
  }

  /**
   * Log messages based on log level
   */
  private log(level: 'silent' | 'info' | 'debug', message: string): void {
    if (this.logLevel === 'silent') return
    
    if (level === 'debug' && this.logLevel !== 'debug') return
    
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
  }

  /**
   * Set the log level
   */
  setLogLevel(level: 'silent' | 'info' | 'debug'): void {
    this.logLevel = level
  }

  /**
   * Get the current recurrence engine
   */
  getRecurrenceEngine() {
    return this.recurrenceEngine
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Create a task instance generator with default configuration
 */
export function createTaskInstanceGenerator(
  publicHolidays: PublicHoliday[] = [],
  logLevel: 'silent' | 'info' | 'debug' = 'info'
): TaskInstanceGenerator {
  return new TaskInstanceGenerator(publicHolidays, logLevel)
}

/**
 * Create a task instance generator with test mode enabled
 */
export function createTestTaskInstanceGenerator(
  publicHolidays: PublicHoliday[] = []
): TaskInstanceGenerator {
  return new TaskInstanceGenerator(publicHolidays, 'debug')
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate instances for today
 */
export async function generateForToday(
  publicHolidays: PublicHoliday[] = [],
  options: Partial<GenerationOptions> = {}
): Promise<GenerationResult> {
  const today = new Date().toISOString().split('T')[0]
  const generator = createTaskInstanceGenerator(publicHolidays)
  
  return generator.generateForDate({
    date: today,
    ...options
  })
}

/**
 * Generate instances for yesterday
 */
export async function generateForYesterday(
  publicHolidays: PublicHoliday[] = [],
  options: Partial<GenerationOptions> = {}
): Promise<GenerationResult> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateString = yesterday.toISOString().split('T')[0]
  
  const generator = createTaskInstanceGenerator(publicHolidays)
  
  return generator.generateForDate({
    date: dateString,
    ...options
  })
}

/**
 * Generate instances for a specific task
 */
export async function generateInstancesForTask(
  taskId: string,
  date: string,
  publicHolidays: PublicHoliday[] = [],
  options: Partial<GenerationOptions> = {}
): Promise<TaskGenerationResult> {
  const generator = createTaskInstanceGenerator(publicHolidays)
  const result = await generator.generateForDate({
    date,
    maxTasks: 1,
    ...options
  })
  
  const taskResult = result.tasks.find(t => t.taskId === taskId)
  return taskResult || {
    taskId,
    taskTitle: 'Unknown Task',
    isDue: false,
    instanceCreated: false,
    error: 'Task not found'
  }
}

/**
 * Run daily generation job
 */
export async function runDailyGeneration(
  options: Partial<GenerationOptions> = {}
): Promise<GenerationResult> {
  // Fetch holidays from database
  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  return generateForToday(holidays || [], options)
}

/**
 * Generate task instances for a specific date
 */
export async function generateTaskInstances(
  date: string,
  options: Partial<GenerationOptions> = {}
): Promise<GenerationResult> {
  // Fetch holidays from database
  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  const generator = createTaskInstanceGenerator(holidays || [])
  return generator.generateForDate({
    date,
    ...options
  })
}

// ========================================
// EXPORTS
// ========================================

export type {
  GenerationOptions,
  GenerationResult,
  TaskGenerationResult,
  BulkGenerationOptions,
  BulkGenerationResult
}