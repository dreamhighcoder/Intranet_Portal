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
  { value: "once_off_sticky", label: "Once-off Sticky" },
  { value: "every_day", label: "Every Day (Mon-Sat, no PH)" },
  { value: "weekly_monday", label: "Weekly Monday (PH push-forward)" },
  { value: "specific_weekdays", label: "Specific Weekdays" },
  { value: "start_of_every_month", label: "Start of Every Month" },
  { value: "start_of_certain_months", label: "Start of Certain Months" },
  { value: "once_every_month", label: "Once Every Month" },
  { value: "certain_months_only", label: "Certain Months Only" },
  { value: "end_of_every_month", label: "End of Every Month" },
  { value: "end_of_certain_months", label: "End of Certain Months" },
] as const

export const TASK_TIMINGS = [
  { value: "morning", label: "Morning" },
  { value: "before_close", label: "Before Close" },
  { value: "custom", label: "Custom Time" },
] as const

// Updated color system - removed old TASK_STATUS_COLORS as they're now in CSS
export const TASK_STATUS_LABELS = {
  not_due: "To Do",
  due_today: "Due Today",
  overdue: "Overdue",
  missed: "Missed",
  done: "Done",
} as const

// New pharmacy color system matching the specification
export const PHARMACY_COLORS = {
  // Core brand colors
  primary: "#072e9f",
  primaryOn: "#ffffff",
  secondary: "#b2dbff",
  tertiary: "#daeeff",
  bg: "#f7f9fa",
  surface: "#ffffff",
  text: "#212121",
  textMuted: "#616161",
  border: "#e0e0e0",

  // Status colors with proper contrast
  statusTodoBg: "#b2dbff",
  statusTodoText: "#212121",
  statusDueTodayBg: "#1565c0",
  statusDueTodayText: "#ffffff",
  statusOverdueBg: "#fb8c00",
  statusOverdueText: "#212121",
  statusMissedBg: "#d12c2c",
  statusMissedText: "#ffffff",
  statusDoneBg: "#2e7d32",
  statusDoneText: "#ffffff",
  accentGreen: "#3fa846",
} as const

// Position types for the pharmacy
export const POSITION_TYPES = [
  "Pharmacist (Primary)",
  "Pharmacist (Supporting)",
  "Pharmacy Assistants",
  "Dispensary Technicians",
  "DAA Packers",
  "Operational/Managerial",
] as const

// Weekdays for specific weekday frequencies
export const WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
] as const

// Months for month-specific frequencies
export const MONTHS = [
  { value: "january", label: "January" },
  { value: "february", label: "February" },
  { value: "march", label: "March" },
  { value: "april", label: "April" },
  { value: "may", label: "May" },
  { value: "june", label: "June" },
  { value: "july", label: "July" },
  { value: "august", label: "August" },
  { value: "september", label: "September" },
  { value: "october", label: "October" },
  { value: "november", label: "November" },
  { value: "december", label: "December" },
] as const

// Task publish statuses
export const PUBLISH_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const

// Default system settings
export const DEFAULT_SETTINGS = {
  timezone: "Australia/Sydney",
  newSinceHour: "09:00",
  missedCutoffTime: "23:59",
} as const
