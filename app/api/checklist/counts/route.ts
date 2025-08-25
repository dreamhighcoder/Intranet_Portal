import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getTasksForRoleOnDate } from '@/lib/db'
import { TaskRecurrenceEngine } from '@/lib/task-recurrence-engine'
import { getHolidayChecker } from '@/lib/holiday-checker-adapter'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import { getAustralianNow, createAustralianDateTime } from '@/lib/timezone-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role')
    const date = searchParams.get('date')
    
    // Validate query parameters using Zod schema
    const validationResult = ChecklistQuerySchema.safeParse({ role, date })
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters',
        details: validationResult.error.errors
      }, { status: 400 })
    }
    
    const { role: validatedRole, date: validatedDate } = validationResult.data
    
    // Get tasks for the role on the specified date
    const { data: tasks, error } = await getTasksForRoleOnDate(validatedRole, validatedDate)
    
    if (error) {
      console.error('Error fetching tasks for role:', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }
    
    console.log(`DEBUG: Found ${tasks.length} tasks for role '${validatedRole}' on date '${validatedDate}'`)
    
    // Get holiday checker and create recurrence engine
    const holidayChecker = await getHolidayChecker()
    const recurrenceEngine = new TaskRecurrenceEngine({ holidayChecker })
    
    // Filter tasks that should appear on this date using the comprehensive recurrence engine
    const filteredTasks = tasks.filter(task => {
      try {
        // Convert task to the format expected by recurrence engine
        const masterTask = {
          id: task.id,
          title: task.title,
          responsibility: task.responsibility || [],
          frequencies: task.frequencies || [],
          categories: task.categories || [],
          timing: task.timing as any || 'anytime_during_day',
          due_time: task.due_time,
          publish_delay_date: task.publish_delay_date,
          publish_status: task.publish_status as any || 'active',
          due_date: task.due_date
        }
        
        return recurrenceEngine.shouldTaskAppear(masterTask, validatedDate)
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        // If there's an error with recurrence calculation, include the task
        return true
      }
    })
    
    console.log(`DEBUG: After recurrence filtering: ${filteredTasks.length} tasks should appear`)
    
    // Get existing checklist instances for this role and date
    const { data: instances, error: instancesError } = await supabaseServer
      .from('checklist_instances')
      .select('*')
      .eq('role', validatedRole)
      .eq('date', validatedDate)
    
    if (instancesError) {
      console.error('Error fetching checklist instances:', instancesError)
    }
    
    // Create a map of existing instances by master_task_id
    const instanceMap = new Map()
    if (instances) {
      instances.forEach(instance => {
        instanceMap.set(instance.master_task_id, instance)
      })
    }
    
    // Calculate task counts using Australian timezone
    const now = getAustralianNow()
    const nineAM = createAustralianDateTime(validatedDate, '09:00')
    
    const counts = {
      total: 0,
      newSinceNine: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0
    }
    
    filteredTasks.forEach(task => {
      const instance = instanceMap.get(task.id)
      const isCompleted = instance?.status === 'completed'
      
      counts.total++
      
      if (isCompleted) {
        counts.completed++
      } else {
        // Convert task to master task format for due time calculation
        const masterTask = {
          id: task.id,
          title: task.title,
          responsibility: task.responsibility || [],
          frequencies: task.frequencies || [],
          categories: task.categories || [],
          timing: task.timing as any || 'anytime_during_day',
          due_time: task.due_time,
          publish_delay_date: task.publish_delay_date,
          publish_status: task.publish_status as any || 'active',
          due_date: task.due_date
        }
        
        // Calculate due time using recurrence engine
        const dueTime = recurrenceEngine.calculateDueTime(masterTask)
        const dueDateTime = createAustralianDateTime(validatedDate, dueTime)
        
        // Check if task is due today
        if (validatedDate === now.toISOString().split('T')[0]) {
          counts.dueToday++
          
          // Check if overdue
          if (now > dueDateTime) {
            counts.overdue++
          }
        }
        
        // Check if task was created since 9 AM
        const taskCreatedAt = instance?.created_at ? new Date(instance.created_at) : now
        if (taskCreatedAt > nineAM) {
          counts.newSinceNine++
        }
      }
    })
    
    // Get total master tasks count for metadata
    const { count: totalMasterTasks } = await supabaseServer
      .from('master_tasks')
      .select('*', { count: 'exact', head: true })
      .overlaps('responsibility', [validatedRole])
      .eq('publish_status', 'active')
    
    // Check if today is a holiday
    const isHoliday = holidayChecker.isHoliday(validatedDate)
    
    return NextResponse.json({
      success: true,
      data: counts,
      meta: {
        role: validatedRole,
        date: validatedDate,
        total_master_tasks: totalMasterTasks || 0,
        is_holiday: isHoliday
      }
    })
    
  } catch (error) {
    console.error('Checklist counts API error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}