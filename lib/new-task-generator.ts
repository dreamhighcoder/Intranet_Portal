/**
 * New Task Generator using Complete Recurrence & Status Engine
 * Pharmacy Intranet Portal - Task Instance Generation
 * 
 * This module provides functionality to:
 * - Generate task instances using the complete recurrence engine
 * - Handle carry instances and new instances separately
 * - Update task statuses based on precise timing rules
 * - Support bulk operations for date ranges
 */

import { NewRecurrenceEngine, TaskStatus, type MasterTask, type TaskInstance, type NewFrequencyType } from './new-recurrence-engine'
import { TaskDatabaseAdapter } from './task-database-adapter'
import { HolidayChecker, createHolidayChecker } from './holiday-checker'
import { getTaskGenerationSettings } from './system-settings'
import { 
  getAustralianNow, 
  getAustralianToday, 
  parseAustralianDate, 
  formatAustralianDate
} from './timezone-utils'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Generation options for task instances
 */
export interface NewGenerationOptions {
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
export interface NewTaskGenerationResult {
  taskId: string
  taskTitle: string
  frequencies: NewFrequencyType[]
  newInstances: number
  carryInstances: number
  totalInstances: number
  error?: string
  skipped?: boolean
  reason?: string
}

/**
 * Overall generation result
 */
export interface NewGenerationResult {
  date: string
  totalTasks: number
  tasksProcessed: number
  newInstances: number
  carryInstances: number
  totalInstances: number
  instancesSkipped: number
  errors: number
  results: NewTaskGenerationResult[]
  executionTime: number
  testMode: boolean
  dryRun: boolean
}

/**
 * Status update options
 */
export interface NewStatusUpdateOptions {
  date?: string // ISO date string (YYYY-MM-DD), defaults to today
  testMode?: boolean // If true, don't actually update records
  dryRun?: boolean // If true, return what would be updated without updating
  maxInstances?: number // Maximum instances to process
  logLevel?: 'silent' | 'info' | 'debug'
}

/**
 * Status update result for a single instance
 */
export interface NewInstanceStatusUpdateResult {
  instanceId: string
  masterTaskId: string
  date: string
  oldStatus: TaskStatus
  newStatus: TaskStatus
  locked: boolean
  updated: boolean
  reason: string
  error?: string
}

/**
 * Overall status update result
 */
export interface NewStatusUpdateResult {
  date: string
  totalInstances: number
  instancesUpdated: number
  instancesSkipped: number
  errors: number
  results: NewInstanceStatusUpdateResult[]
  executionTime: number
  testMode: boolean
  dryRun: boolean
}

// ========================================
// NEW TASK GENERATOR CLASS
// ========================================

/**
 * New task generator using the complete recurrence engine
 */
export class NewTaskGenerator {
  private engine: NewRecurrenceEngine
  private adapter: TaskDatabaseAdapter
  private logLevel: 'silent' | 'info' | 'debug'

  constructor(holidayChecker: HolidayChecker, logLevel: 'silent' | 'info' | 'debug' = 'info') {
    this.engine = new NewRecurrenceEngine(holidayChecker)
    this.adapter = new TaskDatabaseAdapter()
    this.logLevel = logLevel
  }

