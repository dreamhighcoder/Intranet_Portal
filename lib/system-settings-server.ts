import { supabaseServer } from '@/lib/supabase-server'
import { SystemSettings } from './system-settings'

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

/**
 * Get system settings from database using server-side client (bypasses RLS)
 * This should only be used in API routes or server-side code
 */
export async function getSystemSettingsServer(): Promise<SystemSettings> {
  try {
    console.log('🔄 getSystemSettingsServer called')
    
    // Get system settings from database - key-value structure
    const { data: settingsRows, error } = await supabaseServer
      .from('system_settings')
      .select('key, value, data_type')

    if (error) {
      console.error('Error fetching system settings:', error)
      return DEFAULT_SETTINGS
    }

    if (!settingsRows || settingsRows.length === 0) {
      console.log('No system settings found, using defaults')
      return DEFAULT_SETTINGS
    }

    // Convert key-value rows to settings object
    const settingsMap: Record<string, any> = {}
    for (const row of settingsRows) {
      let value = row.value
      
      // Parse value based on data type
      switch (row.data_type) {
        case 'boolean':
          value = value === 'true' || value === true
          break
        case 'number':
          value = parseFloat(value)
          break
        case 'json':
          try {
            value = JSON.parse(value)
          } catch {
            console.warn(`Failed to parse JSON for setting ${row.key}:`, value)
          }
          break
        // 'string' values remain as-is
      }
      
      settingsMap[row.key] = value
    }

    // Map database keys to frontend interface with fallbacks
    const mergedSettings: SystemSettings = {
      timezone: settingsMap.timezone || DEFAULT_SETTINGS.timezone,
      new_since_hour: settingsMap.new_since_hour || DEFAULT_SETTINGS.new_since_hour,
      missed_cutoff_time: settingsMap.daily_task_cutoff || settingsMap.missed_cutoff_time || DEFAULT_SETTINGS.missed_cutoff_time,
      auto_logout_enabled: settingsMap.auto_logout_enabled !== undefined ? settingsMap.auto_logout_enabled : DEFAULT_SETTINGS.auto_logout_enabled,
      auto_logout_delay_minutes: settingsMap.auto_logout_delay_minutes || (settingsMap.auto_logout_delay_seconds ? settingsMap.auto_logout_delay_seconds / 60 : DEFAULT_SETTINGS.auto_logout_delay_minutes),
      task_generation_days_ahead: settingsMap.task_generation_days_ahead || settingsMap.task_generation_days_forward || DEFAULT_SETTINGS.task_generation_days_ahead,
      task_generation_days_behind: settingsMap.task_generation_days_behind || settingsMap.task_generation_days_back || DEFAULT_SETTINGS.task_generation_days_behind,
      working_days: settingsMap.working_days || (settingsMap.business_days ? convertBusinessDaysToWorkingDays(settingsMap.business_days) : DEFAULT_SETTINGS.working_days),
      public_holiday_push_forward: settingsMap.public_holiday_push_forward !== undefined ? settingsMap.public_holiday_push_forward : (settingsMap.ph_substitution_enabled !== undefined ? settingsMap.ph_substitution_enabled : DEFAULT_SETTINGS.public_holiday_push_forward)
    }

    console.log('✅ Settings loaded successfully:', mergedSettings)
    return mergedSettings

  } catch (error) {
    console.error('Unexpected error fetching system settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Convert business days array [1,2,3,4,5,6] to working days array ['monday','tuesday',...]
 */
function convertBusinessDaysToWorkingDays(businessDays: number[]): string[] {
  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return businessDays.map(day => dayMap[day]).filter(Boolean)
}

/**
 * Update system settings in database using server-side client (bypasses RLS)
 * This should only be used in API routes or server-side code
 */
export async function updateSystemSettingsServer(newSettings: SystemSettings): Promise<void> {
  try {
    console.log('🔄 updateSystemSettingsServer called with:', JSON.stringify(newSettings, null, 2))

    // Map frontend settings to database key-value pairs
    const settingsToUpdate = [
      { key: 'timezone', value: newSettings.timezone, data_type: 'string' },
      { key: 'new_since_hour', value: newSettings.new_since_hour, data_type: 'string' },
      { key: 'daily_task_cutoff', value: newSettings.missed_cutoff_time, data_type: 'string' },
      { key: 'auto_logout_enabled', value: newSettings.auto_logout_enabled.toString(), data_type: 'boolean' },
      { key: 'auto_logout_delay_seconds', value: (newSettings.auto_logout_delay_minutes * 60).toString(), data_type: 'number' },
      { key: 'task_generation_days_forward', value: newSettings.task_generation_days_ahead.toString(), data_type: 'number' },
      { key: 'task_generation_days_back', value: newSettings.task_generation_days_behind.toString(), data_type: 'number' },
      { key: 'business_days', value: JSON.stringify(convertWorkingDaysToBusiness(newSettings.working_days)), data_type: 'json' },
      { key: 'ph_substitution_enabled', value: newSettings.public_holiday_push_forward.toString(), data_type: 'boolean' }
    ]

    console.log('📝 Updating settings in database...')
    console.log('   Settings to update:', JSON.stringify(settingsToUpdate, null, 2))

    // Update each setting individually using upsert
    for (const setting of settingsToUpdate) {
      console.log(`   Upserting setting: ${setting.key} = ${setting.value}`)
      
      const { error } = await supabaseServer
        .from('system_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          data_type: setting.data_type,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })

      if (error) {
        console.error(`❌ Error upserting setting ${setting.key}:`, error)
        console.error('❌ Upsert error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        throw error
      }
    }

    console.log('✅ System settings updated successfully')
  } catch (error) {
    console.error('Error updating system settings:', error)
    throw error
  }
}

/**
 * Convert working days array ['monday','tuesday',...] to business days array [1,2,3,4,5,6]
 */
function convertWorkingDaysToBusiness(workingDays: string[]): number[] {
  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
    'thursday': 4, 'friday': 5, 'saturday': 6
  }
  return workingDays.map(day => dayMap[day]).filter(day => day !== undefined)
}