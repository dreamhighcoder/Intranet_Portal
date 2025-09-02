import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ExcelHolidayRow {
  'Public Holiday Name': string
  [year: string]: string // Dynamic year columns like "2025", "2026", etc.
}

interface ProcessedHoliday {
  date: string
  name: string
  region: string
  source: string
}

export async function POST(request: NextRequest) {
  console.log('Public Holidays Import - API route called')
  
  try {
    console.log('Public Holidays Import - Starting Excel file import process')
    
    // Skip authentication temporarily for debugging
    console.log('Public Holidays Import - Skipping authentication for debugging...')
    
    // Create admin Supabase client for database operations
    console.log('Public Holidays Import - Creating Supabase client...')
    console.log('Public Holidays Import - Supabase URL exists:', !!supabaseUrl)
    console.log('Public Holidays Import - Service key exists:', !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Public Holidays Import - Supabase client created successfully')
    
    // Parse the form data to get the uploaded file
    console.log('Public Holidays Import - Parsing form data...')
    const formData = await request.formData()
    console.log('Public Holidays Import - Form data parsed, entries:', Array.from(formData.entries()).map(([key, value]) => [key, typeof value, value instanceof File ? `File: ${value.name}` : value]))
    
    const file = formData.get('file') as File
    
    if (!file) {
      console.log('Public Holidays Import - No file found in form data')
      return NextResponse.json(
        { success: false, message: 'No file uploaded' },
        { status: 400 }
      )
    }
    
    console.log('Public Holidays Import - File received:', file.name, file.type, file.size)
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      )
    }
    
    // Read the file buffer
    console.log('Public Holidays Import - Reading file buffer...')
    const buffer = await file.arrayBuffer()
    console.log('Public Holidays Import - Buffer size:', buffer.byteLength)
    
    console.log('Public Holidays Import - Parsing Excel workbook...')
    const workbook = XLSX.read(buffer, { type: 'array' })
    console.log('Public Holidays Import - Workbook sheet names:', workbook.SheetNames)
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    console.log('Public Holidays Import - Using sheet:', sheetName)
    
    // Convert to JSON
    console.log('Public Holidays Import - Converting sheet to JSON...')
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelHolidayRow[]
    console.log('Public Holidays Import - Parsed Excel data:', jsonData.length, 'rows')
    console.log('Public Holidays Import - First row sample:', JSON.stringify(jsonData[0], null, 2))
    console.log('Public Holidays Import - All column names:', Object.keys(jsonData[0] || {}))
    
    if (jsonData.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No data found in Excel file' },
        { status: 400 }
      )
    }
    
    // Process the Excel data to extract holidays
    const processedHolidays: ProcessedHoliday[] = []
    
    console.log('Public Holidays Import - Starting to process', jsonData.length, 'rows')
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i]
      console.log(`Public Holidays Import - Row ${i + 1}:`, JSON.stringify(row, null, 2))
      
      const holidayName = row['Public Holiday Name']
      console.log('Public Holidays Import - Holiday name found:', holidayName)
      
      if (!holidayName) {
        console.log('Public Holidays Import - Skipping row - no holiday name')
        continue
      }
      
      // Extract region from holiday name if it contains region info
      let region = 'National'
      if (holidayName.includes('(South Only)')) {
        region = 'Tasmania South'
      } else if (holidayName.includes('(North Only)')) {
        region = 'Tasmania North'
      } else if (holidayName.includes('NSW')) {
        region = 'NSW'
      }
      
      // Process each year column
      console.log('Public Holidays Import - Processing year columns for:', holidayName)
      for (const [key, value] of Object.entries(row)) {
        console.log('Public Holidays Import - Checking column:', key, '=', value, 'type:', typeof value)
        
        if (key === 'Public Holiday Name') {
          console.log('Public Holidays Import - Skipping holiday name column')
          continue
        }
        
        if (!value) {
          console.log('Public Holidays Import - Skipping empty value for column:', key)
          continue
        }
        
        // Check if key is a year (4 digits)
        if (/^\d{4}$/.test(key)) {
          console.log('Public Holidays Import - Found year column:', key)
          const dateStr = value.toString()
          console.log('Public Holidays Import - Date string:', dateStr)
          
          // Parse the date - simplified for your format (01-Jan-25)
          let formattedDate: string
          
          console.log('Public Holidays Import - Processing date:', dateStr, 'for year:', key)
          
          try {
            if (dateStr.includes('T')) {
              // ISO format like "2025-01-01T00:00:00.000"
              formattedDate = dateStr.split('T')[0]
              console.log('Public Holidays Import - ISO format:', formattedDate)
            } else if (/^\d+$/.test(dateStr)) {
              // Excel serial number (like 45953)
              const serialNumber = parseInt(dateStr)
              console.log('Public Holidays Import - Excel serial number detected:', serialNumber)
              
              // Convert Excel serial number to JavaScript Date
              // Excel serial date starts from January 1, 1900
              // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
              const excelEpoch = new Date(1900, 0, 1) // January 1, 1900
              const jsDate = new Date(excelEpoch.getTime() + (serialNumber - 2) * 24 * 60 * 60 * 1000)
              
              console.log('Public Holidays Import - Converted to JS Date:', jsDate)
              
              // Format as YYYY-MM-DD
              const year = jsDate.getFullYear()
              const month = String(jsDate.getMonth() + 1).padStart(2, '0')
              const day = String(jsDate.getDate()).padStart(2, '0')
              formattedDate = `${year}-${month}-${day}`
              console.log('Public Holidays Import - Final formatted date:', formattedDate)
            } else {
              // For text format like "01-Jan-25", replace the 2-digit year with full year
              const yearRegex = /\b\d{2}$/
              let dateToProcess = dateStr
              
              if (yearRegex.test(dateStr)) {
                // Replace 2-digit year with 4-digit year from column header
                dateToProcess = dateStr.replace(yearRegex, key)
                console.log('Public Holidays Import - Modified date string:', dateToProcess)
              }
              
              // Parse the date
              const parsedDate = new Date(dateToProcess)
              
              if (isNaN(parsedDate.getTime())) {
                console.log('Public Holidays Import - Failed to parse date:', dateToProcess)
                continue
              }
              
              // Format as YYYY-MM-DD
              const year = parsedDate.getFullYear()
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
              const day = String(parsedDate.getDate()).padStart(2, '0')
              formattedDate = `${year}-${month}-${day}`
              console.log('Public Holidays Import - Final formatted date:', formattedDate)
            }
          } catch (error) {
            console.log('Public Holidays Import - Error parsing date:', dateStr, error)
            continue
          }
          
          // Validate the formatted date
          if (formattedDate && /^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
            
            processedHolidays.push({
              date: formattedDate,
              name: holidayName,
              region: region,
              source: 'excel_import'
            })
          }
        }
      }
    }
    
    console.log('Public Holidays Import - Processed holidays:', processedHolidays.length)
    
    if (processedHolidays.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid holiday data found in Excel file' },
        { status: 400 }
      )
    }
    
    let imported = 0
    let skipped = 0
    let errors = 0
    
    // Import holidays to database
    for (const holiday of processedHolidays) {
      try {
        // Check if holiday already exists (by date and region)
        const { data: existing } = await supabase
          .from('public_holidays')
          .select('date, region')
          .eq('date', holiday.date)
          .eq('region', holiday.region)
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
          console.error('Error inserting holiday:', holiday.date, holiday.name, error)
          errors++
        } else {
          imported++
        }
      } catch (error) {
        console.error('Error processing holiday:', holiday.date, holiday.name, error)
        errors++
      }
    }
    
    console.log('Public Holidays Import - Import completed:', { imported, skipped, errors })
    
    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      message: `Successfully imported ${imported} holidays, skipped ${skipped} existing holidays${errors > 0 ? `, ${errors} errors occurred` : ''}`
    })
    
  } catch (error) {
    console.error('Error importing holidays from Excel:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to import holidays from Excel file',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}