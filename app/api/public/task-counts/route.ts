import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    let query = supabaseAdmin
      .from('task_instances')
      .select(`
        id,
        status,
        due_time,
        created_at,
        completed_at,
        master_tasks!inner (
          id,
          title,
          position_id,
          responsibility,
          publish_status
        )
      `)
      .eq('due_date', date)

    // Filter by position if provided
    if (positionId) {
      query = query.eq('master_tasks.position_id', positionId)
    }

    // Filter by responsibility if provided
    if (responsibility) {
      // Use overlaps to check if any of the values in the responsibility array match
      // Include both legacy format and new kebab-case format
      query = query.overlaps('master_tasks.responsibility', [
        responsibility, 
        'shared-inc-pharmacist', 
        'shared-exc-pharmacist',
        // Legacy format for backward compatibility
        'Shared (inc. Pharmacist)', 
        'Shared (exc. Pharmacist)'
      ])
    }

    // Only show published tasks
    query = query.eq('master_tasks.publish_status', 'active')

    const { data: taskInstances, error } = await query

    if (error) {
      console.error('Error fetching task instances:', error)
      // Return empty counts instead of error for public API
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
    
    // Filter tasks based on responsibility rules
    const filteredTaskInstances = responsibility ? taskInstances.filter((task: any) => {
      const taskResponsibility = task.master_tasks?.responsibility || [];
      
      // Check if the task is directly assigned to this role
      if (taskResponsibility.includes(responsibility)) {
        return true;
      }
      
      // Handle shared responsibilities (both legacy and new format)
      const isPharmacistRole = responsibility.toLowerCase().includes('pharmacist');
      
      // If task is shared including pharmacists, only show to pharmacist roles
      if (taskResponsibility.includes('shared-inc-pharmacist') || 
          taskResponsibility.includes('Shared (inc. Pharmacist)')) {
        return isPharmacistRole;
      }
      
      // If task is shared excluding pharmacists, only show to non-pharmacist roles
      if (taskResponsibility.includes('shared-exc-pharmacist') || 
          taskResponsibility.includes('Shared (exc. Pharmacist)')) {
        return !isPharmacistRole;
      }
      
      return false;
    }) : taskInstances;

    // Calculate counts
    const now = new Date()
    const nineAM = new Date()
    nineAM.setHours(9, 0, 0, 0)
    
    const counts = {
      total: filteredTaskInstances?.length || 0,
      newSinceNine: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0,
      isHoliday: false,
      holidayName: null
    }

    filteredTaskInstances?.forEach((task: any) => {
      // Count completed tasks
      if (task.status === 'done') {
        counts.completed++
      }
      
      // Count tasks due today (not completed)
      if (task.status !== 'done') {
        counts.dueToday++
        
        // Check if overdue (past due time on today's date)
        if (task.due_time) {
          const dueTime = new Date(`${date}T${task.due_time}`)
          if (now > dueTime) {
            counts.overdue++
          }
        }
        
        // Count new tasks since 9 AM (created or appeared after 9 AM)
        const taskCreatedAt = new Date(task.created_at)
        if (taskCreatedAt > nineAM) {
          counts.newSinceNine++
        }
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