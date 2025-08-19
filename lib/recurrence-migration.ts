/**
 * Recurrence Migration Service
 * Handles migration from old frequency system to new recurrence engine
 */

import { NewFrequencyType, type MasterTask } from './new-recurrence-engine'
import type { MasterChecklistTask } from '@/types/checklist'

// ========================================
// MIGRATION MAPPINGS
// ========================================

/**
 * Map old frequency strings to new frequency types
 */
export const FREQUENCY_MIGRATION_MAP: Record<string, NewFrequencyType> = {
  // Direct mappings
  'once_off': NewFrequencyType.ONCE_OFF,
  'every_day': NewFrequencyType.EVERY_DAY,
  'once_weekly': NewFrequencyType.ONCE_WEEKLY,
  'once_monthly': NewFrequencyType.ONCE_MONTHLY,
  
  // Weekday mappings
  'monday': NewFrequencyType.EVERY_MON,
  'tuesday': NewFrequencyType.EVERY_TUE,
  'wednesday': NewFrequencyType.EVERY_WED,
  'thursday': NewFrequencyType.EVERY_THU,
  'friday': NewFrequencyType.EVERY_FRI,
  'saturday': NewFrequencyType.EVERY_SAT,
  
  // Month-specific mappings (all map to generic types for now)
  'start_of_month_jan': NewFrequencyType.START_OF_MONTH,
  'start_of_month_feb': NewFrequencyType.START_OF_MONTH,
  'start_of_month_mar': NewFrequencyType.START_OF_MONTH,
  'start_of_month_apr': NewFrequencyType.START_OF_MONTH,
  'start_of_month_may': NewFrequencyType.START_OF_MONTH,
  'start_of_month_jun': NewFrequencyType.START_OF_MONTH,
  'start_of_month_jul': NewFrequencyType.START_OF_MONTH,
  'start_of_month_aug': NewFrequencyType.START_OF_MONTH,
  'start_of_month_sep': NewFrequencyType.START_OF_MONTH,
  'start_of_month_oct': NewFrequencyType.START_OF_MONTH,
  'start_of_month_nov': NewFrequencyType.START_OF_MONTH,
  'start_of_month_dec': NewFrequencyType.START_OF_MONTH,
  
  'end_of_month_jan': NewFrequencyType.END_OF_MONTH,
  'end_of_month_feb': NewFrequencyType.END_OF_MONTH,
  'end_of_month_mar': NewFrequencyType.END_OF_MONTH,
  'end_of_month_apr': NewFrequencyType.END_OF_MONTH,
  'end_of_month_may': NewFrequencyType.END_OF_MONTH,
  'end_of_month_jun': NewFrequencyType.END_OF_MONTH,
  'end_of_month_jul': NewFrequencyType.END_OF_MONTH,
  'end_of_month_aug': NewFrequencyType.END_OF_MONTH,
  'end_of_month_sep': NewFrequencyType.END_OF_MONTH,
  'end_of_month_oct': NewFrequencyType.END_OF_MONTH,
  'end_of_month_nov': NewFrequencyType.END_OF_MONTH,
  'end_of_month_dec': NewFrequencyType.END_OF_MONTH
}

/**
 * Default timing mappings based on task timing
 */
export const DEFAULT_TIMING_MAP: Record<string, string> = {
  'opening': '08:00',
  'anytime_during_day': '12:00',
  'before_order_cut_off': '14:00',
  'closing': '17:00'
}

// ========================================
// MIGRATION SERVICE
// ========================================

export class RecurrenceMigrationService {
  
  /**
   * Convert old master task to new format
   */
  convertMasterTask(oldTask: MasterChecklistTask): MasterTask {
    const newFrequency = this.mapFrequency(oldTask.frequency)
    const timing = this.mapTiming(oldTask)
    
    return {
      id: oldTask.id,
      active: oldTask.publish_status === 'active',
      frequency: newFrequency,
      timing: timing,
      publish_at: oldTask.publish_delay || undefined,
      due_date: oldTask.due_date || undefined
    }
  }

  /**
   * Convert multiple master tasks
   */
  convertMasterTasks(oldTasks: MasterChecklistTask[]): MasterTask[] {
    return oldTasks.map(task => this.convertMasterTask(task))
  }

  /**
   * Map old frequency to new frequency type
   */
  private mapFrequency(oldFrequency: string): NewFrequencyType {
    const mapped = FREQUENCY_MIGRATION_MAP[oldFrequency]
    if (!mapped) {
      console.warn(`Unknown frequency type: ${oldFrequency}, defaulting to EVERY_DAY`)
      return NewFrequencyType.EVERY_DAY
    }
    return mapped
  }

  /**
   * Map timing to due time string
   */
  private mapTiming(task: MasterChecklistTask): string {
    // Use explicit due_time if provided
    if (task.due_time) {
      return task.due_time
    }

    // Use timing-based default
    if (task.timing && DEFAULT_TIMING_MAP[task.timing]) {
      return DEFAULT_TIMING_MAP[task.timing]
    }

    // Fallback to 9:00 AM
    return '09:00'
  }

