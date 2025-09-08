import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAustralianNow, AUSTRALIAN_TIMEZONE } from '@/lib/timezone-utils'
import { formatInTimeZone } from 'date-fns-tz'

interface SystemSettings {
  timezone: string
  new_since_hour: string
  missed_cutoff_time: string
  auto_logout_enabled: boolean
  auto_logout_delay_minutes: number
  task_generation_days_ahead: number
  task_generation_days_behind: number
  default_due_time: string
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
  default_due_time: '17:00',
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward: true
}

export async function GET() {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get system settings from database
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value, data_type')

    if (error) {
      console.error('Error fetching system settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Convert array to object and parse values based on data_type
    const settingsObject: any = {}
    
    if (settings) {
      for (const setting of settings) {
        let value = setting.value
        
        // Parse value based on data_type
        switch (setting.data_type) {
          case 'boolean':
            value = value === 'true'
            break
          case 'number':
            value = Number(value)
            break
          case 'json':
            try {
              value = JSON.parse(value)
            } catch {
              value = setting.value
            }
            break
          default:
            // string - keep as is
            break
        }
        
        settingsObject[setting.key] = value
      }
    }

    // Map database keys to frontend keys and merge with defaults
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      timezone: settingsObject.timezone || DEFAULT_SETTINGS.timezone,
      new_since_hour: settingsObject.new_since_hour || DEFAULT_SETTINGS.new_since_hour,
      missed_cutoff_time: settingsObject.daily_task_cutoff || DEFAULT_SETTINGS.missed_cutoff_time,
      auto_logout_enabled: settingsObject.auto_logout_enabled !== undefined ? settingsObject.auto_logout_enabled : DEFAULT_SETTINGS.auto_logout_enabled,
      auto_logout_delay_minutes: settingsObject.auto_logout_delay_seconds ? Math.ceil(settingsObject.auto_logout_delay_seconds / 60) : DEFAULT_SETTINGS.auto_logout_delay_minutes,
      task_generation_days_ahead: settingsObject.task_generation_days_forward || DEFAULT_SETTINGS.task_generation_days_ahead,
      task_generation_days_behind: settingsObject.task_generation_days_back || DEFAULT_SETTINGS.task_generation_days_behind,
      working_days: settingsObject.business_days ? 
        settingsObject.business_days.map((day: number) => {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          return dayNames[day] || 'monday'
        }) : DEFAULT_SETTINGS.working_days,
      public_holiday_push_forward: settingsObject.ph_substitution_enabled !== undefined ? settingsObject.ph_substitution_enabled : DEFAULT_SETTINGS.public_holiday_push_forward
    }

    return NextResponse.json(mergedSettings)

  } catch (error) {
    console.error('System settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate required fields
    const requiredFields = [
      'timezone', 'new_since_hour', 'missed_cutoff_time', 'working_days'
    ]
    
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Validate timezone
    const validTimezones = [
      'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
      'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin',
      'Australia/Hobart'
    ]
    
    if (!validTimezones.includes(body.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }

    // Validate working days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    if (!Array.isArray(body.working_days) || !body.working_days.every(day => validDays.includes(day))) {
      return NextResponse.json({ error: 'Invalid working days' }, { status: 400 })
    }

    // Validate numeric fields
    if (typeof body.task_generation_days_ahead !== 'number' || body.task_generation_days_ahead < 1 || body.task_generation_days_ahead > 999999) {
      return NextResponse.json({ error: 'Invalid task_generation_days_ahead (must be 1-999999)' }, { status: 400 })
    }

    if (typeof body.task_generation_days_behind !== 'number' || body.task_generation_days_behind < 0 || body.task_generation_days_behind > 90) {
      return NextResponse.json({ error: 'Invalid task_generation_days_behind (must be 0-90)' }, { status: 400 })
    }

    if (body.auto_logout_enabled && (typeof body.auto_logout_delay_minutes !== 'number' || body.auto_logout_delay_minutes < 1 || body.auto_logout_delay_minutes > 60)) {
      return NextResponse.json({ error: 'Invalid auto_logout_delay_minutes (must be 1-60)' }, { status: 400 })
    }

    // Map frontend settings to database key-value pairs
    const settingsToUpdate = [
      { key: 'timezone', value: body.timezone, data_type: 'string' },
      { key: 'new_since_hour', value: body.new_since_hour, data_type: 'string' },
      { key: 'daily_task_cutoff', value: body.missed_cutoff_time, data_type: 'string' },
      { key: 'auto_logout_enabled', value: body.auto_logout_enabled ? 'true' : 'false', data_type: 'boolean' },
      { key: 'auto_logout_delay_seconds', value: String(body.auto_logout_delay_minutes * 60), data_type: 'number' },
      { key: 'task_generation_days_forward', value: String(body.task_generation_days_ahead), data_type: 'number' },
      { key: 'task_generation_days_back', value: String(body.task_generation_days_behind), data_type: 'number' },
      { key: 'ph_substitution_enabled', value: body.public_holiday_push_forward ? 'true' : 'false', data_type: 'boolean' },
      { 
        key: 'business_days', 
        value: JSON.stringify(body.working_days.map((day: string) => {
          const dayMap: { [key: string]: number } = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
            'thursday': 4, 'friday': 5, 'saturday': 6
          }
          return dayMap[day] || 1
        })), 
        data_type: 'json' 
      }
    ]

    // Update each setting using upsert
    const results = []
    for (const setting of settingsToUpdate) {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert(
          { 
            key: setting.key, 
            value: setting.value, 
            data_type: setting.data_type,
            updated_at: formatInTimeZone(getAustralianNow(), AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
          },
          { onConflict: 'key' }
        )
        .select()
        .single()

      if (error) {
        console.error(`Error updating setting ${setting.key}:`, error)
        return NextResponse.json({ error: `Failed to update setting: ${setting.key}` }, { status: 500 })
      }

      results.push(data)
    }

    // Log the settings change in audit log
    await supabase
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'system_config_changed',
        metadata: {
          settings_updated: settingsToUpdate.map(s => s.key),
          timestamp: formatInTimeZone(getAustralianNow(), AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
        }
      })

    return NextResponse.json({ 
      success: true, 
      settings: results,
      message: 'System settings updated successfully'
    })

  } catch (error) {
    console.error('System settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}