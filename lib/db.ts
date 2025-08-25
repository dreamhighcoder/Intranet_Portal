/**
 * Database Helper Functions for Master Checklist System
 * Pharmacy Intranet Portal - Typed Supabase Operations
 * 
 * This module provides type-safe database operations for:
 * - Master Checklist Tasks (CRUD operations)
 * - Checklist Instances (creation and retrieval)
 * - Role-based task filtering
 * - Date-based task queries
 */

import { createClient } from '@supabase/supabase-js'
import type { 
  MasterChecklistTask, 
  ChecklistInstance,
  CreateMasterTaskRequest,
  UpdateMasterTaskRequest,
  CreateChecklistInstanceRequest,
  TaskFilterOptions,
  InstanceFilterOptions,
  PublishStatus,
  ChecklistInstanceStatus
} from '@/types/checklist'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Database row type for master tasks (matches Supabase table structure)
 */
export interface TaskRow {
  id: string
  title: string
  description?: string
  position_id?: string // Legacy field for backward compatibility
  frequency?: string // Legacy enum field for backward compatibility
  frequencies: string[] // New array field for multiple frequencies
  weekdays: number[]
  months: number[]
  timing: string
  due_time?: string
  category?: string // Legacy field for backward compatibility
  categories: string[] // New array field for multiple categories
  publish_status: PublishStatus
  publish_delay_date?: string
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
  created_at: string
  updated_at: string
  responsibility: string[]
  frequency_rules: Record<string, any>
  due_date?: string
  created_by?: string
  updated_by?: string
}

/**
 * Database row type for checklist instances
 */
export interface InstanceRow {
  id: string
  master_task_id: string
  date: string
  role: string
  status: ChecklistInstanceStatus
  completed_by?: string
  completed_at?: string
  payload: Record<string, any>
  notes?: string
  created_at: string
  updated_at: string
}

/**
 * Extended task row with position information
 */
export interface TaskRowWithPosition extends TaskRow {
  positions?: {
    id: string
    name: string
    description: string
  }
}

/**
 * Extended instance row with task information
 */
export interface InstanceRowWithTask extends InstanceRow {
  master_tasks?: {
    id: string
    title: string
    description?: string
    timing: string
    due_time?: string
    responsibility: string[]
    categories: string[]
  }
}

// ========================================
// SUPABASE CLIENT INITIALIZATION
// ========================================

/**
 * Initialize Supabase client with environment variables
 * Use service role key for server-side operations to bypass RLS
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ========================================
// MASTER TASK OPERATIONS
// ========================================

/**
 * Create a new master checklist task
 * 
 * @param taskInput - Task creation data
 * @returns Promise<{ data: TaskRow | null, error: any }>
 * 
 * @example
 * ```typescript
 * const result = await createTask({
 *   title: 'Daily Safety Check',
 *   description: 'Perform daily safety inspection',
 *   responsibility: ['pharmacist-primary'],
 *   categories: ['safety'],
 *   frequency_rules: { type: 'daily', every_n_days: 1 },
 *   timing: 'morning',
 *   publish_status: 'active'
 * })
 * 
 * if (result.error) {
 *   console.error('Failed to create task:', result.error)
 * } else {
 *   console.log('Task created:', result.data)
 * }
 * ```
 */
