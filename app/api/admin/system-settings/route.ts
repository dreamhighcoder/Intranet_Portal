import { NextRequest, NextResponse } from 'next/server'
import { getSystemSettingsServer, updateSystemSettingsServer } from '@/lib/system-settings-server'

export async function GET() {
  try {
    // Use the server-side function that handles the correct schema
    const settings = await getSystemSettingsServer()
    
    return NextResponse.json(settings)

  } catch (error) {
    console.error('Admin system-settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
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

    // Use the server-side function that handles the correct schema
    await updateSystemSettingsServer(body)
    
    // Create response with cache-busting headers to ensure fresh data
    const response = NextResponse.json({ 
      success: true, 
      message: 'System settings updated successfully',
      timestamp: Date.now() // Help frontend detect changes
    })
    
    // Add headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    console.error('Admin system-settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}