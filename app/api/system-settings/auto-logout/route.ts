import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: Fetching auto-logout settings from database...')
    
    // Use server-side client which bypasses RLS
    const { data, error } = await supabaseServer
      .from('system_settings')
      .select('key, value, data_type')
      .in('key', ['auto_logout_enabled', 'auto_logout_delay_seconds'])
    
    console.log('📊 API: Database query result:', { error, data })
    
    if (error) {
      console.error('❌ API: Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error.message },
        { status: 500 }
      )
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ API: No auto-logout settings found in database')
      return NextResponse.json(
        { error: 'No auto-logout settings found' },
        { status: 404 }
      )
    }
    
    // Parse the settings
    let enabled = true // default
    let delaySeconds = 120 // default
    
    data.forEach(row => {
      if (row.key === 'auto_logout_enabled') {
        enabled = row.value.toLowerCase() === 'true'
      } else if (row.key === 'auto_logout_delay_seconds') {
        delaySeconds = parseInt(row.value, 10)
      }
    })
    
    const delayMinutes = Math.round(delaySeconds / 60)
    
    const result = {
      enabled,
      delaySeconds,
      delayMinutes,
      rawData: data
    }
    
    console.log('✅ API: Returning auto-logout settings:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}