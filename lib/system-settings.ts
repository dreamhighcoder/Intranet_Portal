import { supabase } from '@/lib/supabase'

export interface SystemSettings {
  timezone: string
  new_since_hour: string
  missed_cutoff_time: string
  auto_logout_enabled: boolean
  auto_logout_delay_minutes: number
  task_generation_days_ahead: number
  task_generation_days_behind: number
  working_days: string[]
  public_holiday_push_forward: boolean
}

const DEFAULT_SETTINGS: SystemSettings = {
  timezone: 'Australia/Sydney',
  new_since_hour: '09:00',
  missed_cutoff_time: '23:59',
  auto_logout_enabled: true,
  auto_logout_delay_minutes: 5, // Reasonable default
  task_generation_days_ahead: 365,
  task_generation_days_behind: 30,
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward: true
}

// Cache for settings to avoid repeated database calls
let settingsCache: SystemSettings | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Clear cache on module load to ensure fresh data
settingsCache = null
cacheTimestamp = 0

// Mapping between frontend setting names and database keys
const SETTING_KEY_MAP = {
  timezone: 'timezone',
  new_since_hour: 'new_since_hour',
  missed_cutoff_time: 'daily_task_cutoff',
  auto_logout_enabled: 'auto_logout_enabled',
  auto_logout_delay_minutes: 'auto_logout_delay_seconds',
  task_generation_days_ahead: 'task_generation_days_forward',
  task_generation_days_behind: 'task_generation_days_back',
  working_days: 'business_days',
  public_holiday_push_forward: 'ph_substitution_enabled'
}

/**
 * Helper function to parse setting value based on data type
 */
function parseSettingValue(value: string, dataType: string): any {
  switch (dataType) {
    case 'boolean':
      return value.toLowerCase() === 'true'
    case 'number':
      return parseInt(value, 10)
    case 'json':
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    default:
      return value
  }
}

/**
 * Helper function to convert business days array to working days array
 */
function convertBusinessDaysToWorkingDays(businessDays: number[]): string[] {
  const dayMap = {
    1: 'monday',
    2: 'tuesday', 
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    7: 'sunday'
  }
  return businessDays.map(day => dayMap[day as keyof typeof dayMap]).filter(Boolean)
}

/**
 * Get system settings from database with caching
 */
