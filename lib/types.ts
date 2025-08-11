// Database types for Pharmacy Intranet Portal

export interface User {
  id: string
  email: string
  display_name: string
  position_id: string
  role: "admin" | "user"
  created_at: string
  last_login?: string
}

export interface Position {
  id: string
  name: string
  description: string
  created_at: string
}

export interface MasterTask {
  id: string
  title: string
  description: string
  position_id: string
  frequency:
    | "once_off"
    | "daily"
    | "weekly_monday"
    | "weekly_tuesday"
    | "weekly_wednesday"
    | "weekly_thursday"
    | "weekly_friday"
    | "weekly_saturday"
    | "weekly_sunday"
    | "start_of_month"
    | "end_of_month"
  timing: "morning" | "before_close" | "custom"
  default_due_time: string // HH:MM format
  category: string
  publish_status: "active" | "draft" | "inactive"
  publish_delay_date?: string
  sticky_once_off: boolean
  allow_edit_when_locked: boolean
  created_at: string
  updated_at: string
}

export interface TaskInstance {
  id: string
  master_task_id: string
  position_id: string
  due_date: string
  due_time: string
  appearance_date: string
  status: "not_due" | "due_today" | "overdue" | "missed" | "done"
  completed_at?: string
  completed_by?: string
  created_at: string
}

export interface TaskAuditLog {
  id: string
  task_instance_id: string
  actor: string
  action: "created" | "completed" | "uncompleted" | "status_changed"
  notes?: string
  timestamp: string
}

export interface PublicHoliday {
  id: string
  date: string
  name: string
  region: string
  source: string
  created_at: string
}

export interface SystemSettings {
  id: string
  timezone: string
  new_since_hour: string // HH:MM format
  missed_cutoff_time: string // HH:MM format
  updated_at: string
}

// UI Types
export interface TaskWithDetails extends TaskInstance {
  master_task: MasterTask
  position: Position
  audit_logs?: TaskAuditLog[]
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

export type TaskStatus = "not_due" | "due_today" | "overdue" | "missed" | "done"
export type UserRole = "admin" | "user"
export type TaskFrequency =
  | "once_off"
  | "daily"
  | "weekly_monday"
  | "weekly_tuesday"
  | "weekly_wednesday"
  | "weekly_thursday"
  | "weekly_friday"
  | "weekly_saturday"
  | "weekly_sunday"
  | "start_of_month"
  | "end_of_month"
export type TaskTiming = "morning" | "before_close" | "custom"
export type PublishStatus = "active" | "draft" | "inactive"
