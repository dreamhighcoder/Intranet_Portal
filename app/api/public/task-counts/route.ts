import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSearchOptions, filterTasksByResponsibility } from '@/lib/responsibility-mapper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const positionId = searchParams.get('position_id')
    const responsibility = searchParams.get('responsibility')

    // Check if it's a holiday first
    let isHoliday = false
    let holidayName = null
    
    try {
      const { data: holiday, error: holidayError } = await supabaseAdmin
        .from('public_holidays')
        .select('*')
        .eq('date', date)
        .maybeSingle()

      if (!holidayError && holiday) {
        isHoliday = true
        holidayName = holiday.name
        
        return NextResponse.json({
          success: true,
          data: {
            total: 0,
            newSinceNine: 0,
            dueToday: 0,
            overdue: 0,
            completed: 0,
            isHoliday: true,
            holidayName: holiday.name
          }
        })
      }
    } catch (holidayError) {
      console.warn('Holiday check failed:', holidayError)
      // Continue with normal processing
    }

    // Virtual model: compute counts directly from master_tasks using recurrence engine
    // Build base query for master_tasks
    const searchRoles = responsibility ? getSearchOptions(responsibility) : null

    let query = supabaseAdmin
      .from('master_tasks')
      .select(`
        id,
        title,
        position_id,
        responsibility,
        publish_status,
        publish_delay,
        due_time,
        created_at,
        frequency_rules,
        start_date,
        end_date
      `)
      .eq('publish_status', 'active')
      .or(`publish_delay.is.null,publish_delay.lte.${date}`)

    if (positionId) {
      query = query.eq('position_id', positionId)
    }

    if (searchRoles) {
      query = query.overlaps('responsibility', searchRoles)
    }

    const { data: masterTasks, error } = await query

    if (error) {
      console.error('Error fetching master tasks:', error)
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          newSinceNine: 0,
          dueToday: 0,
          overdue: 0,
          completed: 0,
          isHoliday: false,
          holidayName: null
        }
      })
    }

    // Post-filter tasks based on responsibility rules
    const roleFiltered = responsibility 
      ? filterTasksByResponsibility(
          (masterTasks || []).map((t: any) => ({ ...t, responsibility: t.responsibility || [] })),
          responsibility
        )
      : (masterTasks || [])

    // Fetch holidays and create recurrence engine
    const { data: holidays } = await supabaseAdmin
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true })

    const { createRecurrenceEngine } = await import('@/lib/recurrence-engine')
    const { createHolidayHelper } = await import('@/lib/public-holidays')
    const holidayHelper = createHolidayHelper(holidays || [])
    const recurrenceEngine = createRecurrenceEngine(holidayHelper)

    // Determine which tasks are due today via recurrence rules
    const dateObj = new Date(date)
    const dueTodayTasks = roleFiltered.filter((task: any) => {
      try {
        const taskForRecurrence = {
          id: task.id,
          frequency_rules: task.frequency_rules || {},
          start_date: task.start_date || task.created_at?.split('T')[0],
          end_date: task.end_date
        }
        return recurrenceEngine.isDueOnDate(taskForRecurrence, dateObj)
      } catch (e) {
        console.warn('Recurrence check failed for task', task.id, e)
        return false
      }
    })

    // Calculate counts (virtual model, no persisted completion yet)
    const now = new Date()
    const nineAM = new Date(`${date}T09:00:00`)

    const counts = {
      total: dueTodayTasks.length,
      newSinceNine: 0,
      dueToday: dueTodayTasks.length,
      overdue: 0,
      completed: 0,
      isHoliday: false,
      holidayName: null
    }

    dueTodayTasks.forEach((task: any) => {
      // Overdue: has due_time and now past due time (for today)
      if (task.due_time) {
        const dueTime = new Date(`${date}T${task.due_time}`)
        if (now > dueTime) counts.overdue++
      }

      // Approximate "new since 9AM": created_after_9am OR publish_delay equals today
      const createdAt = task.created_at ? new Date(task.created_at) : null
      if ((createdAt && createdAt >= nineAM) || task.publish_delay === date) {
        counts.newSinceNine++
      }
    })

    return NextResponse.json({
      success: true,
      data: counts
    })
  } catch (error) {
    console.error('Public task counts API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}