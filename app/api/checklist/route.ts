import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { supabase } from '@/lib/supabase'
import { getTasksForRoleOnDate } from '@/lib/db'
import { createRecurrenceEngine } from '@/lib/recurrence-engine'
import { createHolidayHelper } from '@/lib/public-holidays'
import { ChecklistQuerySchema } from '@/lib/validation-schemas'
import type { ChecklistInstanceStatus } from '@/types/checklist'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
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
    
    // Filter tasks based on recurrence rules and date
    const filteredTasks = tasks.filter(task => {
      try {
        // Check if the task is due on the specified date using recurrence engine
        const taskForRecurrence = {
          id: task.master_task_id,
          frequency_rules: task.master_tasks?.frequency_rules || {},
          start_date: task.master_tasks?.start_date,
          end_date: task.master_tasks?.end_date
        }
        
        return recurrenceEngine.isDueOnDate(taskForRecurrence, new Date(validatedDate))
      } catch (error) {
        console.error('Error checking task recurrence:', error)
        // If there's an error with recurrence calculation, include the task
        return true
      }
    })
    
    // Transform the data to match the expected checklist format
    const checklistData = filteredTasks.map(task => ({
      id: task.id,
      master_task_id: task.master_task_id,
      date: task.date,
      role: task.role,
      status: task.status as ChecklistInstanceStatus,
      completed_by: task.completed_by,
      completed_at: task.completed_at,
      payload: task.payload,
      notes: task.notes,
      created_at: task.created_at,
      updated_at: task.updated_at,
      master_task: {
        id: task.master_tasks?.id || task.master_task_id,
        title: task.master_tasks?.title || 'Unknown Task',
        description: task.master_tasks?.description,
        timing: task.master_tasks?.timing || 'morning',
        due_time: task.master_tasks?.due_time,
        responsibility: task.master_tasks?.responsibility || [role],
        categories: task.master_tasks?.categories || ['general'],
        frequency_rules: task.master_tasks?.frequency_rules || { type: 'daily' }
      }
    }))
    
    return NextResponse.json({
      success: true,
      data: checklistData,
      meta: {
        role: validatedRole,
        date: validatedDate,
        total_tasks: checklistData.length,
        completed_tasks: checklistData.filter(t => t.status === 'completed').length,
        pending_tasks: checklistData.filter(t => t.status === 'pending').length
      }
    })
    
  } catch (error) {
    console.error('Checklist API error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
