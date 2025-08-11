// Constants for the pharmacy intranet portal

export const TASK_CATEGORIES = [
  "Compliance",
  "Security",
  "Inventory",
  "Customer Service",
  "Maintenance",
  "Training",
  "Administration",
] as const

export const TASK_FREQUENCIES = [
  { value: "once_off", label: "Once Off" },
  { value: "daily", label: "Every Day" },
  { value: "weekly_monday", label: "Weekly - Monday" },
  { value: "weekly_tuesday", label: "Weekly - Tuesday" },
  { value: "weekly_wednesday", label: "Weekly - Wednesday" },
  { value: "weekly_thursday", label: "Weekly - Thursday" },
  { value: "weekly_friday", label: "Weekly - Friday" },
  { value: "weekly_saturday", label: "Weekly - Saturday" },
  { value: "weekly_sunday", label: "Weekly - Sunday" },
  { value: "start_of_month", label: "Start of Month" },
  { value: "end_of_month", label: "End of Month" },
] as const

export const TASK_TIMINGS = [
  { value: "morning", label: "Morning" },
  { value: "before_close", label: "Before Close" },
  { value: "custom", label: "Custom Time" },
] as const

export const TASK_STATUS_COLORS = {
  not_due: "bg-gray-100 text-gray-800 border-gray-200",
  due_today: "bg-blue-100 text-blue-800 border-blue-200",
  overdue: "bg-orange-100 text-orange-800 border-orange-200",
  missed: "bg-red-100 text-red-800 border-red-200",
  done: "bg-green-100 text-green-800 border-green-200",
} as const

export const TASK_STATUS_LABELS = {
  not_due: "Not Due",
  due_today: "Due Today",
  overdue: "Overdue",
  missed: "Missed",
  done: "Done",
} as const

export const PHARMACY_COLORS = {
  primary: "#006A6C",
  secondary: "#4FB3BF",
  accent: "#4CAF50",
  background: "#F7F9FA",
  surface: "#FFFFFF",
  textPrimary: "#212121",
  textSecondary: "#616161",
  border: "#E0E0E0",
} as const
