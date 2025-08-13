import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth-middleware'

// Australian public holidays API endpoint
const AUSTRALIAN_HOLIDAYS_API = 'https://date.nager.at/api/v3/PublicHolidays'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()
    const { 
      year = new Date().getFullYear(),
      source = 'api',
      csvData,
      region = 'AU',
      overwrite = false 
    } = body

    let holidays: any[] = []

    if (source === 'api') {
      // Fetch from Australian public holidays API
      holidays = await fetchHolidaysFromAPI(year, region)
    } else if (source === 'csv' && csvData) {
      // Parse CSV data
      holidays = parseCSVHolidays(csvData)
    } else {
      return NextResponse.json({ error: 'Invalid source or missing data' }, { status: 400 })
    }

    if (holidays.length === 0) {
      return NextResponse.json({ error: 'No holidays found to import' }, { status: 400 })
    }

    // If overwrite is true, delete existing holidays for the year
    if (overwrite) {
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      
      const { error: deleteError } = await supabase
        .from('public_holidays')
        .delete()
        .gte('date', yearStart)
        .lte('date', yearEnd)

      if (deleteError) {
        console.error('Error deleting existing holidays:', deleteError)
        return NextResponse.json({ error: 'Failed to clear existing holidays' }, { status: 500 })
      }
    }

    // Insert new holidays
    const { data: insertedHolidays, error: insertError } = await supabase
      .from('public_holidays')
      .upsert(holidays, { onConflict: 'date' })
      .select()

    if (insertError) {
      console.error('Error inserting holidays:', insertError)
      return NextResponse.json({ error: 'Failed to import holidays' }, { status: 500 })
    }

    // Log the import action
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert([{
        task_instance_id: null,
        user_id: user.id,
        action: 'holiday_sync',
        old_values: null,
        new_values: null,
        metadata: {
          source,
          year,
          region,
          overwrite,
          imported_count: insertedHolidays?.length || 0,
          timestamp: new Date().toISOString()
        }
      }])

    if (auditError) {
      console.error('Error logging holiday sync:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${insertedHolidays?.length || 0} holidays`,
      imported: insertedHolidays?.length || 0,
      holidays: insertedHolidays
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Admin access')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchHolidaysFromAPI(year: number, region: string): Promise<any[]> {
  try {
    const response = await fetch(`${AUSTRALIAN_HOLIDAYS_API}/${year}/${region}`)
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const apiHolidays = await response.json()
    
    return apiHolidays.map((holiday: any) => ({
      date: holiday.date,
      name: holiday.name,
      region: region,
      source: 'api'
    }))
  } catch (error) {
    console.error('Error fetching holidays from API:', error)
    throw new Error('Failed to fetch holidays from external API')
  }
}

function parseCSVHolidays(csvData: string): any[] {
  try {
    const lines = csvData.trim().split('\n')
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    
    // Expected headers: date, name, region (optional)
    const dateIndex = headers.findIndex(h => h.includes('date'))
    const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('title'))
    const regionIndex = headers.findIndex(h => h.includes('region') || h.includes('state'))

    if (dateIndex === -1 || nameIndex === -1) {
      throw new Error('CSV must contain date and name columns')
    }

    const holidays = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      
      if (values.length < Math.max(dateIndex, nameIndex) + 1) {
        continue // Skip invalid rows
      }

      const dateStr = values[dateIndex]
      const name = values[nameIndex]
      const region = regionIndex >= 0 ? values[regionIndex] : 'AU'

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        console.warn(`Invalid date format: ${dateStr}`)
        continue
      }

      holidays.push({
        date: dateStr,
        name: name,
        region: region,
        source: 'csv'
      })
    }

    return holidays
  } catch (error) {
    console.error('Error parsing CSV:', error)
    throw new Error('Failed to parse CSV data')
  }
}

// GET endpoint to check available years and regions
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'available-years') {
      // Return available years (current year ± 2)
      const currentYear = new Date().getFullYear()
      const availableYears = []
      
      for (let year = currentYear - 2; year <= currentYear + 2; year++) {
        availableYears.push(year)
      }

      return NextResponse.json({ availableYears })
    }

    if (action === 'regions') {
      // Return supported regions
      const regions = [
        { code: 'AU', name: 'Australia (National)' },
        { code: 'AU-NSW', name: 'New South Wales' },
        { code: 'AU-VIC', name: 'Victoria' },
        { code: 'AU-QLD', name: 'Queensland' },
        { code: 'AU-WA', name: 'Western Australia' },
        { code: 'AU-SA', name: 'South Australia' },
        { code: 'AU-TAS', name: 'Tasmania' },
        { code: 'AU-ACT', name: 'Australian Capital Territory' },
        { code: 'AU-NT', name: 'Northern Territory' }
      ]

      return NextResponse.json({ regions })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Admin access')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}