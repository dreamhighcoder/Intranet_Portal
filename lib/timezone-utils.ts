/**
 * Timezone Utilities for Australian Pharmacy Intranet Portal
 * All logic is anchored to Australia/Hobart and DST is handled automatically.
 */

import {
  toZonedTime,
  fromZonedTime,
  formatInTimeZone,
} from 'date-fns-tz'

// Single source of truth
export const AUSTRALIAN_TIMEZONE = 'Australia/Hobart'

/**
 * Get a Date representing "now" in Australia/Hobart (for display/calcs with formatInTimeZone)
 * Note: the underlying Date is a UTC instant; use formatInTimeZone to render with TZ.
 */
export function getAustralianNow(): Date {
  return toZonedTime(new Date(), AUSTRALIAN_TIMEZONE)
}

/**
 * Get today's date string in Australia/Hobart as YYYY-MM-DD
 */
export function getAustralianToday(): string {
  return formatInTimeZone(new Date(), AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Convert a UTC Date (or any instant) to a Date projected in Australia/Hobart wall time
 * Useful for UI rendering with local Australian components
 */
export function toAustralianTime(date: Date): Date {
  return toZonedTime(date, AUSTRALIAN_TIMEZONE)
}

/**
 * Interpret the given Date's wall time as Australia/Hobart and convert to a UTC instant
 * Example: a Date whose components represent 2025-09-05 08:00 in Sydney -> corresponding UTC instant
 */
export function fromAustralianTime(date: Date): Date {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  const isoLocal = `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}`
  return fromZonedTime(isoLocal, AUSTRALIAN_TIMEZONE)
}

/**
 * Parse a YYYY-MM-DD as an Australia/Hobart date at 00:00:00 (returned as a Date with AU wall time projection)
 */
export function parseAustralianDate(dateString: string): Date {
  // Compute the UTC instant for AU midnight, then project back to AU wall time for UI usage
  const utcAtAuMidnight = fromZonedTime(`${dateString}T00:00:00.000`, AUSTRALIAN_TIMEZONE)
  return toZonedTime(utcAtAuMidnight, AUSTRALIAN_TIMEZONE)
}

/**
 * Format a Date as YYYY-MM-DD in Australia/Hobart
 */
export function formatAustralianDate(date: Date): string {
  return formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Format a Date as DD-MM-YYYY in Australia/Hobart for display
 */
export function formatAustralianDateDisplay(date: Date): string {
  return formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'dd-MM-yyyy')
}

/**
 * Get start of day for the given instant, in AU timezone, returned as a Date projected in AU wall time
 */
export function getAustralianStartOfDay(date: Date): Date {
  const auDay = formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
  const utcStart = fromZonedTime(`${auDay}T00:00:00.000`, AUSTRALIAN_TIMEZONE)
  return toZonedTime(utcStart, AUSTRALIAN_TIMEZONE)
}

/**
 * Get end of day for the given instant, in AU timezone, returned as a Date projected in AU wall time
 */
export function getAustralianEndOfDay(date: Date): Date {
  const auDay = formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
  const utcEnd = fromZonedTime(`${auDay}T23:59:59.999`, AUSTRALIAN_TIMEZONE)
  return toZonedTime(utcEnd, AUSTRALIAN_TIMEZONE)
}

/**
 * Check if a date string (YYYY-MM-DD) represents today in AU timezone
 */
export function isAustralianToday(dateString: string): boolean {
  return dateString === getAustralianToday()
}

/**
 * Check if a UTC instant is in the past relative to now, using AU perspective
 * (Effectively the same as UTC compare, but kept for API compatibility)
 */
export function isAustralianPast(date: Date): boolean {
  // Compare instants; converting to AU maintains clarity of intent
  const nowZoned = getAustralianNow()
  const dateZoned = toAustralianTime(date)
  return dateZoned.getTime() < nowZoned.getTime()
}

/**
 * Day of week for an AU date string: 0=Sunday, 1=Monday, ... 6=Saturday
 */
export function getAustralianDayOfWeek(dateString: string): number {
  // Use noon to avoid edge DST issues
  const utcNoon = fromZonedTime(`${dateString}T12:00:00.000`, AUSTRALIAN_TIMEZONE)
  const isoDow = Number(formatInTimeZone(utcNoon, AUSTRALIAN_TIMEZONE, 'i')) // 1=Mon ... 7=Sun
  return isoDow % 7 // 0=Sun, 1=Mon, ...
}

/**
 * Create a Date for a specific AU date and time (HH:mm), projected in AU wall time
 */
export function createAustralianDateTime(dateString: string, timeString: string): Date {
  const utcInstant = fromZonedTime(`${dateString}T${timeString}:00.000`, AUSTRALIAN_TIMEZONE)
  return toZonedTime(utcInstant, AUSTRALIAN_TIMEZONE)
}

/**
 * Check if it's currently past a specific time on a given AU date
 */
export function isAustralianTimePast(dateString: string, timeString: string): boolean {
  const targetUtc = fromZonedTime(`${dateString}T${timeString}:00.000`, AUSTRALIAN_TIMEZONE)
  return new Date().getTime() > targetUtc.getTime()
}

/**
 * Get all date strings between two instants inclusive, using AU calendar days
 */
export function getAustralianDateRange(startDate: Date, endDate: Date): string[] {
  const startAu = formatInTimeZone(startDate, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
  const endAu = formatInTimeZone(endDate, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')

  const dates: string[] = []
  let current = startAu

  while (current <= endAu) {
    dates.push(current)
    const nextUtc = fromZonedTime(`${current}T00:00:00.000`, AUSTRALIAN_TIMEZONE)
    const nextDayUtc = new Date(nextUtc.getTime() + 24 * 60 * 60 * 1000)
    current = formatInTimeZone(nextDayUtc, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd')
  }

  return dates
}

/**
 * Current AU time as a UTC ISO string (useful for storage)
 */
export function australianNowUtcISOString(): string {
  const utc = fromZonedTime(
    formatInTimeZone(new Date(), AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"),
    AUSTRALIAN_TIMEZONE
  )
  return utc.toISOString()
}

/**
 * Convert AU date (YYYY-MM-DD) and time (HH:mm) to UTC ISO
 */
export function australianDateTimeToUTCISOString(dateString: string, timeString: string): string {
  return fromZonedTime(`${dateString}T${timeString}:00.000`, AUSTRALIAN_TIMEZONE).toISOString()
}

/**
 * Convert a UTC instant to a Date projected in AU wall time (for UI)
 */
export function utcToAustralian(date: Date): Date {
  return toAustralianTime(date)
}

/**
 * Debug timezone info
 */
export function debugTimezone(): void {
  const nowUtc = new Date()
  const auNow = getAustralianNow()
  const auToday = getAustralianToday()

  console.log('Timezone Debug Info:')
  console.log('UTC Now:', nowUtc.toISOString())
  console.log('AU Now (proj):', formatInTimeZone(nowUtc, AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"))
  console.log('AU Today:', auToday)
  console.log('AU Day of Week:', getAustralianDayOfWeek(auToday))
}