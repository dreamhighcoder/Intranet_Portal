/**
 * Public Holidays Helper Module
 * Pharmacy Intranet Portal - Holiday Management
 * 
 * This module provides functionality to:
 * - Check if a date is a public holiday
 * - Get the next business day
 * - Get the previous business day
 * - Check if a date is a business day
 * - Shift dates to avoid holidays
 */
import { formatAustralianDate } from './timezone-utils'

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Public holiday record
 */
export interface PublicHoliday {
  date: string // ISO date string (YYYY-MM-DD)
  name: string
  region?: string
  source?: string
  created_at?: string
}

/**
 * Holiday checker interface for dependency injection
 */
export interface HolidayChecker {
  isHoliday(date: Date): boolean
  isBusinessDay(date: Date): boolean
  nextBusinessDay(date: Date): Date
  previousBusinessDay(date: Date): Date
  shiftToBusinessDay(date: Date, direction: 'forward' | 'backward'): Date
}

/**
 * Configuration for holiday checking
 */
export interface HolidayConfig {
  workingDays: number[] // 1=Monday, 7=Sunday
  skipSundays: boolean
  skipPublicHolidays: boolean
  defaultRegion: string
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

/**
 * Default working days (Monday to Friday)
 */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5] // Monday to Friday

/**
 * Default holiday configuration
 */
export const DEFAULT_HOLIDAY_CONFIG: HolidayConfig = {
  workingDays: DEFAULT_WORKING_DAYS,
  skipSundays: true,
  skipPublicHolidays: true,
  defaultRegion: 'National'
}

// ========================================
// PUBLIC HOLIDAYS HELPER CLASS
// ========================================

/**
 * Public holidays helper class
 * Can be used directly or injected as a dependency
 */
export class PublicHolidaysHelper implements HolidayChecker {
  private holidays: Map<string, PublicHoliday>
  private config: HolidayConfig

  constructor(holidays: PublicHoliday[] = [], config: Partial<HolidayConfig> = {}) {
    this.config = { ...DEFAULT_HOLIDAY_CONFIG, ...config }
    this.holidays = new Map()
    
    // Index holidays by date for fast lookup
    holidays.forEach(holiday => {
      this.holidays.set(holiday.date, holiday)
    })
  }

  /**
   * Check if a date is a public holiday
   */
  isHoliday(date: Date): boolean {
    const dateString = this.formatDate(date)
    return this.holidays.has(dateString)
  }

  /**
   * Check if a date is a business day
   * Business days are working days that are not public holidays
   */
  isBusinessDay(date: Date): boolean {
    const dayOfWeek = date.getDay() || 7 // Convert Sunday (0) to 7
    
    // Check if it's a working day
    if (!this.config.workingDays.includes(dayOfWeek)) {
      return false
    }

    // Check if it's Sunday and we should skip Sundays
    if (this.config.skipSundays && dayOfWeek === 7) {
      return false
    }

    // Check if it's a public holiday
    if (this.config.skipPublicHolidays && this.isHoliday(date)) {
      return false
    }

    return true
  }

  /**
   * Get the next business day from a given date
   */
  nextBusinessDay(date: Date): Date {
    let nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    
    while (!this.isBusinessDay(nextDate)) {
      nextDate.setDate(nextDate.getDate() + 1)
    }
    
    return nextDate
  }

  /**
   * Get the previous business day from a given date
   */
  previousBusinessDay(date: Date): Date {
    let prevDate = new Date(date)
    prevDate.setDate(prevDate.getDate() - 1)
    
    while (!this.isBusinessDay(prevDate)) {
      prevDate.setDate(prevDate.getDate() - 1)
    }
    
    return prevDate
  }

  /**
   * Shift a date to the nearest business day
   * @param date - Date to shift
   * @param direction - 'forward' to next business day, 'backward' to previous
   */
  shiftToBusinessDay(date: Date, direction: 'forward' | 'backward'): Date {
    if (this.isBusinessDay(date)) {
      return date
    }

    if (direction === 'forward') {
      return this.nextBusinessDay(date)
    } else {
      return this.previousBusinessDay(date)
    }
  }

  /**
   * Get the next N business days from a given date
   */
  getNextBusinessDays(date: Date, count: number): Date[] {
    const businessDays: Date[] = []
    let currentDate = new Date(date)
    
    while (businessDays.length < count) {
      currentDate = this.nextBusinessDay(currentDate)
      businessDays.push(currentDate)
    }
    
    return businessDays
  }

  /**
   * Get the previous N business days from a given date
   */
  getPreviousBusinessDays(date: Date, count: number): Date[] {
    const businessDays: Date[] = []
    let currentDate = new Date(date)
    
    while (businessDays.length < count) {
      currentDate = this.previousBusinessDay(currentDate)
      businessDays.unshift(currentDate) // Add to beginning to maintain order
    }
    
    return businessDays
  }

  /**
   * Count business days between two dates (inclusive)
   */
  countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0
    let currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      if (this.isBusinessDay(currentDate)) {
        count++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return count
  }

  /**
   * Add N business days to a date
   */
  addBusinessDays(date: Date, businessDays: number): Date {
    let result = new Date(date)
    let remainingDays = businessDays
    
    while (remainingDays > 0) {
      result = this.nextBusinessDay(result)
      remainingDays--
    }
    
    return result
  }

  /**
   * Subtract N business days from a date
   */
  subtractBusinessDays(date: Date, businessDays: number): Date {
    let result = new Date(date)
    let remainingDays = businessDays
    
    while (remainingDays > 0) {
      result = this.previousBusinessDay(result)
      remainingDays--
    }
    
    return result
  }

