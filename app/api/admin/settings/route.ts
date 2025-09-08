import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getSystemSettingsServer, updateSystemSettingsServer } from '@/lib/system-settings-server'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Only admin users can access system settings
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 403 })
    }

    const settings = await getSystemSettingsServer()
    
    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error) {
    console.error('Get system settings error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load system settings'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 PUT /api/admin/settings called')
    console.log('🔄 Request URL:', request.url)
    console.log('🔄 Request method:', request.method)
    
    const user = await requireAuth(request)
    console.log('👤 Authenticated user:', { id: user.id, role: user.role, display_name: user.display_name })
    
    // Only admin users can modify system settings
    if (user.role !== 'admin') {
      console.log('❌ Access denied - user is not admin')
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 403 })
    }

    const body = await request.json()
    console.log('📥 Request body received:', JSON.stringify(body, null, 2))
    
    // Validate required fields
    const requiredFields = [
      'timezone',
      'new_since_hour',
      'missed_cutoff_time',
      'auto_logout_enabled',
      'auto_logout_delay_minutes',
      'task_generation_days_ahead',
      'task_generation_days_behind',
      'working_days',
      'public_holiday_push_forward'
    ]

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`
        }, { status: 400 })
      }
    }

    // Validate data types and ranges
    if (typeof body.auto_logout_enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'auto_logout_enabled must be a boolean'
      }, { status: 400 })
    }

    if (typeof body.auto_logout_delay_minutes !== 'number' || body.auto_logout_delay_minutes < 1 || body.auto_logout_delay_minutes > 1440) {
      return NextResponse.json({
        success: false,
        error: 'auto_logout_delay_minutes must be a number between 1 and 1440'
      }, { status: 400 })
    }

    if (typeof body.task_generation_days_ahead !== 'number' || body.task_generation_days_ahead < 1) {
      return NextResponse.json({
        success: false,
        error: 'task_generation_days_ahead must be a positive number'
      }, { status: 400 })
    }

    if (typeof body.task_generation_days_behind !== 'number' || body.task_generation_days_behind < 0) {
      return NextResponse.json({
        success: false,
        error: 'task_generation_days_behind must be a non-negative number'
      }, { status: 400 })
    }

    if (!Array.isArray(body.working_days) || body.working_days.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'working_days must be a non-empty array'
      }, { status: 400 })
    }

    if (typeof body.public_holiday_push_forward !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'public_holiday_push_forward must be a boolean'
      }, { status: 400 })
    }

    // Validate time formats (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(body.new_since_hour)) {
      return NextResponse.json({
        success: false,
        error: 'new_since_hour must be in HH:mm format'
      }, { status: 400 })
    }

    if (!timeRegex.test(body.missed_cutoff_time)) {
      return NextResponse.json({
        success: false,
        error: 'missed_cutoff_time must be in HH:mm format'
      }, { status: 400 })
    }

    // Validate working days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of body.working_days) {
      if (!validDays.includes(day)) {
        return NextResponse.json({
          success: false,
          error: `Invalid working day: ${day}`
        }, { status: 400 })
      }
    }

    // Update settings
    console.log('💾 Calling updateSystemSettings...')
    try {
      await updateSystemSettingsServer(body)
      console.log('✅ Settings updated successfully')
    } catch (updateError) {
      console.error('❌ updateSystemSettings failed:', updateError)
      console.error('❌ Error details:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint
      })
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      message: 'System settings updated successfully'
    })
  } catch (error) {
    console.error('❌ Update system settings error:', error)
    console.error('❌ Error type:', typeof error)
    console.error('❌ Error message:', error?.message)
    console.error('❌ Error stack:', error?.stack)
    console.error('❌ Full error object:', JSON.stringify(error, null, 2))
    return NextResponse.json({
      success: false,
      error: 'Failed to update system settings'
    }, { status: 500 })
  }
}