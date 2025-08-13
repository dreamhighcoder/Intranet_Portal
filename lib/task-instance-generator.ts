/**
 * Task Instance Generator
 * Generates task instances from master tasks using the recurrence engine
 */

import { supabase } from './supabase'
import { RecurrenceEngine, createRecurrenceEngine, type TaskInstanceData } from './recurrence-engine'
import type { MasterTask, TaskInstance } from './supabase'

export interface GenerationOptions {
  startDate?: Date
  endDate?: Date
  masterTaskId?: string
  forceRegenerate?: boolean
}

export interface GenerationResult {
  success: boolean
  generated: number
  skipped: number
  errors: number
  message: string
}

/**
 * Main Task Instance Generator class
 */
export class TaskInstanceGenerator {
  private recurrenceEngine: RecurrenceEngine | null = null

  constructor() {}

  /**
   * Initialize the generator with current public holidays
   */
  async initialize(): Promise<void> {
    this.recurrenceEngine = await createRecurrenceEngine()
  }

  /**
   * Generate task instances for all active master tasks or a specific master task
   */
  async generateInstances(options: GenerationOptions = {}): Promise<GenerationResult> {
    if (!this.recurrenceEngine) {
      await this.initialize()
    }

    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // -30 days
      endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),  // +365 days
      masterTaskId,
      forceRegenerate = false
    } = options

    try {
      // Get master tasks to process
      const masterTasks = await this.getMasterTasks(masterTaskId)
      
      if (masterTasks.length === 0) {
        return {
          success: false,
          generated: 0,
          skipped: 0,
          errors: 0,
          message: 'No active master tasks found'
        }
      }

      let totalGenerated = 0
      let totalSkipped = 0
      let totalErrors = 0

      // Process each master task
      for (const masterTask of masterTasks) {
        try {
          const result = await this.generateInstancesForMasterTask(
            masterTask,
            startDate,
            endDate,
            forceRegenerate
          )
          
          totalGenerated += result.generated
          totalSkipped += result.skipped
          totalErrors += result.errors

          console.log(`Generated ${result.generated} instances for task: ${masterTask.title}`)
        } catch (error) {
          console.error(`Error generating instances for task ${masterTask.title}:`, error)
          totalErrors++
        }
      }

      return {
        success: totalErrors === 0,
        generated: totalGenerated,
        skipped: totalSkipped,
        errors: totalErrors,
        message: `Generated ${totalGenerated} task instances, skipped ${totalSkipped}, ${totalErrors} errors`
      }

    } catch (error) {
      console.error('Error in generateInstances:', error)
      return {
        success: false,
        generated: 0,
        skipped: 0,
        errors: 1,
        message: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Generate instances for a specific master task
   */
  private async generateInstancesForMasterTask(
    masterTask: MasterTask,
    startDate: Date,
    endDate: Date,
    forceRegenerate: boolean
  ): Promise<{ generated: number; skipped: number; errors: number }> {
    if (!this.recurrenceEngine) {
      throw new Error('Recurrence engine not initialized')
    }

    // Get public holidays for the recurrence engine
    const { data: publicHolidays = [] } = await supabase
      .from('public_holidays')
      .select('*')

    // Generate potential instances using recurrence engine
    const potentialInstances = this.recurrenceEngine.generateInstances({
      masterTask,
      startDate,
      endDate,
      publicHolidays
    })

    if (potentialInstances.length === 0) {
      return { generated: 0, skipped: 0, errors: 0 }
    }

    // Check which instances already exist
    const existingInstances = await this.getExistingInstances(
      masterTask.id,
      potentialInstances.map(i => i.instance_date)
    )

    const existingDates = new Set(existingInstances.map(i => i.instance_date))
    
    // Filter out existing instances unless forcing regeneration
    const instancesToCreate = forceRegenerate
      ? potentialInstances
      : potentialInstances.filter(i => !existingDates.has(i.instance_date))

    if (instancesToCreate.length === 0) {
      return { 
        generated: 0, 
        skipped: potentialInstances.length, 
        errors: 0 
      }
    }

    // If force regenerating, delete existing instances first
    if (forceRegenerate && existingInstances.length > 0) {
      await this.deleteExistingInstances(masterTask.id, potentialInstances.map(i => i.instance_date))
    }

    // Insert new instances in batches
    const batchSize = 100
    let generated = 0
    let errors = 0

    for (let i = 0; i < instancesToCreate.length; i += batchSize) {
      const batch = instancesToCreate.slice(i, i + batchSize)
      
      try {
        const { error } = await supabase
          .from('task_instances')
          .insert(batch)

        if (error) {
          console.error('Batch insert error:', error)
          errors += batch.length
        } else {
          generated += batch.length
        }
      } catch (error) {
        console.error('Batch insert exception:', error)
        errors += batch.length
      }
    }

    return {
      generated,
      skipped: potentialInstances.length - instancesToCreate.length,
      errors
    }
  }

  /**
   * Get master tasks to process
   */
  private async getMasterTasks(masterTaskId?: string): Promise<MasterTask[]> {
    let query = supabase
      .from('master_tasks')
      .select('*')
      .eq('publish_status', 'active')

    if (masterTaskId) {
      query = query.eq('id', masterTaskId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching master tasks:', error)
      return []
    }

    // Filter by publish_delay_date if set
    const now = new Date()
    const filteredTasks = (data || []).filter(task => {
      if (!task.publish_delay_date) return true
      return new Date(task.publish_delay_date) <= now
    })

    return filteredTasks
  }

  /**
   * Get existing task instances for a master task and date range
   */
  private async getExistingInstances(
    masterTaskId: string,
    dates: string[]
  ): Promise<TaskInstance[]> {
    if (dates.length === 0) return []

    const { data, error } = await supabase
      .from('task_instances')
      .select('*')
      .eq('master_task_id', masterTaskId)
      .in('instance_date', dates)

    if (error) {
      console.error('Error fetching existing instances:', error)
      return []
    }

    return data || []
  }

  /**
   * Delete existing instances for regeneration
   */
  private async deleteExistingInstances(
    masterTaskId: string,
    dates: string[]
  ): Promise<void> {
    if (dates.length === 0) return

    const { error } = await supabase
      .from('task_instances')
      .delete()
      .eq('master_task_id', masterTaskId)
      .in('instance_date', dates)
      .eq('status', 'not_due') // Only delete instances that haven't been worked on

    if (error) {
      console.error('Error deleting existing instances:', error)
      throw error
    }
  }

  /**
   * Clean up old instances beyond the date range
   */
  async cleanupOldInstances(cutoffDate: Date): Promise<number> {
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('task_instances')
      .delete()
      .lt('instance_date', cutoffDateStr)
      .eq('status', 'not_due') // Only delete unworked instances

    if (error) {
      console.error('Error cleaning up old instances:', error)
      return 0
    }

    return data?.length || 0
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(): Promise<{
    totalInstances: number
    instancesByStatus: Record<string, number>
    oldestInstance: string | null
    newestInstance: string | null
  }> {
    const { data: totalData } = await supabase
      .from('task_instances')
      .select('id', { count: 'exact' })

    const { data: statusData } = await supabase
      .from('task_instances')
      .select('status')

    const { data: dateRangeData } = await supabase
      .from('task_instances')
      .select('instance_date')
      .order('instance_date', { ascending: true })
      .limit(1)

    const { data: dateRangeDataMax } = await supabase
      .from('task_instances')
      .select('instance_date')
      .order('instance_date', { ascending: false })
      .limit(1)

    const instancesByStatus: Record<string, number> = {}
    statusData?.forEach(item => {
      instancesByStatus[item.status] = (instancesByStatus[item.status] || 0) + 1
    })

    return {
      totalInstances: totalData?.length || 0,
      instancesByStatus,
      oldestInstance: dateRangeData?.[0]?.instance_date || null,
      newestInstance: dateRangeDataMax?.[0]?.instance_date || null
    }
  }
}

/**
 * Convenience function to generate instances
 */
export async function generateTaskInstances(options: GenerationOptions = {}): Promise<GenerationResult> {
  const generator = new TaskInstanceGenerator()
  return await generator.generateInstances(options)
}

/**
 * Convenience function to generate instances for a specific master task
 */
export async function generateInstancesForTask(masterTaskId: string): Promise<GenerationResult> {
  return await generateTaskInstances({ masterTaskId })
}

/**
 * Daily generation job - call this from a cron job or scheduled function
 */
export async function runDailyGeneration(): Promise<GenerationResult> {
  console.log('Starting daily task instance generation...')
  
  const result = await generateTaskInstances({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // Look back 7 days for any missed
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),  // Generate 1 year ahead
    forceRegenerate: false
  })
  
  console.log('Daily generation completed:', result.message)
  return result
}