export async function createTask(
  taskInput: CreateMasterTaskRequest
): Promise<{ data: TaskRow | null; error: any }> {
  try {
    // Convert the new frequency_rules to legacy frequency enum for backward compatibility
    const legacyFrequency = convertFrequencyRulesToLegacy(taskInput.frequency_rules)
    
    const { data, error } = await supabase
      .from('master_tasks')
      .insert({
        title: taskInput.title,
        description: taskInput.description,
        position_id: taskInput.position_id,
        frequency: legacyFrequency, // Legacy field
        weekdays: taskInput.frequency_rules.type === 'specific_weekdays' 
          ? (taskInput.frequency_rules as any).weekdays || []
          : [],
        months: taskInput.frequency_rules.type.includes('month') 
          ? (taskInput.frequency_rules as any).months || []
          : [],
        timing: taskInput.timing,
        due_time: taskInput.due_time,
        category: taskInput.categories?.[0], // Legacy single category
        publish_status: taskInput.publish_status || 'draft',
        publish_delay: taskInput.publish_delay,
        sticky_once_off: taskInput.sticky_once_off || false,
        allow_edit_when_locked: taskInput.allow_edit_when_locked || false,
        responsibility: taskInput.responsibility,
        categories: taskInput.categories,
        frequency_rules: taskInput.frequency_rules,
        due_date: taskInput.due_date,
        created_by: taskInput.created_by,
        updated_by: taskInput.updated_by
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return { data: null, error }
    }

    return { data: data as TaskRow, error: null }
  } catch (error) {
    console.error('Unexpected error creating task:', error)
    return { data: null, error }
  }
}

/**
 * Update an existing master checklist task
 * 
 * @param id - Task ID to update
 * @param taskInput - Partial task update data
 * @returns Promise<{ data: TaskRow | null, error: any }>
 * 
 * @example
 * ```typescript
 * const result = await updateTask('task-uuid', {
 *   title: 'Updated Safety Check',
 *   publish_status: 'inactive'
 * })
 * 
 * if (result.error) {
 *   console.error('Failed to update task:', result.error)
 * } else {
 *   console.log('Task updated:', result.data)
 * }
 * ```
 */
export async function updateTask(
  id: string,
  taskInput: UpdateMasterTaskRequest
): Promise<{ data: TaskRow | null; error: any }> {
  try {
    const updateData: any = { ...taskInput }
    
    // Handle frequency_rules update if provided
    if (taskInput.frequency_rules) {
      updateData.frequency = convertFrequencyRulesToLegacy(taskInput.frequency_rules)
      
      if (taskInput.frequency_rules.type === 'specific_weekdays') {
        updateData.weekdays = (taskInput.frequency_rules as any).weekdays || []
      }
      
      if (taskInput.frequency_rules.type.includes('month')) {
        updateData.months = (taskInput.frequency_rules as any).months || []
      }
    }
    
    // Handle categories update if provided
    if (taskInput.categories) {
      updateData.category = taskInput.categories[0] // Legacy single category
    }
    
    // Set updated_by timestamp
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('master_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return { data: null, error }
    }

    return { data: data as TaskRow, error: null }
  } catch (error) {
    console.error('Unexpected error updating task:', error)
    return { data: null, error }
  }
}

/**
 * Delete a master checklist task
 * 
 * @param id - Task ID to delete
 * @returns Promise<{ error: any }>
 * 
 * @example
 * ```typescript
 * const result = await deleteTask('task-uuid')
 * 
 * if (result.error) {
 *   console.error('Failed to delete task:', result.error)
 * } else {
 *   console.log('Task deleted successfully')
 * }
 * ```
 */
export async function deleteTask(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('master_tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
      return { error }
    }

    return { error: null }
  } catch (error) {
    console.error('Unexpected error deleting task:', error)
    return { error }
  }
}

/**
 * Get a master task by ID
 * 
 * @param id - Task ID to retrieve
 * @returns Promise<{ data: TaskRowWithPosition | null, error: any }>
 * 
 * @example
 * ```typescript
 * const result = await getTaskById('task-uuid')
 * 
 * if (result.error) {
 *   console.error('Failed to get task:', result.error)
 * } else if (result.data) {
 *   console.log('Task:', result.data.title)
 *   console.log('Position:', result.data.positions?.name)
 * }
 * ```
 */
export async function getTaskById(
  id: string
): Promise<{ data: TaskRowWithPosition | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('master_tasks')
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error getting task by ID:', error)
      return { data: null, error }
    }

    return { data: data as TaskRowWithPosition, error: null }
  } catch (error) {
    console.error('Unexpected error getting task by ID:', error)
    return { data: null, error }
  }
}