  /**
   * Generate task instances for a specific date
   */
  async generateForDate(options: NewGenerationOptions): Promise<NewGenerationResult> {
    const startTime = Date.now()
    const { date, testMode = false, dryRun = false, forceRegenerate = false, maxTasks } = options

    this.log('info', `Starting new task generation for date: ${date}`)
    this.log('info', `Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}, Force: ${forceRegenerate}`)

    try {
      // Step 1: Get all active master tasks using the database adapter
      const masterTasks = await this.adapter.loadActiveMasterTasks(date)

      if (masterTasks.length === 0) {
        this.log('info', 'No active master tasks found')
        return this.createEmptyResult(date, testMode, dryRun, startTime)
      }

      // Apply max tasks limit if specified
      const tasksToProcess = maxTasks ? masterTasks.slice(0, maxTasks) : masterTasks
      this.log('info', `Processing ${tasksToProcess.length} master tasks`)

      // Step 2: Check if instances already exist for this date
      if (!forceRegenerate && !dryRun) {
        const instancesExist = await this.adapter.instancesExistForDate(date)
        if (instancesExist) {
          this.log('info', `Found existing instances for ${date}`)
          
          if (!testMode) {
            this.log('info', 'Instances already exist for this date, skipping generation')
            return this.createEmptyResult(date, testMode, dryRun, startTime, tasksToProcess.length)
          }
        }
      }

      // Step 3: Force delete existing instances if requested
      if (forceRegenerate && !dryRun && !testMode) {
        await this.adapter.deleteInstancesForDate(date)
        this.log('info', `Deleted existing instances for regeneration`)
      }

      // Step 4: Generate instances using the engine
      const generationResult = this.engine.generateInstancesForDate(tasksToProcess, date)
      
      // Step 5: Save instances to database if not in dry run mode
      if (!dryRun && !testMode && (generationResult.instances.length > 0 || generationResult.carry_instances.length > 0)) {
        const allInstances = [...generationResult.instances, ...generationResult.carry_instances]
        await this.adapter.saveTaskInstances(allInstances)
        this.log('info', `Saved ${allInstances.length} instances to database`)
      }

      // Step 6: Build results
      const results: NewTaskGenerationResult[] = []
      let totalNewInstances = generationResult.instances.length
      let totalCarryInstances = generationResult.carry_instances.length
      let instancesSkipped = 0
      let errors = 0

      // Group results by task
      const taskResults = new Map<string, { new: number, carry: number }>()
      
      for (const instance of generationResult.instances) {
        const current = taskResults.get(instance.master_task_id) || { new: 0, carry: 0 }
        current.new++
        taskResults.set(instance.master_task_id, current)
      }
      
      for (const instance of generationResult.carry_instances) {
        const current = taskResults.get(instance.master_task_id) || { new: 0, carry: 0 }
        current.carry++
        taskResults.set(instance.master_task_id, current)
      }

      // Create results for each processed task
      for (const task of tasksToProcess) {
        const taskResult = taskResults.get(task.id) || { new: 0, carry: 0 }
        
        results.push({
          taskId: task.id,
          taskTitle: task.title || `Task ${task.id}`,
          frequencies: task.frequencies,
          newInstances: taskResult.new,
          carryInstances: taskResult.carry,
          totalInstances: taskResult.new + taskResult.carry
        })
      }

      const executionTime = Date.now() - startTime

      const finalResult: NewGenerationResult = {
        date,
        totalTasks: tasksToProcess.length,
        tasksProcessed: tasksToProcess.length,
        newInstances: totalNewInstances,
        carryInstances: totalCarryInstances,
        totalInstances: totalNewInstances + totalCarryInstances,
        instancesSkipped,
        errors,
        results,
        executionTime,
        testMode,
        dryRun
      }

      this.log('info', `Generation completed in ${executionTime}ms`)
      this.log('info', `Results: ${totalNewInstances} new, ${totalCarryInstances} carry, ${errors} errors`)

      return finalResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.log('info', `Generation failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      return {
        date,
        totalTasks: 0,
        tasksProcessed: 0,
        newInstances: 0,
        carryInstances: 0,
        totalInstances: 0,
        instancesSkipped: 0,
        errors: 1,
        results: [{
          taskId: 'error',
          taskTitle: 'Generation Error',
          frequencies: [],
          newInstances: 0,
          carryInstances: 0,
          totalInstances: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        executionTime,
        testMode,
        dryRun
      }
    }
  }

  /**
   * Update statuses for existing instances
   */
  async updateStatusesForDate(options: NewStatusUpdateOptions = {}): Promise<NewStatusUpdateResult> {
    const startTime = Date.now()
    const { 
      date = getAustralianToday(),
      testMode = false,
      dryRun = false,
      maxInstances
    } = options

    this.log('info', `Starting status update for date: ${date}`)
    this.log('info', `Mode: ${testMode ? 'TEST' : 'PRODUCTION'}, Dry Run: ${dryRun}`)

    try {
      // Step 1: Get all instances for the date using the database adapter
      const instances = await this.adapter.loadTaskInstancesForDate(date)

      if (instances.length === 0) {
        this.log('info', 'No instances found for this date')
        return this.createEmptyStatusResult(date, testMode, dryRun, startTime)
      }

      // Apply max instances limit if specified
      const instancesToProcess = maxInstances ? instances.slice(0, maxInstances) : instances
      this.log('info', `Processing ${instancesToProcess.length} instances`)

      // Step 2: Update statuses using the engine with Australian timezone
      const currentDateTime = getAustralianNow()
      const statusResults = this.engine.updateInstanceStatuses(instancesToProcess, currentDateTime)

      // Step 3: Collect updates for database
      const updates: Array<{ id: string, status: TaskStatus, locked: boolean }> = []
      const results: NewInstanceStatusUpdateResult[] = []
      let instancesUpdated = 0
      let instancesSkipped = 0
      let errors = 0

      for (const statusResult of statusResults) {
        try {
          const instance = instancesToProcess.find(inst => inst.id === statusResult.instance_id)
          if (!instance) continue

          if (statusResult.updated && !dryRun && !testMode) {
            updates.push({
              id: statusResult.instance_id,
              status: statusResult.new_status,
              locked: statusResult.locked
            })
          }

          results.push({
            instanceId: statusResult.instance_id,
            masterTaskId: instance.master_task_id,
            date: instance.date,
            oldStatus: statusResult.old_status,
            newStatus: statusResult.new_status,
            locked: statusResult.locked,
            updated: statusResult.updated,
            reason: statusResult.reason
          })

          if (statusResult.updated) {
            instancesUpdated++
          } else {
            instancesSkipped++
          }

        } catch (error) {
          const instance = instancesToProcess.find(inst => inst.id === statusResult.instance_id)
          results.push({
            instanceId: statusResult.instance_id,
            masterTaskId: instance?.master_task_id || 'unknown',
            date: instance?.date || date,
            oldStatus: statusResult.old_status,
            newStatus: statusResult.old_status,
            locked: false,
            updated: false,
            reason: 'Update failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          errors++
        }
      }

      // Step 4: Apply updates to database using the adapter
      if (updates.length > 0) {
        await this.adapter.updateTaskInstanceStatuses(updates)
        this.log('info', `Updated ${updates.length} instances in database`)
      }

      const executionTime = Date.now() - startTime

      const finalResult: NewStatusUpdateResult = {
        date,
        totalInstances: instancesToProcess.length,
        instancesUpdated,
        instancesSkipped,
        errors,
        results,
        executionTime,
        testMode,
        dryRun
      }

      this.log('info', `Status update completed in ${executionTime}ms`)
      this.log('info', `Results: ${instancesUpdated} updated, ${instancesSkipped} skipped, ${errors} errors`)

      return finalResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      this.log('info', `Status update failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      return {
        date,
        totalInstances: 0,
        instancesUpdated: 0,
        instancesSkipped: 0,
        errors: 1,
        results: [{
          instanceId: 'error',
          masterTaskId: 'error',
          date,
          oldStatus: TaskStatus.PENDING,
          newStatus: TaskStatus.PENDING,
          locked: false,
          updated: false,
          reason: 'Update failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        executionTime,
        testMode,
        dryRun
      }
    }
  }

  /**
   * Run the task generator for a range of dates
   */
  async generateForDateRange(startDate: string, endDate: string, options: Omit<NewGenerationOptions, 'date'> = {}): Promise<NewGenerationResult[]> {
    const results: NewGenerationResult[] = []
    let currentDate = parseAustralianDate(startDate)
    const lastDate = parseAustralianDate(endDate)

    while (currentDate <= lastDate) {
      const dateStr = formatAustralianDate(currentDate)
      const result = await this.generateForDate({ ...options, date: dateStr })
      results.push(result)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return results
  }

  /**
   * Run status updates for a range of dates
   */
  async updateStatusesForDateRange(startDate: string, endDate: string, options: Omit<NewStatusUpdateOptions, 'date'> = {}): Promise<NewStatusUpdateResult[]> {
    const results: NewStatusUpdateResult[] = []
    let currentDate = parseAustralianDate(startDate)
    const lastDate = parseAustralianDate(endDate)

    while (currentDate <= lastDate) {
      const dateStr = formatAustralianDate(currentDate)
      const result = await this.updateStatusesForDate({ ...options, date: dateStr })
      results.push(result)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return results
  }

  /**
   * Create an empty result object for when no tasks are processed
   */
  private createEmptyResult(
    date: string, 
    testMode: boolean, 
    dryRun: boolean, 
    startTime: number, 
    totalTasks: number = 0
  ): NewGenerationResult {
    return {
      date,
      totalTasks,
      tasksProcessed: 0,
      newInstances: 0,
      carryInstances: 0,
      totalInstances: 0,
      instancesSkipped: 0,
      errors: 0,
      results: [],
      executionTime: Date.now() - startTime,
      testMode,
      dryRun
    }
  }

  /**
   * Create an empty status result object
   */
  private createEmptyStatusResult(
    date: string, 
    testMode: boolean, 
    dryRun: boolean, 
    startTime: number
  ): NewStatusUpdateResult {
    return {
      date,
      totalInstances: 0,
      instancesUpdated: 0,
      instancesSkipped: 0,
      errors: 0,
      results: [],
      executionTime: Date.now() - startTime,
      testMode,
      dryRun
    }
  }

  /**
   * Log messages based on the configured log level
   */
  private log(level: 'info' | 'debug', message: string) {
    if (this.logLevel === 'silent') return
    if (this.logLevel === 'info' && level === 'info') {
      console.log(`[INFO] ${message}`)
    }
    if (this.logLevel === 'debug') {
      console.log(`[DEBUG] ${message}`)
    }
  }
}

/**
 * Run the new daily generation job
 */
export async function runNewDailyGeneration(
  date?: string,
  options: Omit<NewGenerationOptions, 'date'> = {}
): Promise<NewGenerationResult> {
  const targetDate = date || getAustralianToday();
  const holidayChecker = await createHolidayChecker();
  const generator = new NewTaskGenerator(holidayChecker, options.logLevel || 'info');

  return await generator.generateForDate({ ...options, date: targetDate });
}

/**
 * Run the new status update job
 */
export async function runNewStatusUpdate(
  options: NewStatusUpdateOptions = {}
): Promise<NewStatusUpdateResult> {
  const generator = new NewTaskGenerator(await createHolidayChecker(), options.logLevel || 'info');
  return await generator.updateStatusesForDate(options);
}

/**
 * Run bulk task generation using system settings for date ranges
 */
export async function runBulkGeneration(
  baseDate?: string,
  options: Omit<NewGenerationOptions, 'date'> = {}
): Promise<NewGenerationResult[]> {
  const targetDate = baseDate || getAustralianToday()
  const settings = await getTaskGenerationSettings()
  
  // Calculate date range based on system settings
  const baseDateObj = parseAustralianDate(targetDate)
  const startDate = new Date(baseDateObj)
  startDate.setDate(startDate.getDate() - settings.daysBehind)
  
  const endDate = new Date(baseDateObj)
  endDate.setDate(endDate.getDate() + settings.daysAhead)
  
  const startDateStr = formatAustralianDate(startDate)
  const endDateStr = formatAustralianDate(endDate)
  
  console.log(`Running bulk generation from ${startDateStr} to ${endDateStr} (${settings.daysBehind} days behind, ${settings.daysAhead} days ahead)`)
  
  const holidayChecker = await createHolidayChecker()
  const generator = new NewTaskGenerator(holidayChecker, options.logLevel || 'info')
  
  return await generator.generateForDateRange(startDateStr, endDateStr, options)
}