export async function getSystemSettings(forceRefresh: boolean = false): Promise<SystemSettings> {
  const now = Date.now()
  
  // Return cached settings if still valid (unless force refresh is requested)
  const cacheAge = now - cacheTimestamp
  if (!forceRefresh && settingsCache && cacheAge < CACHE_DURATION) {
    console.log('📦 Using cached settings:', {
      cacheAgeSeconds: Math.round(cacheAge / 1000),
      maxCacheSeconds: Math.round(CACHE_DURATION / 1000),
      autoLogoutDelay: settingsCache.auto_logout_delay_minutes
    })
    return settingsCache
  }

  console.log('🔄 Loading fresh settings from database:', {
    reason: forceRefresh ? 'force refresh' : 'cache expired',
    cacheAgeSeconds: Math.round(cacheAge / 1000),
    maxCacheSeconds: Math.round(CACHE_DURATION / 1000)
  })

  try {
    console.log('🔍 Querying system_settings table...')
    
    // Get system settings from database - key-value structure
    const { data: settingsRows, error } = await supabase
      .from('system_settings')
      .select('key, value, data_type')

    console.log('📊 Database query result:', { 
      error, 
      rowCount: settingsRows?.length || 0,
      firstFewRows: settingsRows?.slice(0, 3)
    })

    if (error) {
      console.error('❌ Error fetching system settings:', error)
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      })
      return DEFAULT_SETTINGS
    }

    if (!settingsRows || settingsRows.length === 0) {
      console.log('⚠️ No system settings found in database, using defaults')
      return DEFAULT_SETTINGS
    }

    // Convert key-value rows to settings object
    const settingsMap = new Map()
    settingsRows.forEach(row => {
      settingsMap.set(row.key, parseSettingValue(row.value, row.data_type))
    })

    console.log('🔍 Settings loaded from database:', {
      totalRows: settingsRows.length,
      autoLogoutDelaySeconds: settingsMap.get(SETTING_KEY_MAP.auto_logout_delay_minutes),
      autoLogoutEnabled: settingsMap.get(SETTING_KEY_MAP.auto_logout_enabled),
      settingsMap: Object.fromEntries(settingsMap)
    })

    // Map database keys to frontend interface
    const autoLogoutDelaySeconds = settingsMap.get(SETTING_KEY_MAP.auto_logout_delay_minutes)
    const autoLogoutDelayMinutes = autoLogoutDelaySeconds !== undefined
      ? Math.round(autoLogoutDelaySeconds / 60)
      : DEFAULT_SETTINGS.auto_logout_delay_minutes

    console.log('🔄 Auto-logout delay conversion:', {
      databaseKey: SETTING_KEY_MAP.auto_logout_delay_minutes,
      fromDatabase: autoLogoutDelaySeconds,
      convertedToMinutes: autoLogoutDelayMinutes,
      defaultFallback: DEFAULT_SETTINGS.auto_logout_delay_minutes,
      wasUndefined: autoLogoutDelaySeconds === undefined
    })

    const mergedSettings: SystemSettings = {
      timezone: settingsMap.get(SETTING_KEY_MAP.timezone) || DEFAULT_SETTINGS.timezone,
      new_since_hour: settingsMap.get(SETTING_KEY_MAP.new_since_hour) || DEFAULT_SETTINGS.new_since_hour,
      missed_cutoff_time: settingsMap.get(SETTING_KEY_MAP.missed_cutoff_time) || DEFAULT_SETTINGS.missed_cutoff_time,
      auto_logout_enabled: settingsMap.get(SETTING_KEY_MAP.auto_logout_enabled) !== undefined 
        ? settingsMap.get(SETTING_KEY_MAP.auto_logout_enabled) 
        : DEFAULT_SETTINGS.auto_logout_enabled,
      // Convert seconds to minutes for the frontend
      auto_logout_delay_minutes: autoLogoutDelayMinutes,
      task_generation_days_ahead: settingsMap.get(SETTING_KEY_MAP.task_generation_days_ahead) || DEFAULT_SETTINGS.task_generation_days_ahead,
      task_generation_days_behind: settingsMap.get(SETTING_KEY_MAP.task_generation_days_behind) || DEFAULT_SETTINGS.task_generation_days_behind,
      // Convert business days array to working days
      working_days: settingsMap.get(SETTING_KEY_MAP.working_days) 
        ? convertBusinessDaysToWorkingDays(settingsMap.get(SETTING_KEY_MAP.working_days))
        : DEFAULT_SETTINGS.working_days,
      public_holiday_push_forward: settingsMap.get(SETTING_KEY_MAP.public_holiday_push_forward) !== undefined
        ? settingsMap.get(SETTING_KEY_MAP.public_holiday_push_forward)
        : DEFAULT_SETTINGS.public_holiday_push_forward
    }

    console.log('✅ Final merged settings:', mergedSettings)

    // Update cache
    settingsCache = mergedSettings
    cacheTimestamp = now

    return mergedSettings

  } catch (error) {
    console.error('Unexpected error fetching system settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Clear the settings cache to force fresh loading
 */
export function clearSettingsCache(): void {
  console.log('🗑️ Clearing settings cache')
  settingsCache = null
  cacheTimestamp = 0
}

/**
 * Get a specific system setting by key
 */
export async function getSystemSetting<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
  const settings = await getSystemSettings()
  return settings[key]
}



/**
 * Get working days as numbers (0=Sunday, 1=Monday, etc.)
 */
export async function getWorkingDaysAsNumbers(): Promise<number[]> {
  const settings = await getSystemSettings()
  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
    'thursday': 4, 'friday': 5, 'saturday': 6
  }
  return settings.working_days.map(day => dayMap[day] || 1)
}

/**
 * Check if a given day is a working day
 */
export async function isWorkingDay(date: Date): Promise<boolean> {
  const workingDays = await getWorkingDaysAsNumbers()
  return workingDays.includes(date.getDay())
}

/**
 * Get the system timezone
 */
export async function getSystemTimezone(): Promise<string> {
  return await getSystemSetting('timezone')
}

/**
 * Get task generation settings
 */
export async function getTaskGenerationSettings(): Promise<{
  daysAhead: number
  daysBehind: number
  workingDays: string[]
}> {
  const settings = await getSystemSettings()
  return {
    daysAhead: settings.task_generation_days_ahead,
    daysBehind: settings.task_generation_days_behind,
    workingDays: settings.working_days
  }
}

/**
 * Update system settings via API
 */
export async function updateSystemSettings(newSettings: SystemSettings): Promise<void> {
  try {
    console.log('🔄 updateSystemSettings called with:', JSON.stringify(newSettings, null, 2))
    
    // Clear cache first
    clearSettingsCache()

    // Use the API endpoint to update settings
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newSettings)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Failed to update settings: ${errorData.error || response.statusText}`)
    }

    console.log('✅ System settings updated successfully via API')
  } catch (error) {
    console.error('Error updating system settings:', error)
    throw error
  }
}

