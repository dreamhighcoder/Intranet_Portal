import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth-middleware'
import { getResponsibilityForPosition } from '@/lib/position-utils'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { position_id } = body

    if (!position_id) {
      return NextResponse.json({ error: 'Position ID is required' }, { status: 400 })
    }

    // Check if user can access this position
    if (user.role !== 'admin' && user.position_id !== position_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get all tasks for this position that are due today or overdue
    const today = new Date().toISOString().split('T')[0]
    
    const responsibilityValue = await getResponsibilityForPosition(position_id)
    
    let query = supabase
      .from('task_instances')
      .select(`
        id,
        status,
        due_date,
        master_tasks!inner (
          responsibility
        )
      `)
      .lte('due_date', today)
      .in('status', ['not_due', 'due_today', 'overdue'])
    
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
    
    const { data: incompleteTasks, error } = await query

    if (error) {
      console.error('Error checking incomplete tasks:', error)
      return NextResponse.json({ error: 'Failed to check task completion status' }, { status: 500 })
    }

    const hasIncompleteTasks = (incompleteTasks || []).length > 0

    // If all tasks are complete, user can be logged out
    const canLogout = !hasIncompleteTasks

    return NextResponse.json({
      canLogout,
      incompleteTasksCount: incompleteTasks?.length || 0,
      message: canLogout 
        ? 'All tasks completed. Auto-logout available.' 
        : `${incompleteTasks?.length || 0} tasks still pending completion.`
    })

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Endpoint to trigger auto-logout after task completion
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { position_id, force_logout = false } = body

    if (!position_id) {
      return NextResponse.json({ error: 'Position ID is required' }, { status: 400 })
    }

    // Check if user can access this position
    if (user.role !== 'admin' && user.position_id !== position_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let shouldLogout = force_logout

    if (!force_logout) {
      // Check if all tasks are completed
      const today = new Date().toISOString().split('T')[0]
      
      const responsibilityValue = await getResponsibilityForPosition(position_id)
      
      let query = supabase
        .from('task_instances')
        .select('id')
        .lte('due_date', today)
        .in('status', ['not_due', 'due_today', 'overdue'])
      
      if (responsibilityValue) {
        query = query.contains('master_tasks.responsibility', [responsibilityValue])
      }
      
      const { data: incompleteTasks, error } = await query

      if (error) {
        console.error('Error checking incomplete tasks:', error)
        return NextResponse.json({ error: 'Failed to check task completion status' }, { status: 500 })
      }

      shouldLogout = (incompleteTasks || []).length === 0
    }

    if (shouldLogout) {
      // Log the auto-logout event
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          task_instance_id: null, // No specific task for logout
          user_id: user.id,
          action: 'auto_logout',
          old_values: null,
          new_values: null,
          metadata: {
            position_id,
            logout_reason: force_logout ? 'forced' : 'all_tasks_completed',
            timestamp: new Date().toISOString()
          }
        }])

      if (auditError) {
        console.error('Error logging auto-logout:', auditError)
      }

      // Sign out the user
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('Error signing out user:', signOutError)
        return NextResponse.json({ error: 'Failed to sign out user' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'User logged out successfully',
        reason: force_logout ? 'forced' : 'all_tasks_completed'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Cannot logout - tasks still pending completion'
      })
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}