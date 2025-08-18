// Constants for the pharmacy intranet portal

// Task categories matching project specifications
export const TASK_CATEGORIES = [
  { value: "stock-control", label: "Stock Control" },
  { value: "compliance", label: "Compliance" },
  { value: "cleaning", label: "Cleaning" },
  { value: "pharmacy-services", label: "Pharmacy Services" },
  { value: "fos-operations", label: "FOS Operations" },
  { value: "dispensary-operations", label: "Dispensary Operations" },
  { value: "general-pharmacy-operations", label: "General Pharmacy Operations" },
  { value: "business-management", label: "Business Management" },
] as const

// Task frequencies matching project specifications
export const TASK_FREQUENCIES = [
  { value: "once_off", label: "Once Off" },
  { value: "every_day", label: "Every Day" },
  { value: "once_weekly", label: "Once Weekly" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "once_monthly", label: "Once Monthly" },
  { value: "start_of_month_jan", label: "Start of Month (Jan)" },
  { value: "start_of_month_feb", label: "Start of Month (Feb)" },
  { value: "start_of_month_mar", label: "Start of Month (Mar)" },
  { value: "start_of_month_apr", label: "Start of Month (Apr)" },
  { value: "start_of_month_may", label: "Start of Month (May)" },
  { value: "start_of_month_jun", label: "Start of Month (Jun)" },
  { value: "start_of_month_jul", label: "Start of Month (Jul)" },
  { value: "start_of_month_aug", label: "Start of Month (Aug)" },
  { value: "start_of_month_sep", label: "Start of Month (Sep)" },
  { value: "start_of_month_oct", label: "Start of Month (Oct)" },
  { value: "start_of_month_nov", label: "Start of Month (Nov)" },
  { value: "start_of_month_dec", label: "Start of Month (Dec)" },
  { value: "end_of_month_jan", label: "End of Month (Jan)" },
  { value: "end_of_month_feb", label: "End of Month (Feb)" },
  { value: "end_of_month_mar", label: "End of Month (Mar)" },
  { value: "end_of_month_apr", label: "End of Month (Apr)" },
  { value: "end_of_month_may", label: "End of Month (May)" },
  { value: "end_of_month_jun", label: "End of Month (Jun)" },
  { value: "end_of_month_jul", label: "End of Month (Jul)" },
  { value: "end_of_month_aug", label: "End of Month (Aug)" },
  { value: "end_of_month_sep", label: "End of Month (Sep)" },
  { value: "end_of_month_oct", label: "End of Month (Oct)" },
  { value: "end_of_month_nov", label: "End of Month (Nov)" },
  { value: "end_of_month_dec", label: "End of Month (Dec)" },
] as const

// Task timings matching project specifications
export const TASK_TIMINGS = [
  { value: "opening", label: "Opening" },
  { value: "anytime_during_day", label: "Anytime During Day" },
  { value: "before_order_cut_off", label: "Before Order Cut Off" },
  { value: "closing", label: "Closing" },
] as const

// Responsibility options matching project specifications
export const RESPONSIBILITY_OPTIONS = [
  { value: "pharmacist-primary", label: "Pharmacist (Primary)" },
  { value: "pharmacist-supporting", label: "Pharmacist (Supporting)" },
  { value: "pharmacy-assistants", label: "Pharmacy Assistant/s" },
  { value: "dispensary-technicians", label: "Dispensary Technician/s" },
  { value: "daa-packers", label: "DAA Packer/s" },
  { value: "shared-exc-pharmacist", label: "Shared (exc. Pharmacist)" },
  { value: "shared-inc-pharmacist", label: "Shared (inc. Pharmacist)" },
  { value: "operational-managerial", label: "Operational/Managerial" },
] as const

// Default due times based on timing
export const DEFAULT_DUE_TIMES = {
  opening: "09:30",
  anytime_during_day: "12:00",
  before_order_cut_off: "14:00",
  closing: "17:30",
} as const

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
