import { supabaseServer } from '@/lib/supabase-server'
import { SystemSettings } from './system-settings'

const DEFAULT_SETTINGS: SystemSettings = {
  timezone: 'Australia/Hobart',
  new_since_hour: '00:00',
  missed_cutoff_time: '23:59',
  auto_logout_enabled: true,
  auto_logout_delay_minutes: 5,
  task_generation_days_ahead: 999999,
  task_generation_days_behind: 0,
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward: true
}

// Mapping between frontend setting names and database keys
const SETTING_KEY_MAP = {
  timezone: 'timezone',
  new_since_hour: 'new_since_hour',
  missed_cutoff_time: 'daily_task_cutoff', // Maps to daily_task_cutoff in your DB
  auto_logout_enabled: 'auto_logout_enabled',
  auto_logout_delay_minutes: 'auto_logout_delay_seconds', // Maps to seconds in your DB
  task_generation_days_ahead: 'task_generation_days_forward',
  task_generation_days_behind: 'task_generation_days_back',
  working_days: 'business_days', // Maps to business_days JSON array in your DB
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
 * Helper function to convert working days array to business days array
 */
function convertWorkingDaysToBusinessDays(workingDays: string[]): number[] {
  const dayMap = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  }
  return workingDays.map(day => dayMap[day as keyof typeof dayMap]).filter(Boolean)
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
    const settingsMap = new Map()
    settingsRows.forEach(row => {
      settingsMap.set(row.key, parseSettingValue(row.value, row.data_type))
    })

    console.log('📥 Raw settings from database:', Object.fromEntries(settingsMap))

    // Map database keys to frontend interface
    const mergedSettings: SystemSettings = {
      timezone: settingsMap.get(SETTING_KEY_MAP.timezone) || DEFAULT_SETTINGS.timezone,
      new_since_hour: settingsMap.get(SETTING_KEY_MAP.new_since_hour) || DEFAULT_SETTINGS.new_since_hour,
      missed_cutoff_time: settingsMap.get(SETTING_KEY_MAP.missed_cutoff_time) || DEFAULT_SETTINGS.missed_cutoff_time,
      auto_logout_enabled: settingsMap.get(SETTING_KEY_MAP.auto_logout_enabled) !== undefined 
        ? settingsMap.get(SETTING_KEY_MAP.auto_logout_enabled) 
        : DEFAULT_SETTINGS.auto_logout_enabled,
      // Convert seconds to minutes for the frontend
      auto_logout_delay_minutes: settingsMap.get(SETTING_KEY_MAP.auto_logout_delay_minutes) !== undefined
        ? Math.round(settingsMap.get(SETTING_KEY_MAP.auto_logout_delay_minutes) / 60)
        : DEFAULT_SETTINGS.auto_logout_delay_minutes,
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

    console.log('✅ Settings loaded and mapped successfully:', mergedSettings)
    return mergedSettings

  } catch (error) {
    console.error('Unexpected error fetching system settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Helper function to format setting value for database storage
 */
function formatSettingValue(value: any, dataType: string): string {
  switch (dataType) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      return value.toString()
    case 'json':
      return JSON.stringify(value)
    default:
      return value.toString()
  }
}

/**
 * Update system settings in database using server-side client (bypasses RLS)
 * This should only be used in API routes or server-side code
 */
export async function updateSystemSettingsServer(newSettings: SystemSettings): Promise<void> {
  try {
    console.log('🔄 updateSystemSettingsServer called with:', JSON.stringify(newSettings, null, 2))

    // Validate input data
    if (!newSettings.timezone || !newSettings.new_since_hour || !newSettings.missed_cutoff_time) {
      throw new Error('Missing required fields: timezone, new_since_hour, or missed_cutoff_time')
    }

    // Validate time format (should be HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(newSettings.new_since_hour)) {
      throw new Error(`Invalid new_since_hour format: ${newSettings.new_since_hour}. Expected HH:mm`)
    }
    if (!timeRegex.test(newSettings.missed_cutoff_time)) {
      throw new Error(`Invalid missed_cutoff_time format: ${newSettings.missed_cutoff_time}. Expected HH:mm`)
    }

    // Prepare the settings updates - map frontend settings to database keys
    const settingsUpdates = [
      {
        key: SETTING_KEY_MAP.timezone,
        value: formatSettingValue(newSettings.timezone, 'string'),
        data_type: 'string'
      },
      {
        key: SETTING_KEY_MAP.new_since_hour,
        value: formatSettingValue(newSettings.new_since_hour, 'string'),
        data_type: 'string'
      },
      {
        key: SETTING_KEY_MAP.missed_cutoff_time,
        value: formatSettingValue(newSettings.missed_cutoff_time, 'string'),
        data_type: 'string'
      },
      {
        key: SETTING_KEY_MAP.auto_logout_enabled,
        value: formatSettingValue(newSettings.auto_logout_enabled, 'boolean'),
        data_type: 'boolean'
      },
      {
        key: SETTING_KEY_MAP.auto_logout_delay_minutes,
        // Convert minutes to seconds for database storage
        value: formatSettingValue(newSettings.auto_logout_delay_minutes * 60, 'number'),
        data_type: 'number'
      },
      {
        key: SETTING_KEY_MAP.task_generation_days_ahead,
        value: formatSettingValue(newSettings.task_generation_days_ahead, 'number'),
        data_type: 'number'
      },
      {
        key: SETTING_KEY_MAP.task_generation_days_behind,
        value: formatSettingValue(newSettings.task_generation_days_behind, 'number'),
        data_type: 'number'
      },
      {
        key: SETTING_KEY_MAP.working_days,
        // Convert working days to business days array
        value: formatSettingValue(convertWorkingDaysToBusinessDays(newSettings.working_days), 'json'),
        data_type: 'json'
      },
      {
        key: SETTING_KEY_MAP.public_holiday_push_forward,
        value: formatSettingValue(newSettings.public_holiday_push_forward, 'boolean'),
        data_type: 'boolean'
      }
    ]

    console.log('📝 Updating settings in database...')
    console.log('   Settings updates:', JSON.stringify(settingsUpdates, null, 2))

    // Update each setting individually using upsert
    for (const setting of settingsUpdates) {
      console.log(`   Updating setting: ${setting.key} = ${setting.value}`)
      
      const { data: updateResult, error: updateError } = await supabaseServer
        .from('system_settings')
        .upsert({
          key: setting.key,
          value: setting.value,
          data_type: setting.data_type,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        })
        .select()

      if (updateError) {
        console.error(`❌ Error updating setting ${setting.key}:`, updateError)
        console.error('❌ Error details:', JSON.stringify(updateError, null, 2))
        throw new Error(`Database update failed for ${setting.key}: ${updateError.message} (Code: ${updateError.code})`)
      }
      
      console.log(`   ✅ Updated setting ${setting.key} successfully`)
    }

    console.log('✅ All system settings updated successfully')
  } catch (error) {
    console.error('Error updating system settings:', error)
    throw error
  }
}