// Database types for Pharmacy Intranet Portal

export interface User {
  id: string
  email: string
  display_name?: string
  position_id?: string
  role: "admin" | "viewer"
  created_at: string
  last_login?: string
}

export interface UserProfile {
  id: string
  email?: string
  display_name?: string
  position_id?: string
  role: "admin" | "viewer"
  created_at: string
  updated_at: string
  last_login?: string
  positions?: Position
}

export interface Position {
  id: string
  name: string
  description: string
  password_hash?: string
  is_super_admin?: boolean
  created_at: string
  updated_at: string
}

export interface MasterTask {
  id: string
  title: string
  description?: string
  position_id?: string
  frequency:
    | "once_off_sticky"
    | "every_day"
    | "weekly"
    | "specific_weekdays"
    | "start_every_month"
    | "start_certain_months"
    | "every_month"
    | "certain_months"
    | "end_every_month"
    | "end_certain_months"
  weekdays: number[] // For specific_weekdays frequency (1=Monday, 7=Sunday)
  months: number[] // For month-specific frequencies (1-12)
  timing?: string
  default_due_time?: string // HH:MM format
  due_time?: string // HH:MM format (new field)
  category?: string // Legacy single category field
  categories?: string[] // New multiple categories field
  responsibility?: string[] // New multiple responsibilities field
  frequency_rules?: any // JSONB frequency rules
  due_date?: string // ISO date string for once-off tasks
  publish_status: "active" | "draft" | "inactive"
  publish_delay_date?: string
  publish_delay?: string // New field
  start_date?: string // ISO date string
  end_date?: string // ISO date string
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
  created_by?: string // UUID of user who created the task
  updated_by?: string // UUID of user who last updated the task
  created_at: string
  updated_at: string
  positions?: Position
}

export interface TaskInstance {
  id: string
  master_task_id?: string
  instance_date: string
  due_date: string
  due_time: string
  status: "not_due" | "due_today" | "overdue" | "missed" | "done"
  is_published: boolean
  completed_at?: string
  completed_by?: string
  locked: boolean
  acknowledged: boolean
  resolved: boolean
  created_at: string
  updated_at: string
  master_tasks?: MasterTask
}

export interface AuditLog {
  id: string
  task_instance_id: string
  user_id: string
  action: "created" | "completed" | "uncompleted" | "status_changed" | "locked" | "unlocked" | "acknowledged" | "resolved"
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

export interface PublicHoliday {
  date: string
  name: string
  region?: string
  source?: string
  created_at: string
}

export interface SystemSettings {
  id: string
  key: string
  value: string
  description?: string
  created_at: string
  updated_at: string
}

export interface SystemConfig {
  timezone: string
  new_since_hour: string // HH:MM format
  missed_cutoff_time: string // HH:MM format
  auto_logout_enabled: boolean
  auto_logout_delay_minutes: number
  task_generation_days_ahead: number
  task_generation_days_behind: number
  default_due_time: string // HH:MM format
  working_days: string[]
  public_holiday_push_forward: boolean
}

// UI Types
export interface TaskWithDetails extends TaskInstance {
  master_task: MasterTask
  position: Position
  audit_logs?: AuditLog[]
}

export interface DashboardStats {
  new_since_9am: number
  due_today: number
  overdue: number
  missed: number
  on_time_completion_rate: number
  avg_time_to_complete: string
  missed_last_7_days: number
  tasks_created_this_month: number
}

export type PositionType =
  | "administrator"
  | "pharmacist-primary"
  | "pharmacist-supporting"
  | "pharmacy-assistants"
  | "dispensary-technicians"
  | "daa-packers"
  | "operational-managerial"

export interface PositionAuth {
  id: string
  name: string
  displayName: string
  password: string
  role: "admin" | "viewer"
}

export type TaskStatus = "not_due" | "due_today" | "overdue" | "missed" | "done"
export type UserRole = "admin" | "viewer"

export type TaskFrequency =
  | "once_off_sticky"
  | "every_day"
  | "weekly"
  | "specific_weekdays"
  | "start_every_month"
  | "start_certain_months"
  | "every_month"
  | "certain_months"
  | "end_every_month"
  | "end_certain_months"

export type TaskTiming = "morning" | "before_close" | "custom"
export type PublishStatus = "active" | "draft" | "inactive"

export interface OutstandingTask extends TaskWithDetails {
  follow_up_notes?: string
}
