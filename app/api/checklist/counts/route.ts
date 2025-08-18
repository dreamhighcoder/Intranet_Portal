import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTasksForRoleOnDate } from '@/lib/db'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'

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
    
    // Create holiday helper and recurrence engine for filtering
    // Fetch holidays from database and create helper
    const { data: holidays, error: holidaysError } = await supabase
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true })

    if (holidaysError) {
      console.error('Error fetching holidays:', holidaysError)
    }

    const holidayHelper = createHolidayHelper(holidays || [])
    const recurrenceEngine = createRecurrenceEngine(holidayHelper)
    
    // Check if the date is a public holiday - if so, return empty counts
    const targetDate = new Date(validatedDate)
    if (holidayHelper.isHoliday(targetDate)) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          newSinceNine: 0,
          dueToday: 0,
          overdue: 0,
          completed: 0
        },
        meta: {
          role: validatedRole,
          date: validatedDate,
          is_holiday: true
        }
      })
    }
    
    // Filter tasks based on recurrence rules and date
    const filteredTasks = tasks.filter(task => {
      try {
        // Check if the task is due on the specified date using recurrence engine
        const taskForRecurrence = {
          id: task.id,
          frequency_rules: task.frequency_rules || {},
          start_date: task.created_at,
          end_date: task.due_date
        }
        
        return recurrenceEngine.isDueOnDate(taskForRecurrence, new Date(validatedDate))
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        // If there's an error with recurrence calculation, include the task
        return true
      }
    })
    
    // Get existing checklist instances for this role and date
    const { data: instances, error: instancesError } = await supabase
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
    
    // Calculate task counts
    const now = new Date()
    const nineAM = new Date()
    nineAM.setHours(9, 0, 0, 0)
    
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
      
      // Count total tasks (all tasks that should appear today)
      counts.total++
      
      if (isCompleted) {
        counts.completed++
      } else {
        // Count tasks due today (not completed)
        counts.dueToday++
        
        // Check if overdue (past due time on today's date)
        if (task.due_time) {
          const dueTime = new Date(`${validatedDate}T${task.due_time}`)
          if (now > dueTime) {
            counts.overdue++
          }
        }
        
        // Count new tasks since 9 AM (created or appeared after 9 AM)
        // For this, we check if the instance was created today after 9 AM
        if (instance) {
          const instanceCreatedAt = new Date(instance.created_at)
          if (instanceCreatedAt > nineAM) {
            counts.newSinceNine++
          }
        } else {
          // If no instance exists, check if the master task was created today after 9 AM
          const taskCreatedAt = new Date(task.created_at)
          if (taskCreatedAt > nineAM) {
            counts.newSinceNine++
          }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: counts,
      meta: {
        role: validatedRole,
        date: validatedDate,
        total_master_tasks: filteredTasks.length,
        is_holiday: false
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