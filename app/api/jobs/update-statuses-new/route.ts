/**
 * New Task Status Update API Endpoint
 * Uses the new recurrence engine for precise status management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createNewTaskGenerator } from '@/lib/new-task-generator'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      date, 
      testMode = false,
      maxInstances
    } = body

    // Use today's date if not provided
    const targetDate = date || new Date().toISOString().split('T')[0]

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(targetDate)) {
      return NextResponse.json(
        { success: false, error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Create task generator with integrated engine
    const generator = await createNewTaskGenerator()

    // Update statuses
    const result = await generator.updateStatusesForDate({
      date: targetDate,
      testMode,
      maxInstances
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const testMode = searchParams.get('testMode') === 'true'
    const maxInstances = searchParams.get('maxInstances') ? parseInt(searchParams.get('maxInstances')!) : undefined

    // Use today's date if not provided
    const targetDate = date || new Date().toISOString().split('T')[0]

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(targetDate)) {
      return NextResponse.json(
        { success: false, error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Create task generator
    const generator = await createNewTaskGenerator()

    // Update statuses
    const result = await generator.updateStatusesForDate({
      date: targetDate,
      testMode,
      maxInstances
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}