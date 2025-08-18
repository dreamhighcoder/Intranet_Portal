/**
 * Master Checklist Types and Enums
 * Pharmacy Intranet Portal - Strict TypeScript Definitions
 * 
 * This file contains all types, interfaces, and enums for the Master Checklist system,
 * including the frequency rules JSON schema used by the recurrence engine.
 */

// ========================================
// CORE ENUMS
// ========================================

/**
 * Task publish status - controls task visibility and availability
 */
export enum PublishStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  INACTIVE = 'inactive'
}

/**
 * Task timing - when tasks should be completed
 */
export enum TaskTiming {
  OPENING = 'opening',
  ANYTIME_DURING_DAY = 'anytime_during_day',
  BEFORE_ORDER_CUT_OFF = 'before_order_cut_off',
  CLOSING = 'closing'
}

/**
 * Checklist instance status - tracks completion progress
 */
export enum ChecklistInstanceStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  OVERDUE = 'overdue'
}

/**
 * Frequency types - defines the recurrence pattern
 */
export enum FrequencyType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  SPECIFIC_WEEKDAYS = 'specific_weekdays',
  START_OF_MONTH = 'start_of_month',
  START_CERTAIN_MONTHS = 'start_certain_months',
  EVERY_MONTH = 'every_month',
  CERTAIN_MONTHS = 'certain_months',
  END_OF_MONTH = 'end_of_month',
  END_CERTAIN_MONTHS = 'end_certain_months',
  ONCE_OFF = 'once_off',
  ONCE_OFF_STICKY = 'once_off_sticky'
}

/**
 * Weekday constants (1 = Monday, 7 = Sunday)
 */
export enum Weekday {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7
}

/**
 * Month constants (1-12)
 */
export enum Month {
  JANUARY = 1,
  FEBRUARY = 2,
  MARCH = 3,
  APRIL = 4,
  MAY = 5,
  JUNE = 6,
  JULY = 7,
  AUGUST = 8,
  SEPTEMBER = 9,
  OCTOBER = 10,
  NOVEMBER = 11,
  DECEMBER = 12
}

// ========================================
// FREQUENCY RULES JSON SCHEMA
// ========================================

/**
 * Base frequency rule interface
 */
export interface BaseFrequencyRule {
  type: FrequencyType
  business_days_only?: boolean
  exclude_holidays?: boolean
  start_date?: string // ISO date string
  end_date?: string // ISO date string
}

/**
 * Daily frequency rule
 */
export interface DailyFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.DAILY
  every_n_days: number // Every N days (1 = every day, 2 = every other day, etc.)
}

/**
 * Weekly frequency rule
 */
export interface WeeklyFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.WEEKLY
  every_n_weeks: number // Every N weeks (1 = every week, 2 = every other week, etc.)
  start_day?: Weekday // Which day of week to start on
}

/**
 * Specific weekdays frequency rule
 */
export interface SpecificWeekdaysFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.SPECIFIC_WEEKDAYS
  weekdays: Weekday[] // Array of specific weekdays
  every_n_weeks?: number // Optional: every N weeks
}

/**
 * Start of month frequency rule
 */
export interface StartOfMonthFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.START_OF_MONTH
  every_n_months?: number // Every N months (1 = every month, 3 = quarterly, etc.)
  months?: Month[] // Specific months only
  day_offset?: number // Days from start of month (0 = 1st, 1 = 2nd, etc.)
}

/**
 * Start certain months frequency rule
 */
export interface StartCertainMonthsFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.START_CERTAIN_MONTHS
  months: Month[] // Specific months only
  day_offset?: number // Days from start of month
}

/**
 * Every month frequency rule
 */
export interface EveryMonthFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.EVERY_MONTH
  every_n_months?: number // Every N months
  day_offset?: number // Days from start of month
}

/**
 * Certain months frequency rule
 */
export interface CertainMonthsFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.CERTAIN_MONTHS
  months: Month[] // Specific months only
  day_offset?: number // Days from start of month
}

/**
 * End of month frequency rule
 */
export interface EndOfMonthFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.END_OF_MONTH
  every_n_months?: number // Every N months
  days_from_end?: number // Days from end of month (0 = last day, 1 = second to last, etc.)
}

/**
 * End certain months frequency rule
 */
export interface EndCertainMonthsFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.END_CERTAIN_MONTHS
  months: Month[] // Specific months only
  days_from_end?: number // Days from end of month
}

