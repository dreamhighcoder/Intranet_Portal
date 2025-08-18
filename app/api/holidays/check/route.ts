import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createHolidayHelper } from '@/lib/public-holidays'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json({ 
        error: 'Date parameter is required' 
      }, { status: 400 })
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }, { status: 400 })
    }
    
    // Fetch holidays from database
    const { data: holidays, error: holidaysError } = await supabase
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true })

    if (holidaysError) {
      console.error('Error fetching holidays:', holidaysError)
      return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
    }

    const holidayHelper = createHolidayHelper(holidays || [])
    const targetDate = new Date(date)
    const isHoliday = holidayHelper.isHoliday(targetDate)
    
    let holidayInfo = null
    if (isHoliday) {
      const holiday = holidays?.find(h => h.date === date)
      if (holiday) {
        holidayInfo = {
          name: holiday.name,
          region: holiday.region,
          source: holiday.source
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        date,
        is_holiday: isHoliday,
        holiday_info: holidayInfo,
        day_of_week: targetDate.toLocaleDateString('en-AU', { weekday: 'long' })
      }
    })
    
  } catch (error) {
    console.error('Holiday check API error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}