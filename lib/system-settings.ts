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
  auto_logout_delay_minutes: 5,
  task_generation_days_ahead: 365,
  task_generation_days_behind: 30,
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward: true
}

// Cache for settings to avoid repeated database calls
let settingsCache: SystemSettings | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get system settings from database with caching
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now()
  
  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return settingsCache
  }

  try {
    // Get system settings from database - individual columns structure
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings found, return defaults
        console.log('No system settings found, using defaults')
        return DEFAULT_SETTINGS
      }
      console.error('Error fetching system settings:', error)
      return DEFAULT_SETTINGS
    }

    // Map database columns to frontend interface
    const mergedSettings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      timezone: settings.timezone || DEFAULT_SETTINGS.timezone,
      new_since_hour: settings.new_since_hour ? settings.new_since_hour.substring(0, 5) : DEFAULT_SETTINGS.new_since_hour, // Convert TIME to HH:mm
      missed_cutoff_time: settings.missed_cutoff_time ? settings.missed_cutoff_time.substring(0, 5) : DEFAULT_SETTINGS.missed_cutoff_time, // Convert TIME to HH:mm
      auto_logout_enabled: settings.auto_logout_enabled !== undefined ? settings.auto_logout_enabled : DEFAULT_SETTINGS.auto_logout_enabled,
      auto_logout_delay_minutes: settings.auto_logout_delay_minutes || DEFAULT_SETTINGS.auto_logout_delay_minutes,
      task_generation_days_ahead: settings.task_generation_days_ahead || DEFAULT_SETTINGS.task_generation_days_ahead,
      task_generation_days_behind: settings.task_generation_days_behind || DEFAULT_SETTINGS.task_generation_days_behind,
      working_days: settings.working_days || DEFAULT_SETTINGS.working_days,
      public_holiday_push_forward: settings.public_holiday_push_forward !== undefined ? settings.public_holiday_push_forward : DEFAULT_SETTINGS.public_holiday_push_forward
    }

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
 * Get a specific system setting by key
 */
export async function getSystemSetting<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
  const settings = await getSystemSettings()
  return settings[key]
}

/**
 * Clear the settings cache (useful after updates)
 */
export function clearSettingsCache(): void {
  settingsCache = null
  cacheTimestamp = 0
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
 * Update system settings in database
 */
export async function updateSystemSettings(newSettings: SystemSettings): Promise<void> {
  try {
    console.log('🔄 updateSystemSettings called with:', JSON.stringify(newSettings, null, 2))
    
    // Clear cache first
    clearSettingsCache()

    // Prepare the update object with the actual column names
    const updateData = {
      timezone: newSettings.timezone,
      new_since_hour: newSettings.new_since_hour + ':00', // Convert HH:mm to TIME format
      missed_cutoff_time: newSettings.missed_cutoff_time + ':00', // Convert HH:mm to TIME format
      auto_logout_enabled: newSettings.auto_logout_enabled,
      auto_logout_delay_minutes: newSettings.auto_logout_delay_minutes,
      task_generation_days_ahead: newSettings.task_generation_days_ahead,
      task_generation_days_behind: newSettings.task_generation_days_behind,
      working_days: newSettings.working_days,
      public_holiday_push_forward: newSettings.public_holiday_push_forward,
      updated_at: new Date().toISOString()
    }

    console.log('📝 Updating settings in database...')
    console.log('   Update data:', JSON.stringify(updateData, null, 2))

    // Since there should only be one row in system_settings, we'll update it
    // First, check if there's an existing row
    console.log('   Checking for existing settings...')
    const { data: existingSettings, error: fetchError } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .single()

    console.log('   Fetch result:', { existingSettings, fetchError })

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error fetching existing settings:', fetchError)
      console.error('❌ Fetch error details:', {
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
        hint: fetchError.hint
      })
      throw fetchError
    }

    if (existingSettings) {
      // Update existing row
      console.log('   Updating existing settings row with ID:', existingSettings.id)
      const { error: updateError } = await supabase
        .from('system_settings')
        .update(updateData)
        .eq('id', existingSettings.id)

      if (updateError) {
        console.error('❌ Error updating settings:', updateError)
        console.error('❌ Update error details:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint
        })
        throw updateError
      }
      console.log('   ✅ Update successful')
    } else {
      // Insert new row
      console.log('   Inserting new settings row...')
      const { error: insertError } = await supabase
        .from('system_settings')
        .insert(updateData)

      if (insertError) {
        console.error('❌ Error inserting settings:', insertError)
        console.error('❌ Insert error details:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        })
        throw insertError
      }
      console.log('   ✅ Insert successful')
    }

    console.log('✅ System settings updated successfully')
  } catch (error) {
    console.error('Error updating system settings:', error)
    throw error
  }
}