/**
 * Once-off frequency rule
 */
export interface OnceOffFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.ONCE_OFF
  due_date: string // ISO date string
}

/**
 * Once-off sticky frequency rule
 */
export interface OnceOffStickyFrequencyRule extends BaseFrequencyRule {
  type: FrequencyType.ONCE_OFF_STICKY
  due_date?: string // Optional initial due date
}

/**
 * Union type for all frequency rules
 */
export type FrequencyRule =
  | DailyFrequencyRule
  | WeeklyFrequencyRule
  | SpecificWeekdaysFrequencyRule
  | StartOfMonthFrequencyRule
  | StartCertainMonthsFrequencyRule
  | EveryMonthFrequencyRule
  | CertainMonthsFrequencyRule
  | EndOfMonthFrequencyRule
  | EndCertainMonthsFrequencyRule
  | OnceOffFrequencyRule
  | OnceOffStickyFrequencyRule

// ========================================
// CORE INTERFACES
// ========================================

/**
 * Master Checklist Task - the template for recurring tasks
 */
export interface MasterChecklistTask {
  id: string
  title: string
  description: string
  position_id?: string // Legacy field for backward compatibility
  responsibility: string[] // Multi-select array of role names responsible for this task
  categories: string[] // Multi-select array of category tags
  frequency: string // Simplified frequency (once_off, every_day, once_weekly, monday, etc.)
  timing: TaskTiming // Task timing (opening, anytime_during_day, before_order_cut_off, closing)
  due_date?: string // ISO date string - manually entered for once-off tasks, auto-calculated for recurring
  due_time?: string // HH:MM format - auto-filled based on timing or manually set
  publish_status: PublishStatus // Active, Inactive, Draft
  publish_delay?: string // ISO date string - tasks remain hidden until this date
  start_date?: string // ISO date string
  end_date?: string // ISO date string
  sticky_once_off?: boolean
  allow_edit_when_locked?: boolean
  created_by?: string // UUID of user who created the task
  updated_by?: string // UUID of user who last updated the task
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  
  // Legacy fields for backward compatibility
  frequency_rules?: FrequencyRule // JSONB frequency configuration (legacy)
  category?: string // Single category (legacy)
  
  // Optional relations
  positions?: Position
  created_by_user?: UserProfile
  updated_by_user?: UserProfile
}

/**
 * Checklist Instance - individual occurrence of a master task
 */
export interface ChecklistInstance {
  id: string
  master_task_id: string
  date: string // ISO date string
  role: string // Role name responsible for this instance
  status: ChecklistInstanceStatus
  completed_by?: string // UUID of user who completed the task
  completed_at?: string // ISO timestamp
  payload: Record<string, any> // JSONB for additional data
  notes?: string
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  
  // Optional relations
  master_task?: MasterChecklistTask
  completed_by_user?: UserProfile
}

/**
 * Position - staff role definition
 */
export interface Position {
  id: string
  name: string
  description: string
  password_hash?: string
  is_super_admin?: boolean
  created_at: string
  updated_at: string
}

/**
 * User Profile - extended user information
 */
export interface UserProfile {
  id: string
  email?: string
  display_name?: string
  position_id?: string
  role: 'admin' | 'viewer'
  created_at: string
  updated_at: string
  last_login?: string
  positions?: Position
}

// ========================================
// EXTENDED INTERFACES
// ========================================

/**
 * Master Task with extended information
 */
export interface MasterChecklistTaskWithDetails extends MasterChecklistTask {
  position: Position
  instances?: ChecklistInstance[]
  recent_instances?: ChecklistInstance[]
  completion_stats?: TaskCompletionStats
}

/**
 * Checklist Instance with extended information
 */
export interface ChecklistInstanceWithDetails extends ChecklistInstance {
  master_task: MasterChecklistTask
  position: Position
  audit_logs?: AuditLog[]
}

/**
 * Task completion statistics
 */
export interface TaskCompletionStats {
  total_instances: number
  completed_instances: number
  pending_instances: number
  overdue_instances: number
  completion_rate: number
  average_completion_time?: string
  last_completed?: string
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string
  task_instance_id: string
  user_id: string
  action: 'created' | 'completed' | 'uncompleted' | 'status_changed' | 'locked' | 'unlocked' | 'acknowledged' | 'resolved'
  old_values?: Record<string, any>
  new_values?: Record<string, any>
  metadata?: Record<string, any>
  created_at: string
  user_profiles?: {
    display_name?: string
    positions?: {
      name: string
    }
  }
  task_instances?: {
    id: string
    master_tasks?: {
      title: string
    }
  }
}

