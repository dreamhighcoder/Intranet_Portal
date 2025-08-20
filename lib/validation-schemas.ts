import { z } from 'zod'
import { 
  TaskTiming, 
  PublishStatus, 
  ChecklistInstanceStatus,
  FrequencyType,
  Weekday,
  Month
} from '@/types/checklist'

/**
 * Zod schema for frequency rules validation
 */
export const FrequencyRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FrequencyType.DAILY),
    every_n_days: z.number().int().min(1),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.WEEKLY),
    every_n_weeks: z.number().int().min(1),
    start_day: z.nativeEnum(Weekday).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.SPECIFIC_WEEKDAYS),
    weekdays: z.array(z.nativeEnum(Weekday)).min(1),
    every_n_weeks: z.number().int().min(1).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.START_OF_MONTH),
    every_n_months: z.number().int().min(1).optional(),
    months: z.array(z.nativeEnum(Month)).optional(),
    day_offset: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.START_CERTAIN_MONTHS),
    months: z.array(z.nativeEnum(Month)).min(1),
    day_offset: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.EVERY_MONTH),
    every_n_months: z.number().int().min(1).optional(),
    day_offset: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.CERTAIN_MONTHS),
    months: z.array(z.nativeEnum(Month)).min(1),
    day_offset: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.END_OF_MONTH),
    every_n_months: z.number().int().min(1).optional(),
    days_from_end: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.END_CERTAIN_MONTHS),
    months: z.array(z.nativeEnum(Month)).min(1),
    days_from_end: z.number().int().min(0).optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.ONCE_OFF),
    due_date: z.string().datetime(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  }),
  z.object({
    type: z.literal(FrequencyType.ONCE_OFF_STICKY),
    due_date: z.string().datetime().optional(),
    business_days_only: z.boolean().optional(),
    exclude_holidays: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  })
])

/**
 * Zod schema for creating/updating master checklist tasks
 */
export const CreateMasterTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  position_id: z.string().uuid('Invalid position ID').optional(),
  responsibility: z.array(z.string()).min(1, 'At least one responsibility is required'),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  frequency_rules: FrequencyRuleSchema.optional(), // Legacy field - optional for backward compatibility
  frequencies: z.array(z.enum([
    'once_off', 'every_day', 'once_weekly', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'once_monthly', 'start_of_every_month',
    'start_of_month_jan', 'start_of_month_feb', 'start_of_month_mar', 'start_of_month_apr',
    'start_of_month_may', 'start_of_month_jun', 'start_of_month_jul',
    'start_of_month_aug', 'start_of_month_sep', 'start_of_month_oct',
    'start_of_month_nov', 'start_of_month_dec', 'end_of_every_month',
    'end_of_month_jan', 'end_of_month_feb', 'end_of_month_mar', 'end_of_month_apr',
    'end_of_month_may', 'end_of_month_jun', 'end_of_month_jul',
    'end_of_month_aug', 'end_of_month_sep', 'end_of_month_oct',
    'end_of_month_nov', 'end_of_month_dec'
  ])).min(1, 'At least one frequency is required').optional(),
  timing: z.nativeEnum(TaskTiming),
  due_date: z.string().optional(), // Changed from datetime to allow date strings
  due_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  publish_status: z.nativeEnum(PublishStatus).default(PublishStatus.DRAFT),
  publish_delay: z.string().optional(), // Changed from datetime to allow date strings
  sticky_once_off: z.boolean().default(false),
  allow_edit_when_locked: z.boolean().default(false)
}).refine(
  (data) => data.frequency_rules || data.frequencies,
  {
    message: "Either frequency_rules or frequencies must be provided",
    path: ["frequencies"]
  }
)

/**
 * Zod schema for updating master checklist tasks
 */
export const UpdateMasterTaskSchema = CreateMasterTaskSchema.partial().extend({
  id: z.string().uuid('Invalid task ID')
})

/**
 * Zod schema for task instance updates
 */
export const UpdateTaskInstanceSchema = z.object({
  status: z.nativeEnum(ChecklistInstanceStatus),
  completed_by: z.string().uuid('Invalid user ID').optional(),
  completed_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  payload: z.record(z.any()).optional()
})

/**
 * Zod schema for checklist API query parameters
 */
export const ChecklistQuerySchema = z.object({
  role: z.string().min(1, 'Role is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD')
})

/**
 * Zod schema for admin task operations
 */
export const AdminTaskOperationSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'publish', 'unpublish']),
  task_id: z.string().uuid('Invalid task ID').optional(),
  data: CreateMasterTaskSchema.optional()
})

// Export types derived from schemas
export type CreateMasterTaskRequest = z.infer<typeof CreateMasterTaskSchema>
export type UpdateMasterTaskRequest = z.infer<typeof UpdateMasterTaskSchema>
export type UpdateTaskInstanceRequest = z.infer<typeof UpdateTaskInstanceSchema>
export type ChecklistQueryRequest = z.infer<typeof ChecklistQuerySchema>
export type AdminTaskOperationRequest = z.infer<typeof AdminTaskOperationSchema>
