import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching system settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json(DEFAULT_SETTINGS)
    }

    // Merge with defaults to ensure all fields are present
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      working_days: settings.working_days || DEFAULT_SETTINGS.working_days
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
      'timezone', 'new_since_hour', 'missed_cutoff_time', 
      'default_due_time', 'working_days'
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
    if (typeof body.task_generation_days_ahead !== 'number' || body.task_generation_days_ahead < 1 || body.task_generation_days_ahead > 730) {
      return NextResponse.json({ error: 'Invalid task_generation_days_ahead (must be 1-730)' }, { status: 400 })
    }

    if (typeof body.task_generation_days_behind !== 'number' || body.task_generation_days_behind < 0 || body.task_generation_days_behind > 90) {
      return NextResponse.json({ error: 'Invalid task_generation_days_behind (must be 0-90)' }, { status: 400 })
    }

    if (body.auto_logout_enabled && (typeof body.auto_logout_delay_minutes !== 'number' || body.auto_logout_delay_minutes < 1 || body.auto_logout_delay_minutes > 60)) {
      return NextResponse.json({ error: 'Invalid auto_logout_delay_minutes (must be 1-60)' }, { status: 400 })
    }

    // Prepare settings object
    const settingsToSave = {
      timezone: body.timezone,
      new_since_hour: body.new_since_hour,
      missed_cutoff_time: body.missed_cutoff_time,
      auto_logout_enabled: body.auto_logout_enabled || false,
      auto_logout_delay_minutes: body.auto_logout_delay_minutes || 5,
      task_generation_days_ahead: body.task_generation_days_ahead,
      task_generation_days_behind: body.task_generation_days_behind,
      default_due_time: body.default_due_time,
      working_days: body.working_days,
      public_holiday_push_forward: body.public_holiday_push_forward || false,
      updated_at: formatInTimeZone(getAustralianNow(), AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      updated_by: user.id
    }

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .single()

    let result
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('system_settings')
        .update(settingsToSave)
        .eq('id', existingSettings.id)
        .select()
        .single()
    } else {
      // Insert new settings
      result = await supabase
        .from('system_settings')
        .insert({
          ...settingsToSave,
          created_at: settingsToSave.updated_at,
          created_by: user.id
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving system settings:', result.error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      settings: result.data,
      message: 'System settings updated successfully'
    })

  } catch (error) {
    console.error('System settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}