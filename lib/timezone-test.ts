/**
 * Timezone Test Utility
 * 
 * This file helps verify that the Australian timezone utilities work correctly
 * regardless of the local system timezone.
 */

import { 
  getAustralianNow, 
  getAustralianToday, 
  formatAustralianDate, 
  parseAustralianDate,
  createAustralianDateTime,
  isAustralianTimePast,
  debugTimezone
} from './timezone-utils'

/**
 * Test function to verify timezone handling
 * Run this in the browser console to verify timezone behavior
 */
export function testAustralianTimezone() {
  console.log('=== Australian Timezone Test ===')
  
  // Get current times
  const localNow = new Date()
  const australianNow = getAustralianNow()
  const australianToday = getAustralianToday()
  
  console.log('Local System Time:', localNow.toString())
  console.log('Australian Time:', australianNow.toString())
  console.log('Australian Today:', australianToday)
  
  // Test date parsing
  const testDate = '2024-01-15'
  const parsedDate = parseAustralianDate(testDate)
  console.log('Parsed Australian Date:', parsedDate.toString())
  
  // Test time creation
  const testDateTime = createAustralianDateTime('2024-01-15', '14:30')
  console.log('Australian DateTime (2024-01-15 14:30):', testDateTime.toString())
  
  // Test time comparison
  const isPast = isAustralianTimePast(australianToday, '09:00')
  console.log('Is 9:00 AM past in Australia today?', isPast)
  
  // Show timezone offset difference
  const localOffset = localNow.getTimezoneOffset()
  const australianOffset = australianNow.getTimezoneOffset()
  console.log('Local Timezone Offset (minutes):', localOffset)
  console.log('Australian Timezone Offset (minutes):', australianOffset)
  
  // Test formatting
  const formattedDate = formatAustralianDate(australianNow)
  console.log('Formatted Australian Date:', formattedDate)
  
  console.log('=== End Test ===')
  
  return {
    localNow,
    australianNow,
    australianToday,
    timeDifference: australianNow.getTime() - localNow.getTime(),
    offsetDifference: australianOffset - localOffset
  }
}

/**
 * Verify that the system is using Australian timezone consistently
 */
export function verifyAustralianTimezoneConsistency() {
  console.log('=== Timezone Consistency Check ===')
  
  // Run debug function
  debugTimezone()
  
  // Check if Australian time is different from local time (unless you're in Australia)
  const localNow = new Date()
  const australianNow = getAustralianNow()
  
  const timeDiff = Math.abs(australianNow.getTime() - localNow.getTime())
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  
  console.log('Time difference between local and Australian:', hoursDiff, 'hours')
  
  if (hoursDiff < 1) {
    console.warn('⚠️  Local and Australian times are very similar. Are you in Australia, or is there a timezone issue?')
  } else {
    console.log('✅ Australian timezone is working correctly - different from local time')
  }
  
  // Test that dates are consistent
  const today1 = getAustralianToday()
  const today2 = getAustralianToday()
  
  if (today1 === today2) {
    console.log('✅ Australian date consistency check passed')
  } else {
    console.error('❌ Australian date consistency check failed')
  }
  
  console.log('=== End Consistency Check ===')
}