/**
 * List master tasks with optional filtering
 * 
 * @param filters - Optional filter criteria
 * @returns Promise<{ data: TaskRowWithPosition[], error: any }>
 * 
 * @example
 * ```typescript
 * // Get all active tasks
 * const result = await listTasks({
 *   publish_status: ['active'],
 *   categories: ['safety', 'compliance']
 * })
 * 
 * // Get tasks for specific position
 * const positionTasks = await listTasks({
 *   position_id: 'position-uuid',
 *   limit: 50
 * })
 * 
 * if (result.error) {
 *   console.error('Failed to list tasks:', result.error)
 * } else {
 *   console.log(`Found ${result.data.length} tasks`)
 * }
 * ```
 */
export async function listTasks(
  filters?: TaskFilterOptions
): Promise<{ data: TaskRowWithPosition[]; error: any }> {
  try {
    let query = supabase
      .from('master_tasks')
      .select(`
        *,
        positions (
          id,
          name,
          description
        )
      `)

    // Apply filters
    if (filters?.position_id) {
      query = query.eq('position_id', filters.position_id)
    }

    if (filters?.responsibility && filters.responsibility.length > 0) {
      query = query.overlaps('responsibility', filters.responsibility)
    }

    if (filters?.categories && filters.categories.length > 0) {
      query = query.overlaps('categories', filters.categories)
    }

    if (filters?.publish_status && filters.publish_status.length > 0) {
      query = query.in('publish_status', filters.publish_status)
    }

    if (filters?.frequency_type && filters.frequency_type.length > 0) {
      // Filter by frequency_rules JSONB type field
      const frequencyConditions = filters.frequency_type.map(type => 
        `frequency_rules->>'type'.eq.${type}`
      )
      query = query.or(frequencyConditions.join(','))
    }

    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from)
    }

    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to)
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 100)) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error listing tasks:', error)
      return { data: [], error }
    }

    return { data: data as TaskRowWithPosition[], error: null }
  } catch (error) {
    console.error('Unexpected error listing tasks:', error)
    return { data: [], error }
  }
}

/**
 * Get tasks for a specific role on a specific date
 * Filters by responsibility, publish status, and publish delay
 * 
 * @param role - Role name to filter by
 * @param date - Date string (ISO format) to check
 * @returns Promise<{ data: TaskRowWithPosition[], error: any }>
 * 
 * @example
 * ```typescript
 * const today = new Date().toISOString().split('T')[0]
 * const result = await getTasksForRoleOnDate('pharmacist-primary', today)
 * 
 * if (result.error) {
 *   console.error('Failed to get tasks:', result.error)
 * } else {
 *   console.log(`Found ${result.data.length} tasks for today`)
 *   result.data.forEach(task => {
 *     console.log(`- ${task.title} (${task.timing})`)
 *   })
 * }
 * ```
 */
import { getSearchOptions, filterTasksByResponsibility, toKebabCase } from './responsibility-mapper'

export async function getTasksForRoleOnDate(
  role: string,
  date: string
): Promise<{ data: TaskRowWithPosition[]; error: any }> {
  try {
    // Get all tasks where the role is in the responsibility array
    // Also check that the task is active and respects publish_delay
    
    // Get all possible role variants and shared options to search for
    const searchRoles = getSearchOptions(role);
    console.log(`DEBUG getTasksForRoleOnDate: role='${role}', searchRoles=${JSON.stringify(searchRoles)}, date='${date}'`)
    
    const { data, error } = await supabase
      .from('master_tasks')
      .select('*')
      .overlaps('responsibility', searchRoles)
      .eq('publish_status', 'active')
      .or(`publish_delay.is.null,publish_delay.lte.${date}`)

    if (error) {
      console.error('Error getting tasks for role on date:', error)
      return { data: [], error }
    }
    
    // Filter out tasks that shouldn't be visible to this role using our utility
    const filteredData = filterTasksByResponsibility(data, role);

    return { data: filteredData as TaskRowWithPosition[], error: null }
  } catch (error) {
    console.error('Unexpected error getting tasks for role on date:', error)
    return { data: [], error }
  }
}

