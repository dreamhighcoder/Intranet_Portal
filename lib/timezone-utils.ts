/**
 * Timezone utilities for Australian pharmacy operations
 */

const AUSTRALIA_TIMEZONE = 'Australia/Sydney';

/**
 * Get the current date in Australian timezone in YYYY-MM-DD format
 */
export function getAustralianDate(): string {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: AUSTRALIA_TIMEZONE 
  }); // en-CA gives YYYY-MM-DD format
}

/**
 * Get the current time in Australian timezone
 */
export function getAustralianTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { 
    timeZone: AUSTRALIA_TIMEZONE 
  }));
}

/**
 * Get day of week for a date in Australian timezone
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Day of week (0 = Sunday, 1 = Monday, etc.)
 */
export function getAustralianDayOfWeek(dateString: string): number {
  // Create a date object and get the day of week in Australian timezone
  const date = new Date(dateString + 'T12:00:00'); // Use noon to avoid timezone edge cases
  const australianDateString = date.toLocaleDateString('en-US', { 
    timeZone: AUSTRALIA_TIMEZONE,
    weekday: 'numeric'
  });
  
  // Convert to day of week number
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = date.toLocaleDateString('en-US', { 
    timeZone: AUSTRALIA_TIMEZONE,
    weekday: 'long'
  });
  
  return dayNames.indexOf(dayName);
}

/**
 * Check if it's currently after 9 AM in Australian timezone
 */
export function isAfterNineAMAustralian(): boolean {
  const australianTime = getAustralianTime();
  return australianTime.getHours() >= 9;
}

/**
 * Get 9 AM today in Australian timezone
 */
export function getNineAMAustralian(): Date {
  const australianDate = getAustralianDate();
  const nineAM = new Date(`${australianDate}T09:00:00`);
  
  // Convert to Australian timezone
  return new Date(nineAM.toLocaleString('en-US', { 
    timeZone: AUSTRALIA_TIMEZONE 
  }));
}

/**
 * Convert a date string and time to Australian timezone Date object
 */
export function getAustralianDateTime(dateString: string, timeString: string): Date {
  return new Date(`${dateString}T${timeString}`);
}

/**
 * Debug function to show timezone information
 */
export function debugTimezone() {
  const now = new Date();
  const australianTime = getAustralianTime();
  const australianDate = getAustralianDate();
  
  console.log('Timezone Debug:');
  console.log(`Server time: ${now.toISOString()}`);
  console.log(`Australian time: ${australianTime.toISOString()}`);
  console.log(`Australian date: ${australianDate}`);
  console.log(`Australian day of week: ${getAustralianDayOfWeek(australianDate)}`);
}