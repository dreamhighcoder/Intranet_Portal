/**
 * Holiday Checker Adapter
 * Pharmacy Intranet Portal - Holiday Checking Interface
 * 
 * This module provides a simple interface for the recurrence engine
 * to check holidays and business days.
 */

import { PublicHolidaysHelper, type HolidayChecker as BaseHolidayChecker } from './public-holidays'
import { supabase } from './db'
import { toAustralianTime, formatAustralianDate } from './timezone-utils'

/**
 * Holiday checker interface for the recurrence engine
 */
export interface HolidayChecker {
  isHolidaySync(date: Date): boolean
  isBusinessDaySync(date: Date): boolean
  nextBusinessDaySync(date: Date): Date
  previousBusinessDaySync(date: Date): Date
}

/**
 * Holiday checker implementation using the public holidays helper
 */
export class HolidayChecker implements HolidayChecker {
  private helper: PublicHolidaysHelper
  private initialized: boolean = false

  constructor(holidays?: Array<{date: string, name: string, region?: string}>) {
    // Initialize with provided holidays or empty array
    const holidayData = holidays || []
    this.helper = new PublicHolidaysHelper(holidayData, {
      workingDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday (no Sunday - Sunday is 0)
      skipSundays: true, // Explicitly skip Sundays as per specification
      skipPublicHolidays: true,
      defaultRegion: 'National',
      timezone: 'Australia/Sydney' // Use Australian timezone
    })
    this.initialized = holidays ? true : false
  }

  /**
   * Create and initialize a HolidayChecker instance
   */
  static async create(): Promise<HolidayChecker> {
    const checker = new HolidayChecker();
    await checker.initializeHolidays();
    return checker;
  }

  /**
   * Create a HolidayChecker with provided holidays data
   */
  static withHolidays(holidays: Array<{date: string, name: string, region?: string}>): HolidayChecker {
    return new HolidayChecker(holidays)
  }

  /**
   * Initialize holidays from database
   */
  private async initializeHolidays(): Promise<void> {
    if (this.initialized) return

    try {
      const { data: holidays, error } = await supabase
        .from('public_holidays')
        .select('date, name, region')
        .order('date')

      if (error) {
        console.warn('Failed to load public holidays:', error.message)
        // Continue with empty holidays
      } else if (holidays) {
        // Clear existing holidays and add new ones
        this.helper.clearHolidays()
        holidays.forEach(holiday => {
          this.helper.addHoliday({
            date: holiday.date,
            name: holiday.name,
            region: holiday.region || 'National'
          })
        })
      }

      this.initialized = true
    } catch (error) {
      console.warn('Error initializing holidays:', error)
      this.initialized = true // Mark as initialized to avoid repeated attempts
    }
  }

  /**
   * Check if a date is a public holiday
   * Converts date to Australian timezone before checking
   */
  async isHoliday(date: Date): Promise<boolean> {
    await this.initializeHolidays()
    const australianDate = toAustralianTime(date)
    return this.helper.isHoliday(australianDate)
  }

  /**
   * Check if a date is a business day (not weekend, not holiday)
   * Converts date to Australian timezone before checking
   */
  async isBusinessDay(date: Date): Promise<boolean> {
    await this.initializeHolidays()
    const australianDate = toAustralianTime(date)
    return this.helper.isBusinessDay(australianDate)
  }

  /**
   * Get the next business day
   */
  async nextBusinessDay(date: Date): Promise<Date> {
    await this.initializeHolidays()
    return this.helper.nextBusinessDay(date)
  }

  /**
   * Get the previous business day
   */
  async previousBusinessDay(date: Date): Promise<Date> {
    await this.initializeHolidays()
    return this.helper.previousBusinessDay(date)
  }

  /**
   * Synchronous version for compatibility with existing code
   * Note: This will use cached holidays only
   * Converts date to Australian timezone before checking
   */
  isHolidaySync(date: Date): boolean {
    const australianDate = toAustralianTime(date)
    return this.helper.isHoliday(australianDate)
  }

  /**
   * Debug method to get all loaded holidays
   */
  getAllHolidays() {
    return this.helper.getAllHolidays()
  }

  /**
   * Synchronous version for compatibility with existing code
   * Note: This will use cached holidays only
   * Converts date to Australian timezone before checking
   */
  isBusinessDaySync(date: Date): boolean {
    const australianDate = toAustralianTime(date)
    return this.helper.isBusinessDay(australianDate)
  }

  /**
   * Synchronous version for compatibility with existing code
   * Note: This will use cached holidays only
   */
  nextBusinessDaySync(date: Date): Date {
    return this.helper.nextBusinessDay(date)
  }

  /**
   * Synchronous version for compatibility with existing code
   * Note: This will use cached holidays only
   */
  previousBusinessDaySync(date: Date): Date {
    return this.helper.previousBusinessDay(date)
  }

  /**
   * Force reload holidays from database
   */
  async reloadHolidays(): Promise<void> {
    this.initialized = false
    await this.initializeHolidays()
  }

  /**
   * Get the underlying helper for advanced operations
   */
  getHelper(): PublicHolidaysHelper {
    return this.helper
  }
}

/**
 * Create a holiday checker instance
 */
export async function createHolidayChecker(): Promise<HolidayChecker> {
  return await HolidayChecker.create();
}

/**
 * Default holiday checker instance (as a promise)
 */
export const defaultHolidayChecker: Promise<HolidayChecker> = HolidayChecker.create();