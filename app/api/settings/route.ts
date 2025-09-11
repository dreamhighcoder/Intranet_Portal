import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Default settings
const DEFAULT_SETTINGS = {
  timezone: 'Australia/Sydney',
  new_since_hour: '00:00',
  missed_cutoff_time: '23:59',
  auto_logout_enabled: true,
  auto_logout_delay_minutes: 5,
  task_generation_days_ahead: 999999,
  task_generation_days_behind: 0,
  default_due_time: '17:00',
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  public_holiday_push_forward: true
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key')

    let query = supabase
      .from('system_settings')
      .select('*')

    if (key) {
      query = query.eq('key', key)
    }

    const { data: settings, error } = await query

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    if (key && settings && settings.length > 0) {
      return NextResponse.json(settings[0])
    }

    // Convert array to object for easier use
    const settingsObject = (settings || []).reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value
      return acc
    }, {})

    // Merge with defaults for any missing settings
    const finalSettings = { ...DEFAULT_SETTINGS, ...settingsObject }

    return NextResponse.json(finalSettings)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { key, value, description } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    // Check if setting already exists
    const { data: existingSetting } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', key)
      .single()

    let result
    if (existingSetting) {
      // Update existing setting
      const { data: setting, error } = await supabase
        .from('system_settings')
        .update({ value, description })
        .eq('key', key)
        .select()
        .single()

      if (error) {
        console.error('Error updating setting:', error)
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
      }
      result = setting
    } else {
      // Create new setting
      const { data: setting, error } = await supabase
        .from('system_settings')
        .insert([{ key, value, description }])
        .select()
        .single()

      if (error) {
        console.error('Error creating setting:', error)
        return NextResponse.json({ error: 'Failed to create setting' }, { status: 500 })
      }
      result = setting
    }

    return NextResponse.json(result, { status: existingSetting ? 200 : 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    // Handle bulk update of multiple settings
    if (Array.isArray(body)) {
      const results = []
      
      for (const setting of body) {
        const { key, value, description } = setting
        
        if (!key || value === undefined) {
          continue
        }

        const { data: updatedSetting, error } = await supabase
          .from('system_settings')
          .upsert({ key, value, description }, { onConflict: 'key' })
          .select()
          .single()

        if (!error && updatedSetting) {
          results.push(updatedSetting)
        }
      }

      return NextResponse.json(results)
    }

    // Handle single setting update
    const { key, value, description } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    const { data: setting, error } = await supabase
      .from('system_settings')
      .upsert({ key, value, description }, { onConflict: 'key' })
      .select()
      .single()

    if (error) {
      console.error('Error updating setting:', error)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('system_settings')
      .delete()
      .eq('key', key)

    if (error) {
      console.error('Error deleting setting:', error)
      return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Setting deleted successfully' })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}