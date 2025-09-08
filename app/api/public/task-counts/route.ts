import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSearchOptions, filterTasksByResponsibility } from '@/lib/responsibility-mapper'
import { getAustralianToday, createAustralianDateTime, fromAustralianTime } from '@/lib/timezone-utils'
import { getSystemSettings } from '@/lib/system-settings'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || getAustralianToday()
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

    // Use existing task_instances table instead of computing from master_tasks
    // This works with the current database schema
    const searchRoles = responsibility ? getSearchOptions(responsibility) : null

    // Get task instances for the specified date
    let query = supabaseAdmin
      .from('task_instances')
      .select(`
        id,
        status,
        due_date,
        due_time,
        created_at,
        completed_at,
        master_tasks!inner(
          id,
          title,
          responsibility,
          publish_status
        )
      `)
      .eq('instance_date', date)
      .eq('master_tasks.publish_status', 'active')

    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    }

    if (searchRoles) {
      query = query.overlaps('master_tasks.responsibility', searchRoles)
    }

    const { data: taskInstances, error } = await query

    if (error) {
      console.error('Error fetching task instances:', error)
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
          (taskInstances || []).map((t: any) => ({ 
            ...t, 
            responsibility: t.master_tasks?.responsibility || [] 
          })),
          responsibility
        )
      : (taskInstances || [])

    // Calculate counts from actual task instances
    // Compute boundaries in Australia/Sydney but compare in UTC (DB stores UTC)
    const settings = await getSystemSettings()
    const newTaskHourAus = createAustralianDateTime(date, settings.new_since_hour)
    const nineAmUtc = fromAustralianTime(newTaskHourAus)
    const nowUtc = new Date()

    const counts = {
      total: roleFiltered.length,
      newSinceNine: 0,
      dueToday: roleFiltered.length,
      overdue: 0,
      completed: 0,
      isHoliday: false,
      holidayName: null
    }

    roleFiltered.forEach((instance: any) => {
      // Count completed tasks
      if (instance.status === 'completed') {
        counts.completed++
      }

      // Count overdue tasks: has due_time and now past due time
      if (instance.due_time && instance.status !== 'completed') {
        const dueAus = createAustralianDateTime(date, instance.due_time)
        const dueUtc = fromAustralianTime(dueAus)
        if (nowUtc > dueUtc) {
          counts.overdue++
        }
      }

      // Count new tasks since system new task hour: created after new task hour today (created_at stored UTC)
      const createdUtc = instance.created_at ? new Date(instance.created_at) : null
      if (createdUtc && createdUtc >= nineAmUtc && instance.status !== 'completed') {
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