// ========================================
// CHECKLIST INSTANCE OPERATIONS
// ========================================

/**
 * Create a new checklist instance
 * 
 * @param instanceInput - Instance creation data
 * @returns Promise<{ data: InstanceRow | null, error: any }>
 * 
 * @example
 * ```typescript
 * const result = await createChecklistInstance({
 *   master_task_id: 'task-uuid',
 *   date: '2024-12-19',
 *   role: 'pharmacist-primary',
 *   status: 'pending'
 * })
 * 
 * if (result.error) {
 *   console.error('Failed to create instance:', result.error)
 * } else {
 *   console.log('Instance created:', result.data)
 * }
 * ```
 */
export async function createChecklistInstance(
  instanceInput: CreateChecklistInstanceRequest
): Promise<{ data: InstanceRow | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('checklist_instances')
      .insert({
        master_task_id: instanceInput.master_task_id,
        date: instanceInput.date,
        role: instanceInput.role,
        status: instanceInput.status || 'pending',
        payload: instanceInput.payload || {},
        notes: instanceInput.notes
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating checklist instance:', error)
      return { data: null, error }
    }

    return { data: data as InstanceRow, error: null }
  } catch (error) {
    console.error('Unexpected error creating checklist instance:', error)
    return { data: null, error }
  }
}

/**
 * Get checklist instances for a specific role on a specific date
 * 
 * @param role - Role name to filter by
 * @param date - Date string (ISO format) to check
 * @returns Promise<{ data: InstanceRowWithTask[], error: any }>
 * 
 * @example
 * ```typescript
 * const today = new Date().toISOString().split('T')[0]
 * const result = await getChecklistInstancesForRole('pharmacist-primary', today)
 * 
 * if (result.error) {
 *   console.error('Failed to get instances:', result.error)
 * } else {
 *   console.log(`Found ${result.data.length} instances for today`)
 *   result.data.forEach(instance => {
 *     console.log(`- ${instance.master_tasks?.title}: ${instance.status}`)
 *   })
 * }
 * ```
 */
export async function getChecklistInstancesForRole(
  role: string,
  date: string
): Promise<{ data: InstanceRowWithTask[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('checklist_instances')
      .select(`
        *,
        master_tasks (
          id,
          title,
          description,
          timing,
          due_time,
          responsibility,
          categories
        )
      `)
      .eq('role', role)
      .eq('date', date)

    if (error) {
      console.error('Error getting checklist instances for role:', error)
      return { data: [], error }
    }

    return { data: data as InstanceRowWithTask[], error: null }
  } catch (error) {
    console.error('Unexpected error getting checklist instances for role:', error)
    return { data: [], error }
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Convert new frequency_rules JSONB to legacy frequency enum
 * Maintains backward compatibility with existing system
 * 
 * @param frequencyRules - New JSONB frequency configuration
 * @returns Legacy frequency enum string
 */
function convertFrequencyRulesToLegacy(frequencyRules: any): string {
  if (!frequencyRules || !frequencyRules.type) {
    return 'every_day' // Default fallback
  }

  switch (frequencyRules.type) {
    case 'daily':
      return 'every_day'
    case 'weekly':
      return 'weekly'
    case 'specific_weekdays':
      return 'specific_weekdays'
    case 'start_of_month':
      return 'start_every_month'
    case 'start_certain_months':
      return 'start_certain_months'
    case 'every_month':
      return 'every_month'
    case 'certain_months':
      return 'certain_months'
    case 'end_of_month':
      return 'end_every_month'
    case 'end_certain_months':
      return 'end_certain_months'
    case 'once_off':
      return 'once_off_sticky'
    case 'once_off_sticky':
      return 'once_off_sticky'
    default:
      return 'every_day'
  }
}

// ========================================
// EXPORTS
// ========================================

export type {
  TaskRow,
  InstanceRow,
  TaskRowWithPosition,
  InstanceRowWithTask
}
