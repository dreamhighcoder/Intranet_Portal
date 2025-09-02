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
  // Get current UTC time
  const utcNow = new Date()
  
  // Create a date representing the current time in Australian timezone
  // This uses the Intl API to get the correct Australian time including DST
  const australianTimeString = utcNow.toLocaleString('en-AU', {
    timeZone: AUSTRALIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  // Parse the Australian time string back to a Date object
  // Format will be: "DD/MM/YYYY, HH:mm:ss"
  const [datePart, timePart] = australianTimeString.split(', ')
  const [day, month, year] = datePart.split('/').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  
  // Create a new Date object representing this Australian time
  // Note: This creates a Date object that represents the Australian time as if it were local time
  return new Date(year, month - 1, day, hour, minute, second)
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
  // Convert the input date to Australian timezone
  const australianTimeString = date.toLocaleString('en-AU', {
    timeZone: AUSTRALIAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  // Parse the Australian time string back to a Date object
  // Format will be: "DD/MM/YYYY, HH:mm:ss"
  const [datePart, timePart] = australianTimeString.split(', ')
  const [day, month, year] = datePart.split('/').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  
  // Create a new Date object representing this Australian time
  return new Date(year, month - 1, day, hour, minute, second)
}

/**
 * Convert an Australian date to UTC
 */
export function fromAustralianTime(date: Date): Date {
  // Create a date string in Australian timezone format
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  
  // Create ISO string assuming this is Australian time
  const australianISOString = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  
  // Parse this as if it were in Australian timezone and get UTC equivalent
  const tempDate = new Date(australianISOString)
  const utcEquivalent = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }))
  
  return utcEquivalent
}

/**
 * Parse a date string (YYYY-MM-DD) as an Australian date
 * This ensures the date is interpreted in Australian timezone
 */
export function parseAustralianDate(dateString: string): Date {
  // Parse the date string and create a date at midnight in Australian timezone
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Create a date string that represents midnight in Australian timezone
  const australianMidnight = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
  
  // Create a Date object and then convert it to represent Australian time
  const tempDate = new Date(australianMidnight)
  
  // Return a date that represents this day at midnight in Australian context
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
 * Return current Australia/Sydney time as a UTC ISO string for storage
 */
export function australianNowUtcISOString(): string {
  const ausNow = getAustralianNow()
  const utc = fromAustralianTime(ausNow)
  return utc.toISOString()
}

/**
 * Convert an Australia/Sydney date (YYYY-MM-DD) and time (HH:mm) to a UTC ISO string
 */
export function australianDateTimeToUTCISOString(dateString: string, timeString: string): string {
  const ausDateTime = createAustralianDateTime(dateString, timeString)
  const utc = fromAustralianTime(ausDateTime)
  return utc.toISOString()
}

/**
 * Convert a UTC Date to a Date representing Australia/Sydney wall time (for UI)
 */
export function utcToAustralian(date: Date): Date {
  return toAustralianTime(date)
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