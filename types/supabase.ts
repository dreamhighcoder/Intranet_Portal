export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      master_tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          position_id: string | null
          frequency: string
          weekdays: number[] | null
          months: number[] | null
          timing: string
          due_time: string | null
          category: string | null
          publish_status: string
          publish_delay: string | null
          sticky_once_off: boolean
          allow_edit_when_locked: boolean
          created_at: string
          updated_at: string
          responsibility: string[]
          categories: string[]
          frequency_rules: Json
          due_date: string | null
          created_by: string | null
          updated_by: string | null
          start_date: string | null
          end_date: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          position_id?: string | null
          frequency: string
          weekdays?: number[] | null
          months?: number[] | null
          timing: string
          due_time?: string | null
          category?: string | null
          publish_status: string
          publish_delay?: string | null
          sticky_once_off?: boolean
          allow_edit_when_locked?: boolean
          created_at?: string
          updated_at?: string
          responsibility: string[]
          categories: string[]
          frequency_rules: Json
          due_date?: string | null
          created_by?: string | null
          updated_by?: string | null
          start_date?: string | null
          end_date?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          position_id?: string | null
          frequency?: string
          weekdays?: number[] | null
          months?: number[] | null
          timing?: string
          due_time?: string | null
          category?: string | null
          publish_status?: string
          publish_delay?: string | null
          sticky_once_off?: boolean
          allow_edit_when_locked?: boolean
          created_at?: string
          updated_at?: string
          responsibility?: string[]
          categories?: string[]
          frequency_rules?: Json
          due_date?: string | null
          created_by?: string | null
          updated_by?: string | null
          start_date?: string | null
          end_date?: string | null
        }
      }
    }
  }
}