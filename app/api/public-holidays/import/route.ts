import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Sample Australian public holidays for the current year
const getAustralianHolidays = (year: number) => [
  { date: `${year}-01-01`, name: "New Year's Day", region: 'National', source: 'data.gov.au' },
  { date: `${year}-01-26`, name: "Australia Day", region: 'National', source: 'data.gov.au' },
  { date: `${year}-04-25`, name: "Anzac Day", region: 'National', source: 'data.gov.au' },
  { date: `${year}-12-25`, name: "Christmas Day", region: 'National', source: 'data.gov.au' },
  { date: `${year}-12-26`, name: "Boxing Day", region: 'National', source: 'data.gov.au' },
  // Add Easter dates (simplified - in real implementation you'd calculate these)
  ...(year === 2024 ? [
    { date: '2024-03-29', name: 'Good Friday', region: 'National', source: 'data.gov.au' },
    { date: '2024-03-30', name: 'Easter Saturday', region: 'Most States', source: 'data.gov.au' },
    { date: '2024-04-01', name: 'Easter Monday', region: 'National', source: 'data.gov.au' },
    { date: '2024-06-10', name: "King's Birthday", region: 'Most States', source: 'data.gov.au' },
    { date: '2024-10-07', name: 'Labour Day', region: 'NSW', source: 'data.gov.au' },
  ] : []),
  ...(year === 2025 ? [
    { date: '2025-04-18', name: 'Good Friday', region: 'National', source: 'data.gov.au' },
    { date: '2025-04-19', name: 'Easter Saturday', region: 'Most States', source: 'data.gov.au' },
    { date: '2025-04-21', name: 'Easter Monday', region: 'National', source: 'data.gov.au' },
    { date: '2025-06-09', name: "King's Birthday", region: 'Most States', source: 'data.gov.au' },
    { date: '2025-10-06', name: 'Labour Day', region: 'NSW', source: 'data.gov.au' },
  ] : [])
]

export async function POST(request: NextRequest) {
  try {
    console.log('Public Holidays Import - Starting import process')
    
    // Authenticate the user
    const user = await requireAuth(request)
    console.log('Public Holidays Import - User authenticated:', user.id, user.role)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    const { year, region } = body
    console.log('Public Holidays Import - Request params:', { year, region })
    
    const currentYear = year || new Date().getFullYear()
    const holidays = getAustralianHolidays(currentYear)
    console.log('Public Holidays Import - Total holidays available:', holidays.length)
    
    // Filter by region if specified
    const filteredHolidays = region 
      ? holidays.filter(h => {
          // For NSW, include National and Most States holidays
          if (region === 'NSW') {
            return h.region === 'National' || h.region === 'Most States' || h.region === 'NSW'
          }
          // For other regions, include National and exact region match
          return h.region === 'National' || h.region === region
        })
      : holidays
    
    console.log('Public Holidays Import - Filtered holidays:', filteredHolidays.length)
    console.log('Public Holidays Import - Holidays to process:', filteredHolidays.map(h => ({ date: h.date, name: h.name, region: h.region })))
    
    let imported = 0
    let skipped = 0
    
    for (const holiday of filteredHolidays) {
      try {
        // Check if holiday already exists
        const { data: existing } = await supabase
          .from('public_holidays')
          .select('date')
          .eq('date', holiday.date)
          .single()
        
        if (existing) {
          skipped++
          continue
        }
        
        // Insert new holiday
        const { error } = await supabase
          .from('public_holidays')
          .insert([holiday])
        
        if (error) {
          console.error('Error inserting holiday:', holiday.date, error)
        } else {
          imported++
        }
      } catch (error) {
        console.error('Error processing holiday:', holiday.date, error)
      }
    }
    
    console.log('Public Holidays Import - Import completed:', { imported, skipped })
    
    return NextResponse.json({
      success: true,
      imported,
      skipped,
      message: `Imported ${imported} holidays, skipped ${skipped} existing holidays`
    })
    
  } catch (error) {
    console.error('Error importing holidays:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to import holidays' },
      { status: 500 }
    )
  }
}