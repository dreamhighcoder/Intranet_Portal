/**
 * Timezone Utilities for Australian Pharmacy Intranet Portal
 * 
 * This module provides timezone-aware date utilities specifically for Australian operations.
 * All dates are handled in Australian timezone (Australia/Sydney) which automatically
 * handles daylight saving time transitions.
 */

import { format, parseISO, startOfDay, endOfDay } from 'date-fns'

// Australian timezone - this handles both AEST and AEDT automatically
export const AUSTRALIAN_TIMEZONE = 'Australia/Sydney'

/**
 * Get the current date and time in Australian timezone
 */
export function getAustralianNow(): Date {
  // Get current time and format it in Australian timezone
  const now = new Date()
  // Use Intl.DateTimeFormat to get the time in Australian timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: AUSTRALIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1 // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0')
  
  return new Date(year, month, day, hour, minute, second)
}

/**
 * Get the current date in Australian timezone as YYYY-MM-DD string
 */
export function getAustralianToday(): string {
  const now = getAustralianNow()
  return format(now, 'yyyy-MM-dd')
}

/**
 * Convert a date to Australian timezone
 */
export function toAustralianTime(date: Date): Date {
  // Use Intl.DateTimeFormat to get the time in Australian timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: AUSTRALIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1 // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0')
  
  return new Date(year, month, day, hour, minute, second)
}

/**
 * Convert an Australian date to UTC
 */
export function fromAustralianTime(date: Date): Date {
  // Assume the input date is in Australian timezone and convert to UTC
  const utcTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
  return utcTime
}

/**
 * Parse a date string (YYYY-MM-DD) as an Australian date
 * This ensures the date is interpreted in Australian timezone
 */
export function parseAustralianDate(dateString: string): Date {
  // Parse the date string and create a date in Australian timezone
  const [year, month, day] = dateString.split('-').map(Number)
  // Create date at midnight in Australian timezone
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Format a date as YYYY-MM-DD in Australian timezone
 */
export function formatAustralianDate(date: Date): string {
  const australianDate = toAustralianTime(date)
  return format(australianDate, 'yyyy-MM-dd')
}

/**
 * Get the start of day for a date in Australian timezone
 */
export function getAustralianStartOfDay(date: Date): Date {
  const australianDate = toAustralianTime(date)
  return startOfDay(australianDate)
}

/**
 * Get the end of day for a date in Australian timezone
 */
export function getAustralianEndOfDay(date: Date): Date {
  const australianDate = toAustralianTime(date)
  return endOfDay(australianDate)
}

/**
 * Check if a date string represents today in Australian timezone
 */
export function isAustralianToday(dateString: string): boolean {
  return dateString === getAustralianToday()
}

/**
 * Check if a date is in the past relative to Australian timezone
 */
export function isAustralianPast(date: Date): boolean {
  const now = getAustralianNow()
  const australianDate = toAustralianTime(date)
  return australianDate < now
}

/**
 * Get the day of week for a date in Australian timezone
 * Returns 0 for Sunday, 1 for Monday, etc.
 */
export function getAustralianDayOfWeek(dateString: string): number {
  const date = parseAustralianDate(dateString)
  return date.getDay()
}

/**
 * Create a Date object for a specific time on a given date in Australian timezone
 */
export function createAustralianDateTime(dateString: string, timeString: string): Date {
  const date = parseAustralianDate(dateString)
  const [hours, minutes] = timeString.split(':').map(Number)
  
  date.setHours(hours, minutes, 0, 0)
  return date
}

/**
 * Check if it's currently past a specific time on a given date in Australian timezone
 */
export function isAustralianTimePast(dateString: string, timeString: string): boolean {
  const now = getAustralianNow()
  const targetDateTime = createAustralianDateTime(dateString, timeString)
  return now > targetDateTime
}

/**
 * Get a date range in Australian timezone
 */
export function getAustralianDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(toAustralianTime(startDate))
  const end = toAustralianTime(endDate)
  
  while (current <= end) {
    dates.push(formatAustralianDate(current))
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

/**
 * Debug function to log timezone information
 */
export function debugTimezone(): void {
  const now = new Date()
  const utcNow = now.toISOString()
  const australianNow = getAustralianNow()
  const australianToday = getAustralianToday()
  
  console.log('Timezone Debug Info:')
  console.log('UTC Now:', utcNow)
  console.log('Australian Now:', australianNow.toISOString())
  console.log('Australian Today:', australianToday)
  console.log('Australian Day of Week:', australianNow.getDay())
}