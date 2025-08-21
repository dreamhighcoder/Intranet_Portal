import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a singleton Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Database Types
export type Database = {
  public: {
    Tables: {
      positions: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      master_tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          position_id: string | null
          frequency: 'once_off_sticky' | 'every_day' | 'weekly' | 'specific_weekdays' | 'start_every_month' | 'start_certain_months' | 'every_month' | 'certain_months' | 'end_every_month' | 'end_certain_months'
          weekdays: number[]
          months: number[]
          timing: string | null
          default_due_time: string | null
          categories: string[]
          publish_status: 'draft' | 'active' | 'inactive'
          publish_delay_date: string | null
          sticky_once_off: boolean
          allow_edit_when_locked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          position_id?: string | null
          frequency: 'once_off_sticky' | 'every_day' | 'weekly' | 'specific_weekdays' | 'start_every_month' | 'start_certain_months' | 'every_month' | 'certain_months' | 'end_every_month' | 'end_certain_months'
          weekdays?: number[]
          months?: number[]
          timing?: string | null
          default_due_time?: string | null
          categories?: string[]
          publish_status?: 'draft' | 'active' | 'inactive'
          publish_delay_date?: string | null
          sticky_once_off?: boolean
          allow_edit_when_locked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          position_id?: string | null
          frequency?: 'once_off_sticky' | 'every_day' | 'weekly' | 'specific_weekdays' | 'start_every_month' | 'start_certain_months' | 'every_month' | 'certain_months' | 'end_every_month' | 'end_certain_months'
          weekdays?: number[]
          months?: number[]
          timing?: string | null
          default_due_time?: string | null
          categories?: string[]
          publish_status?: 'draft' | 'active' | 'inactive'
          publish_delay_date?: string | null
          sticky_once_off?: boolean
          allow_edit_when_locked?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      task_instances: {
        Row: {
          id: string
          master_task_id: string | null
          instance_date: string
          due_date: string
          due_time: string
          status: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done'
          is_published: boolean
          completed_at: string | null
          completed_by: string | null
          locked: boolean
          acknowledged: boolean
          resolved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          master_task_id?: string | null
          instance_date: string
          due_date: string
          due_time: string
          status?: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done'
          is_published?: boolean
          completed_at?: string | null
          completed_by?: string | null
          locked?: boolean
          acknowledged?: boolean
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          master_task_id?: string | null
          instance_date?: string
          due_date?: string
          due_time?: string
          status?: 'not_due' | 'due_today' | 'overdue' | 'missed' | 'done'
          is_published?: boolean
          completed_at?: string | null
          completed_by?: string | null
          locked?: boolean
          acknowledged?: boolean
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      public_holidays: {
        Row: {
          date: string
          name: string
          region: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          date: string
          name: string
          region?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          date?: string
          name?: string
          region?: string | null
          source?: string | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          task_instance_id: string | null
          action: string
          actor: string | null
          meta: any
          created_at: string
        }
        Insert: {
          id?: string
          task_instance_id?: string | null
          action: string
          actor?: string | null
          meta?: any
          created_at?: string
        }
        Update: {
          id?: string
          task_instance_id?: string | null
          action?: string
          actor?: string | null
          meta?: any
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          position_id: string | null
          role: 'admin' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          position_id?: string | null
          role?: 'admin' | 'viewer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          position_id?: string | null
          role?: 'admin' | 'viewer'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Position = Database['public']['Tables']['positions']['Row']
export type MasterTask = Database['public']['Tables']['master_tasks']['Row']
export type TaskInstance = Database['public']['Tables']['task_instances']['Row']
export type PublicHoliday = Database['public']['Tables']['public_holidays']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']