  /**
   * Get all business days in a date range
   */
  getBusinessDaysInRange(startDate: Date, endDate: Date): Date[] {
    const businessDays: Date[] = []
    let currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      if (this.isBusinessDay(currentDate)) {
        businessDays.push(new Date(currentDate))
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return businessDays
  }

  /**
   * Check if a date range contains only business days
   */
  isBusinessDayRange(startDate: Date, endDate: Date): boolean {
    let currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      if (!this.isBusinessDay(currentDate)) {
        return false
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return true
  }

  /**
   * Get the first business day in a month
   */
  getFirstBusinessDayOfMonth(year: number, month: number): Date {
    const firstDay = new Date(year, month - 1, 1)
    return this.shiftToBusinessDay(firstDay, 'forward')
  }

  /**
   * Get the last business day in a month
   */
  getLastBusinessDayOfMonth(year: number, month: number): Date {
    const lastDay = new Date(year, month, 0) // Last day of month
    return this.shiftToBusinessDay(lastDay, 'backward')
  }

  /**
   * Get the Nth business day of a month
   */
  getNthBusinessDayOfMonth(year: number, month: number, n: number): Date {
    if (n < 1) {
      throw new Error('N must be at least 1')
    }
    
    let currentDate = new Date(year, month - 1, 1)
    let businessDayCount = 0
    
    while (businessDayCount < n) {
      if (this.isBusinessDay(currentDate)) {
        businessDayCount++
        if (businessDayCount === n) {
          return currentDate
        }
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    throw new Error(`Month ${month}/${year} does not have ${n} business days`)
  }

  /**
   * Get the Nth business day from the end of a month
   */
  getNthBusinessDayFromEndOfMonth(year: number, month: number, n: number): Date {
    if (n < 1) {
      throw new Error('N must be at least 1')
    }
    
    let currentDate = new Date(year, month, 0) // Last day of month
    let businessDayCount = 0
    
    while (businessDayCount < n) {
      if (this.isBusinessDay(currentDate)) {
        businessDayCount++
        if (businessDayCount === n) {
          return currentDate
        }
      }
      currentDate.setDate(currentDate.getDate() - 1)
    }
    
    throw new Error(`Month ${month}/${year} does not have ${n} business days from end`)
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Format date to ISO string (YYYY-MM-DD) in Australian timezone
   */
  private formatDate(date: Date): string {
    return formatAustralianDate(date)
  }

  /**
   * Get the current configuration
   */
  getConfig(): HolidayConfig {
    return { ...this.config }
  }

  /**
   * Update the configuration
   */
  updateConfig(newConfig: Partial<HolidayConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Add a holiday to the internal map
   */
  addHoliday(holiday: PublicHoliday): void {
    this.holidays.set(holiday.date, holiday)
  }

  /**
   * Remove a holiday from the internal map
   */
  removeHoliday(date: string): boolean {
    return this.holidays.delete(date)
  }

  /**
   * Get all holidays
   */
  getAllHolidays(): PublicHoliday[] {
    return Array.from(this.holidays.values())
  }

  /**
   * Clear all holidays
   */
  clearHolidays(): void {
    this.holidays.clear()
  }

  /**
   * Check if holidays are loaded
   */
  hasHolidays(): boolean {
    return this.holidays.size > 0
  }
}

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Create a holiday helper with default configuration
 */
export function createHolidayHelper(holidays: PublicHoliday[] = []): PublicHolidaysHelper {
  return new PublicHolidaysHelper(holidays)
}

/**
 * Create a holiday helper with holidays from the database
 * This function should be used in server-side contexts where database access is available
 */
export async function createHolidayHelperFromDatabase(): Promise<PublicHolidaysHelper> {
  try {
    // This function should be called from server-side code that has access to the database
    // For now, we'll return an empty helper - the actual implementation should be in the API layer
    return new PublicHolidaysHelper([])
  } catch (error) {
    console.error('Error creating holiday helper from database:', error)
    // Fallback to empty helper
    return new PublicHolidaysHelper([])
  }
}

/**
 * Get holidays from the database and create a helper
 * This is a server-side function that requires database access
 * Note: This function should only be called from server-side code (API routes)
 */
export async function getHolidayHelperFromDatabase(): Promise<PublicHolidaysHelper> {
  try {
    // This function should be called from server-side code that has access to the database
    // For now, we'll return an empty helper - the actual implementation should be in the API layer
    // where supabase-server can be safely imported
    return new PublicHolidaysHelper([])
  } catch (error) {
    console.error('Error creating holiday helper from database:', error)
    // Fallback to empty helper
    return new PublicHolidaysHelper([])
  }
}

/**
 * Create a holiday helper with custom configuration
 */
export function createHolidayHelperWithConfig(
  holidays: PublicHoliday[] = [],
  config: Partial<HolidayConfig> = {}
): PublicHolidaysHelper {
  return new PublicHolidaysHelper(holidays, config)
}

/**
 * Create a mock holiday helper for testing
 */
export function createMockHolidayHelper(
  isHolidayFn?: (date: Date) => boolean,
  isBusinessDayFn?: (date: Date) => boolean
): HolidayChecker {
  return {
    isHoliday: isHolidayFn || (() => false),
    isBusinessDay: isBusinessDayFn || (() => true),
    nextBusinessDay: (date: Date) => {
      const next = new Date(date)
      next.setDate(next.getDate() + 1)
      return next
    },
    previousBusinessDay: (date: Date) => {
      const prev = new Date(date)
      prev.setDate(prev.getDate() - 1)
      return prev
    },
    shiftToBusinessDay: (date: Date) => date
  }
}

// ========================================
// EXPORTS
// ========================================

export type {
  PublicHoliday,
  HolidayChecker,
  HolidayConfig
}
