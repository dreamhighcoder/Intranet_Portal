// Mock data for development and testing
import type { User, Position, MasterTask, TaskInstance, PublicHoliday, SystemSettings, DashboardStats } from "./types"

export const mockPositions: Position[] = [
  {
    id: "1",
    name: "Pharmacist",
    description: "Licensed pharmacist responsible for dispensing and clinical duties",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "Pharmacy Assistant",
    description: "Assists with dispensing and customer service",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "3",
    name: "Manager",
    description: "Pharmacy manager overseeing operations",
    created_at: "2024-01-01T00:00:00Z",
  },
]

export const mockUsers: User[] = [
  {
    id: "1",
    email: "admin@pharmacy.com",
    display_name: "Sarah Johnson",
    position_id: "3",
    role: "admin",
    created_at: "2024-01-01T00:00:00Z",
    last_login: "2024-01-15T09:30:00Z",
  },
  {
    id: "2",
    email: "pharmacist@pharmacy.com",
    display_name: "Dr. Michael Chen",
    position_id: "1",
    role: "user",
    created_at: "2024-01-01T00:00:00Z",
    last_login: "2024-01-15T08:45:00Z",
  },
]

export const mockMasterTasks: MasterTask[] = [
  {
    id: "1",
    title: "Check refrigerator temperature",
    description: "Record and verify refrigerator temperature is between 2-8°C",
    position_id: "2",
    frequency: "daily",
    timing: "morning",
    default_due_time: "09:00",
    category: "Compliance",
    publish_status: "active",
    sticky_once_off: false,
    allow_edit_when_locked: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    title: "Controlled drugs register check",
    description: "Verify controlled drugs register is up to date and secure",
    position_id: "1",
    frequency: "daily",
    timing: "before_close",
    default_due_time: "17:00",
    category: "Security",
    publish_status: "active",
    sticky_once_off: false,
    allow_edit_when_locked: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "3",
    title: "Monthly stock audit",
    description: "Complete monthly stock audit for high-value items",
    position_id: "3",
    frequency: "start_of_month",
    timing: "custom",
    default_due_time: "14:00",
    category: "Inventory",
    publish_status: "active",
    sticky_once_off: false,
    allow_edit_when_locked: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
]

export const mockTaskInstances: TaskInstance[] = [
  {
    id: "1",
    master_task_id: "1",
    position_id: "2",
    due_date: "2024-01-15",
    due_time: "09:00",
    appearance_date: "2024-01-15",
    status: "due_today",
    created_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "2",
    master_task_id: "2",
    position_id: "1",
    due_date: "2024-01-15",
    due_time: "17:00",
    appearance_date: "2024-01-15",
    status: "not_due",
    created_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "3",
    master_task_id: "1",
    position_id: "2",
    due_date: "2024-01-14",
    due_time: "09:00",
    appearance_date: "2024-01-14",
    status: "done",
    completed_at: "2024-01-14T09:15:00Z",
    completed_by: "Pharmacy Assistant",
    created_at: "2024-01-14T00:00:00Z",
  },
]

export const mockPublicHolidays: PublicHoliday[] = [
  {
    id: "1",
    date: "2024-01-26",
    name: "Australia Day",
    region: "National",
    source: "Manual",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    date: "2024-04-25",
    name: "ANZAC Day",
    region: "National",
    source: "Manual",
    created_at: "2024-01-01T00:00:00Z",
  },
]

export const mockSystemSettings: SystemSettings = {
  id: "1",
  timezone: "Australia/Sydney",
  new_since_hour: "09:00",
  missed_cutoff_time: "23:59",
  updated_at: "2024-01-01T00:00:00Z",
}

export const mockDashboardStats: DashboardStats = {
  new_since_9am: 3,
  due_today: 5,
  overdue: 1,
  missed: 2,
  on_time_completion_rate: 87.5,
  avg_time_to_complete: "02:15",
  missed_last_7_days: 8,
  tasks_created_this_month: 45,
}
