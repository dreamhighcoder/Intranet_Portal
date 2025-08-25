/**
 * Holiday Checker Adapter
 * Pharmacy Intranet Portal - Bridge between existing holiday system and recurrence engine
 * 
 * This adapter bridges the existing PublicHolidaysHelper with the new TaskRecurrenceEngine
 * holiday checker interface.
 */

import { supabaseServer } from '@/lib/supabase-server'
import { PublicHolidaysHelper, type PublicHoliday } from '@/lib/public-holidays'
import { parseISO, getDay } from 'date-fns'

// ========================================
// HOLIDAY CHECKER ADAPTER
// ========================================

export interface RecurrenceHolidayChecker {
  isHoliday(date: string): boolean
  isWeekend(date: string): boolean
}

export class HolidayCheckerAdapter implements RecurrenceHolidayChecker {
  private holidaysHelper: PublicHolidaysHelper
  private holidaysCache: Map<string, boolean> = new Map()
  private lastCacheUpdate: number = 0
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  constructor(holidays: PublicHoliday[] = []) {
    this.holidaysHelper = new PublicHolidaysHelper(holidays)
  }

  /**
   * Check if a date string (YYYY-MM-DD) is a public holiday
   */
  isHoliday(date: string): boolean {
    // Check cache first
    if (this.holidaysCache.has(date)) {
      return this.holidaysCache.get(date)!
    }

    try {
      const dateObj = parseISO(date)
      const isHol = this.holidaysHelper.isHoliday(dateObj)
      
      // Cache the result
      this.holidaysCache.set(date, isHol)
      
      return isHol
    } catch (error) {
      console.error('Error checking holiday status for date:', date, error)
      return false
    }
  }

  /**
   * Check if a date string (YYYY-MM-DD) is a weekend (Saturday or Sunday)
   */
  isWeekend(date: string): boolean {
    try {
      const dateObj = parseISO(date)
      const dayOfWeek = getDay(dateObj)
      return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
    } catch (error) {
      console.error('Error checking weekend status for date:', date, error)
      return false
    }
  }

  /**
   * Update holidays cache from database
   */
  async updateHolidaysFromDatabase(): Promise<void> {
    try {
      const now = Date.now()
      
      // Skip if cache is still fresh
      if (now - this.lastCacheUpdate < this.CACHE_TTL) {
        return
      }

      const { data: holidays, error } = await supabaseServer
        .from('public_holidays')
        .select('date, name, region, source')
        .order('date')

      if (error) {
        console.error('Error fetching holidays from database:', error)
        return
      }

      if (holidays) {
        // Update the holidays helper
        this.holidaysHelper = new PublicHolidaysHelper(holidays)
        
        // Clear cache to force refresh
        this.holidaysCache.clear()
        this.lastCacheUpdate = now
        
        console.log(`Updated holidays cache with ${holidays.length} holidays`)
      }
    } catch (error) {
      console.error('Error updating holidays from database:', error)
    }
  }

  /**
   * Get all holidays for debugging/testing
   */
  getAllHolidays(): PublicHoliday[] {
    return Array.from(this.holidaysHelper['holidays'].values())
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

let globalHolidayChecker: HolidayCheckerAdapter | null = null

/**
 * Get or create the global holiday checker instance
 */
export async function getHolidayChecker(): Promise<HolidayCheckerAdapter> {
  if (!globalHolidayChecker) {
    globalHolidayChecker = new HolidayCheckerAdapter()
    await globalHolidayChecker.updateHolidaysFromDatabase()
  }
  
  return globalHolidayChecker
}

/**
 * Force refresh of the global holiday checker
 */
export async function refreshHolidayChecker(): Promise<HolidayCheckerAdapter> {
  globalHolidayChecker = new HolidayCheckerAdapter()
  await globalHolidayChecker.updateHolidaysFromDatabase()
  return globalHolidayChecker
}

export default HolidayCheckerAdapter