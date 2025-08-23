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
    { date: '2024-04-01', name: 'Easter Monday', region: 'National', source: 'data.gov.au' },
    { date: '2024-06-10', name: "Queen's Birthday", region: 'Most States', source: 'data.gov.au' },
  ] : []),
  ...(year === 2025 ? [
    { date: '2025-04-18', name: 'Good Friday', region: 'National', source: 'data.gov.au' },
    { date: '2025-04-21', name: 'Easter Monday', region: 'National', source: 'data.gov.au' },
    { date: '2025-06-09', name: "Queen's Birthday", region: 'Most States', source: 'data.gov.au' },
  ] : [])
]

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const user = await requireAuth(request)
    
    // Create admin Supabase client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await request.json()
    const { year, region } = body
    
    const currentYear = year || new Date().getFullYear()
    const holidays = getAustralianHolidays(currentYear)
    
    // Filter by region if specified
    const filteredHolidays = region 
      ? holidays.filter(h => h.region === region || h.region === 'National')
      : holidays
    
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