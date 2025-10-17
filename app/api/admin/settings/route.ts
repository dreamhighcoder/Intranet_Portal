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
    
    // Fetch resource hub config
    try {
      const { supabaseServer } = await import('@/lib/supabase-server')
      
      const { data: resourceHubData, error: resourceHubError } = await supabaseServer
        .from('system_settings')
        .select('key, value')
        .in('key', ['resource_hub_categories', 'resource_hub_document_types'])

      if (!resourceHubError && resourceHubData) {
        for (const item of resourceHubData) {
          if (item.key === 'resource_hub_categories') {
            try {
              const parsed = JSON.parse(item.value)
              // Normalize to array format
              settings.resource_hub_categories = Array.isArray(parsed) ? parsed : []
            } catch (e) {
              console.warn('Error parsing resource_hub_categories:', e)
              settings.resource_hub_categories = []
            }
          } else if (item.key === 'resource_hub_document_types') {
            try {
              const parsed = JSON.parse(item.value)
              // Normalize object format to array format if needed
              if (Array.isArray(parsed)) {
                settings.resource_hub_document_types = parsed
              } else if (typeof parsed === 'object' && parsed !== null) {
                // Convert {id: {label, color}, ...} to [{id, label, color}, ...]
                settings.resource_hub_document_types = Object.entries(parsed).map(([id, data]: [string, any]) => ({
                  id,
                  label: data.label || '',
                  color: data.color || ''
                }))
              } else {
                settings.resource_hub_document_types = []
              }
            } catch (e) {
              console.warn('Error parsing resource_hub_document_types:', e)
              settings.resource_hub_document_types = []
            }
          }
        }
      }
    } catch (resourceHubError) {
      console.warn('Failed to fetch resource hub config:', resourceHubError)
      settings.resource_hub_categories = []
      settings.resource_hub_document_types = []
    }
    
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
    
    // Validate required fields (excluding optional resource hub fields)
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

    // Extract resource hub config if provided
    const resourceHubCategories = body.resource_hub_categories
    const resourceHubDocumentTypes = body.resource_hub_document_types

    // Validate resource hub categories if provided
    if (resourceHubCategories !== undefined) {
      console.log('🔍 Validating resource hub categories...')
      if (!Array.isArray(resourceHubCategories)) {
        console.error('❌ Categories is not an array:', typeof resourceHubCategories)
        return NextResponse.json({
          success: false,
          error: 'resource_hub_categories must be an array'
        }, { status: 400 })
      }
      console.log('✅ Categories is an array with', resourceHubCategories.length, 'items')
      for (let i = 0; i < resourceHubCategories.length; i++) {
        const cat = resourceHubCategories[i]
        console.log(`  Category ${i}: id="${cat.id}", label="${cat.label}", emoji="${cat.emoji}", color="${cat.color}"`)
        if (!cat.id || !cat.label) {
          console.error(`❌ Category ${i} is missing id or label:`, cat)
          return NextResponse.json({
            success: false,
            error: `Category at index ${i} must have id and label`
          }, { status: 400 })
        }
      }
    }

    // Validate resource hub document types if provided
    if (resourceHubDocumentTypes !== undefined) {
      console.log('🔍 Validating resource hub document types...')
      if (!Array.isArray(resourceHubDocumentTypes)) {
        console.error('❌ Types is not an array:', typeof resourceHubDocumentTypes)
        return NextResponse.json({
          success: false,
          error: 'resource_hub_document_types must be an array'
        }, { status: 400 })
      }
      console.log('✅ Types is an array with', resourceHubDocumentTypes.length, 'items')
      for (let i = 0; i < resourceHubDocumentTypes.length; i++) {
        const type = resourceHubDocumentTypes[i]
        console.log(`  Type ${i}: id="${type.id}", label="${type.label}", color="${type.color}"`)
        if (!type.id || !type.label) {
          console.error(`❌ Type ${i} is missing id or label:`, type)
          return NextResponse.json({
            success: false,
            error: `Document type at index ${i} must have id and label`
          }, { status: 400 })
        }
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

    // Update settings using the server-side function
    console.log('💾 Updating system settings...')
    try {
      // Create a copy of body without resource hub config for updateSystemSettingsServer
      const settingsToUpdate = { ...body }
      delete settingsToUpdate.resource_hub_categories
      delete settingsToUpdate.resource_hub_document_types
      
      await updateSystemSettingsServer(settingsToUpdate)
      console.log('✅ Settings updated successfully')

      // Update resource hub config if provided
      if (resourceHubCategories !== undefined || resourceHubDocumentTypes !== undefined) {
        console.log('💾 Updating resource hub configuration...')
        console.log('📊 Resource hub categories to save:', JSON.stringify(resourceHubCategories, null, 2))
        console.log('📊 Resource hub document types to save:', JSON.stringify(resourceHubDocumentTypes, null, 2))
        
        const { supabaseServer } = await import('@/lib/supabase-server')
        
        if (resourceHubCategories !== undefined) {
          const stringifiedCategories = JSON.stringify(resourceHubCategories)
          console.log('🔤 Stringified categories value:', stringifiedCategories)
          console.log('🔤 Stringified categories length:', stringifiedCategories.length)
          
          const { error: catError } = await supabaseServer
            .from('system_settings')
            .upsert(
              {
                key: 'resource_hub_categories',
                value: stringifiedCategories,
                description: 'Resource Hub document categories',
                data_type: 'json',
                is_public: false
              },
              { onConflict: 'key' }
            )

          if (catError) {
            console.error('❌ Error updating categories:', catError)
            throw new Error('Failed to update resource hub categories')
          }
          console.log('✅ Categories saved successfully')
        }

        if (resourceHubDocumentTypes !== undefined) {
          const stringifiedTypes = JSON.stringify(resourceHubDocumentTypes)
          console.log('🔤 Stringified types value:', stringifiedTypes)
          console.log('🔤 Stringified types length:', stringifiedTypes.length)
          
          const { error: typeError } = await supabaseServer
            .from('system_settings')
            .upsert(
              {
                key: 'resource_hub_document_types',
                value: stringifiedTypes,
                description: 'Resource Hub document types',
                data_type: 'json',
                is_public: false
              },
              { onConflict: 'key' }
            )

          if (typeError) {
            console.error('❌ Error updating document types:', typeError)
            throw new Error('Failed to update resource hub document types')
          }
          console.log('✅ Document types saved successfully')
        }

        console.log('✅ Resource hub configuration updated successfully')
      }
    } catch (updateError) {
      console.error('❌ Failed to update settings:', updateError)
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
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to update system settings'
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}