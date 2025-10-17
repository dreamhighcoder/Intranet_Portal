import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // 🔥 IMPORTANT: GET is public - anyone can read the config
    // This allows non-admin users to load the correct filters and category/type labels
    // Only the PUT (update) operation requires admin access

    // Fetch both categories and types from system_settings
    const { data: settingsData, error: settingsError } = await supabaseServer
      .from('system_settings')
      .select('key, value')
      .in('key', ['resource_hub_categories', 'resource_hub_document_types'])

    if (settingsError) {
      console.error('Error fetching resource hub config:', settingsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch resource hub configuration'
      }, { status: 500 })
    }

    // Parse the data
    let categories = []
    let documentTypes = []

    if (settingsData) {
      console.log('📦 Settings data received from DB:', settingsData)
      for (const setting of settingsData) {
        console.log(`🔍 Processing setting: key=${setting.key}, value=${setting.value}`)
        if (setting.key === 'resource_hub_categories') {
          try {
            console.log('📝 Raw categories value:', setting.value)
            console.log('📝 Raw categories value length:', setting.value?.length)
            const parsed = JSON.parse(setting.value)
            if (Array.isArray(parsed)) {
              categories = parsed
            } else if (typeof parsed === 'object' && parsed !== null) {
              // 🔥 CRITICAL: Convert object format {id: {label, emoji, color}, ...} to array format
              categories = Object.entries(parsed).map(([id, data]: [string, any]) => ({
                id,
                label: data.label || '',
                emoji: data.emoji || '',
                color: data.color || ''
              }))
              console.log('🔄 Converted categories from object format to array format:', { originalKeys: Object.keys(parsed), convertedCount: categories.length })
            } else {
              categories = []
            }
            console.log('✅ Parsed categories:', { count: categories.length, data: JSON.stringify(categories, null, 2) })
          } catch (e) {
            console.error('❌ Error parsing categories:', e, 'raw value:', setting.value)
          }
        } else if (setting.key === 'resource_hub_document_types') {
          try {
            console.log('📝 Raw document types value:', setting.value)
            console.log('📝 Raw document types value length:', setting.value?.length)
            const parsed = JSON.parse(setting.value)
            if (Array.isArray(parsed)) {
              documentTypes = parsed
            } else if (typeof parsed === 'object' && parsed !== null) {
              // 🔥 CRITICAL: Convert object format {id: {label, color}, ...} to array format
              documentTypes = Object.entries(parsed).map(([id, data]: [string, any]) => ({
                id,
                label: data.label || '',
                color: data.color || ''
              }))
              console.log('🔄 Converted document types from object format to array format:', { originalKeys: Object.keys(parsed), convertedCount: documentTypes.length })
            } else {
              documentTypes = []
            }
            console.log('✅ Parsed document types:', { count: documentTypes.length, data: JSON.stringify(documentTypes, null, 2) })
          } catch (e) {
            console.error('❌ Error parsing document types:', e, 'raw value:', setting.value)
          }
        }
      }
    } else {
      console.warn('⚠️ No settings data returned from database')
    }

    console.log('📦 API Response - Categories:', categories.length, 'Types:', documentTypes.length)
    console.log('📦 Final response payload:', JSON.stringify({
      success: true,
      data: {
        categories,
        documentTypes
      }
    }, null, 2))

    // 🔥 CRITICAL: Disable caching to ensure real-time data updates for all users
    const response = NextResponse.json({
      success: true,
      data: {
        categories,
        documentTypes
      }
    })
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    console.log('✅ Response headers set, returning response')
    return response
  } catch (error) {
    console.error('Get resource hub config error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch resource hub configuration'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Only admin users can modify resource hub config
    if (user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Admin access required'
      }, { status: 403 })
    }

    const body = await request.json()
    const { categories, documentTypes } = body

    // Validate input
    if (!Array.isArray(categories) || !Array.isArray(documentTypes)) {
      return NextResponse.json({
        success: false,
        error: 'Both categories and documentTypes must be arrays'
      }, { status: 400 })
    }

    // Validate categories structure
    for (const cat of categories) {
      if (!cat.id || !cat.label) {
        return NextResponse.json({
          success: false,
          error: 'Each category must have id and label'
        }, { status: 400 })
      }
    }

    // Validate document types structure
    for (const type of documentTypes) {
      if (!type.id || !type.label) {
        return NextResponse.json({
          success: false,
          error: 'Each document type must have id and label'
        }, { status: 400 })
      }
    }

    // Update categories
    const { error: categoriesError } = await supabaseServer
      .from('system_settings')
      .upsert(
        {
          key: 'resource_hub_categories',
          value: JSON.stringify(categories),
          description: 'Resource Hub document categories',
          data_type: 'json',
          is_public: false
        },
        { onConflict: 'key' }
      )

    if (categoriesError) {
      console.error('Error updating categories:', categoriesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update categories'
      }, { status: 500 })
    }

    // Update document types
    const { error: typesError } = await supabaseServer
      .from('system_settings')
      .upsert(
        {
          key: 'resource_hub_document_types',
          value: JSON.stringify(documentTypes),
          description: 'Resource Hub document types',
          data_type: 'json',
          is_public: false
        },
        { onConflict: 'key' }
      )

    if (typesError) {
      console.error('Error updating document types:', typesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update document types'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Resource Hub configuration updated successfully'
    })
  } catch (error) {
    console.error('Update resource hub config error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update resource hub configuration'
    }, { status: 500 })
  }
}