// ========================================
// REQUEST/RESPONSE INTERFACES
// ========================================

/**
 * Create master task request
 */
export interface CreateMasterTaskRequest {
  title: string
  description: string
  responsibility: string[] // Multi-select array of responsibilities
  categories: string[] // Multi-select array of categories
  frequency: string // Simplified frequency value
  timing: TaskTiming
  due_date?: string // For once-off tasks only
  due_time?: string // Auto-filled based on timing
  publish_status?: PublishStatus
  publish_delay?: string // Publishing delay date
  start_date?: string
  end_date?: string
  sticky_once_off?: boolean
  allow_edit_when_locked?: boolean
}

/**
 * Update master task request
 */
export interface UpdateMasterTaskRequest extends Partial<CreateMasterTaskRequest> {
  id: string
}

/**
 * Create checklist instance request
 */
export interface CreateChecklistInstanceRequest {
  master_task_id: string
  date: string
  role: string
  status?: ChecklistInstanceStatus
  payload?: Record<string, any>
  notes?: string
}

/**
 * Update checklist instance request
 */
export interface UpdateChecklistInstanceRequest extends Partial<CreateChecklistInstanceRequest> {
  id: string
  status?: ChecklistInstanceStatus
  completed_by?: string
  completed_at?: string
}

/**
 * Filter options for querying tasks
 */
export interface TaskFilterOptions {
  position_id?: string
  responsibility?: string[]
  categories?: string[]
  publish_status?: PublishStatus[]
  frequency_type?: FrequencyType[]
  date_from?: string
  date_to?: string
  search?: string
  limit?: number
  offset?: number
}

/**
 * Filter options for querying instances
 */
export interface InstanceFilterOptions {
  master_task_id?: string
  role?: string
  status?: ChecklistInstanceStatus[]
  date_from?: string
  date_to?: string
  completed_by?: string
  limit?: number
  offset?: number
}

// ========================================
// UTILITY TYPES
// ========================================

/**
 * Type guard for frequency rules
 */
export function isFrequencyRule(obj: any): obj is FrequencyRule {
  return obj && typeof obj === 'object' && 'type' in obj
}

/**
 * Type guard for specific frequency types
 */
export function isDailyFrequencyRule(rule: FrequencyRule): rule is DailyFrequencyRule {
  return rule.type === FrequencyType.DAILY
}

export function isWeeklyFrequencyRule(rule: FrequencyRule): rule is WeeklyFrequencyRule {
  return rule.type === FrequencyType.WEEKLY
}

export function isSpecificWeekdaysFrequencyRule(rule: FrequencyRule): rule is SpecificWeekdaysFrequencyRule {
  return rule.type === FrequencyType.SPECIFIC_WEEKDAYS
}

export function isStartOfMonthFrequencyRule(rule: FrequencyRule): rule is StartOfMonthFrequencyRule {
  return rule.type === FrequencyType.START_OF_MONTH
}

export function isOnceOffFrequencyRule(rule: FrequencyRule): rule is OnceOffFrequencyRule {
  return rule.type === FrequencyType.ONCE_OFF
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default values for new tasks
 */
export const DEFAULT_TASK_VALUES = {
  publish_status: PublishStatus.DRAFT,
  timing: TaskTiming.MORNING,
  due_time: '09:00:00',
  sticky_once_off: false,
  allow_edit_when_locked: false,
  responsibility: [],
  categories: [],
  frequency_rules: {
    type: FrequencyType.DAILY,
    every_n_days: 1,
    business_days_only: true
  } as DailyFrequencyRule
}

/**
 * Common category tags
 */
export const COMMON_CATEGORIES = [
  'safety',
  'compliance',
  'inventory',
  'controlled-substances',
  'documentation',
  'equipment',
  'maintenance',
  'customer-service',
  'quality-control',
  'training',
  'emergency',
  'routine'
] as const

/**
 * Common responsibility roles
 */
export const COMMON_ROLES = [
  'pharmacist-primary',
  'pharmacist-supporting',
  'pharmacy-assistants',
  'dispensary-technicians',
  'daa-packers',
  'operational-managerial'
] as const