  /**
   * Generate migration report
   */
  generateMigrationReport(oldTasks: MasterChecklistTask[]): {
    total: number
    byFrequency: Record<string, number>
    byNewFrequency: Record<NewFrequencyType, number>
    warnings: string[]
  } {
    const report = {
      total: oldTasks.length,
      byFrequency: {} as Record<string, number>,
      byNewFrequency: {} as Record<NewFrequencyType, number>,
      warnings: [] as string[]
    }

    for (const task of oldTasks) {
      // Count old frequencies
      report.byFrequency[task.frequency] = (report.byFrequency[task.frequency] || 0) + 1

      // Count new frequencies
      const newFreq = this.mapFrequency(task.frequency)
      report.byNewFrequency[newFreq] = (report.byNewFrequency[newFreq] || 0) + 1

      // Check for potential issues
      if (!FREQUENCY_MIGRATION_MAP[task.frequency]) {
        report.warnings.push(`Task ${task.id} (${task.title}) has unknown frequency: ${task.frequency}`)
      }

      if (task.frequency === 'once_off' && !task.due_date) {
        report.warnings.push(`Once-off task ${task.id} (${task.title}) is missing due_date`)
      }

      if (!task.due_time && !task.timing) {
        report.warnings.push(`Task ${task.id} (${task.title}) has no timing information`)
      }
    }

    return report
  }

  /**
   * Validate migration compatibility
   */
  validateMigration(oldTasks: MasterChecklistTask[]): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    }

    for (const task of oldTasks) {
      // Critical errors that would prevent migration
      if (!task.id) {
        result.errors.push(`Task missing ID: ${task.title}`)
        result.isValid = false
      }

      if (!task.frequency) {
        result.errors.push(`Task ${task.id} missing frequency`)
        result.isValid = false
      }

      if (task.frequency === 'once_off' && !task.due_date) {
        result.errors.push(`Once-off task ${task.id} missing required due_date`)
        result.isValid = false
      }

      // Warnings for potential issues
      if (!FREQUENCY_MIGRATION_MAP[task.frequency]) {
        result.warnings.push(`Task ${task.id} has unmapped frequency: ${task.frequency}`)
      }

      if (!task.timing && !task.due_time) {
        result.warnings.push(`Task ${task.id} has no timing information, will use default 09:00`)
      }

      if (task.publish_status === 'draft') {
        result.warnings.push(`Task ${task.id} is in draft status, will be inactive after migration`)
      }
    }

    return result
  }

  /**
   * Create migration SQL for database updates
   */
  generateMigrationSQL(oldTasks: MasterChecklistTask[]): string {
    const sqlStatements: string[] = []

    // Add new columns if they don't exist
    sqlStatements.push(`
-- Add new recurrence engine columns
ALTER TABLE master_tasks 
ADD COLUMN IF NOT EXISTS new_frequency TEXT,
ADD COLUMN IF NOT EXISTS new_timing TEXT,
ADD COLUMN IF NOT EXISTS new_publish_at DATE;
    `)

    // Update each task
    for (const task of oldTasks) {
      const newTask = this.convertMasterTask(task)
      
      sqlStatements.push(`
-- Update task ${task.id}
UPDATE master_tasks 
SET 
  new_frequency = '${newTask.frequency}',
  new_timing = '${newTask.timing}',
  new_publish_at = ${newTask.publish_at ? `'${newTask.publish_at}'` : 'NULL'}
WHERE id = '${task.id}';
      `)
    }

    // Create indexes for new columns
    sqlStatements.push(`
-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_master_tasks_new_frequency ON master_tasks(new_frequency);
CREATE INDEX IF NOT EXISTS idx_master_tasks_new_publish_at ON master_tasks(new_publish_at);
    `)

    return sqlStatements.join('\n')
  }

  /**
   * Create rollback SQL
   */
  generateRollbackSQL(): string {
    return `
-- Rollback migration
ALTER TABLE master_tasks 
DROP COLUMN IF EXISTS new_frequency,
DROP COLUMN IF EXISTS new_timing,
DROP COLUMN IF EXISTS new_publish_at;

DROP INDEX IF EXISTS idx_master_tasks_new_frequency;
DROP INDEX IF EXISTS idx_master_tasks_new_publish_at;
    `
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

export function createMigrationService(): RecurrenceMigrationService {
  return new RecurrenceMigrationService()
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Quick frequency conversion for individual tasks
 */
export function convertFrequency(oldFrequency: string): NewFrequencyType {
  return FREQUENCY_MIGRATION_MAP[oldFrequency] || NewFrequencyType.EVERY_DAY
}

/**
 * Quick timing conversion
 */
export function convertTiming(task: { timing?: string; due_time?: string }): string {
  if (task.due_time) return task.due_time
  if (task.timing && DEFAULT_TIMING_MAP[task.timing]) {
    return DEFAULT_TIMING_MAP[task.timing]
  }
  return '09:00'
}

/**
 * Check if frequency is supported
 */
export function isFrequencySupported(frequency: string): boolean {
  return frequency in FREQUENCY_MIGRATION_MAP
}

/**
 * Get all supported old frequencies
 */
export function getSupportedFrequencies(): string[] {
  return Object.keys(FREQUENCY_MIGRATION_MAP)
}

/**
 * Get frequency mapping statistics
 */
export function getFrequencyMappingStats(): {
  totalMappings: number
  byNewFrequency: Record<NewFrequencyType, string[]>
} {
  const stats = {
    totalMappings: Object.keys(FREQUENCY_MIGRATION_MAP).length,
    byNewFrequency: {} as Record<NewFrequencyType, string[]>
  }

  for (const [oldFreq, newFreq] of Object.entries(FREQUENCY_MIGRATION_MAP)) {
    if (!stats.byNewFrequency[newFreq]) {
      stats.byNewFrequency[newFreq] = []
    }
    stats.byNewFrequency[newFreq].push(oldFreq)
  }

  return stats
}