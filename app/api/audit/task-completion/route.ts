import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const taskInstanceId = searchParams.get('task_instance_id')
    const role = searchParams.get('role')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    let query = supabase
      .from('audit_log')
      .select(`
        id,
        task_instance_id,
        user_id,
        action,
        old_values,
        new_values,
        metadata,
        created_at,
        user_profiles!inner (
          id,
          display_name
        )
      `)
      .in('action', ['completed', 'uncompleted'])
      .order('created_at', { ascending: false })
      .limit(limit)
    
    // Apply filters
    if (taskInstanceId) {
      query = query.eq('task_instance_id', taskInstanceId)
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    
    const { data: auditLogs, error } = await query
    
    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
    }
    
    // If role filter is specified, we need to join with checklist instances to filter by role
    let filteredLogs = auditLogs || []
    
    if (role) {
      const taskInstanceIds = filteredLogs.map(log => log.task_instance_id)
      
      if (taskInstanceIds.length > 0) {
        const { data: instances } = await supabase
          .from('checklist_instances')
          .select('id, role')
          .in('id', taskInstanceIds)
          .eq('role', role)
        
        const roleInstanceIds = new Set(instances?.map(i => i.id) || [])
        filteredLogs = filteredLogs.filter(log => roleInstanceIds.has(log.task_instance_id))
      }
    }
    
    // Transform the data for better readability
    const transformedLogs = filteredLogs.map(log => ({
      id: log.id,
      task_instance_id: log.task_instance_id,
      user_id: log.user_id,
      user_name: log.user_profiles?.display_name || 'Unknown User',
      action: log.action,
      old_status: log.old_values?.status,
      new_status: log.new_values?.status,
      timestamp: log.created_at,
      metadata: log.metadata
    }))
    
    return NextResponse.json({
      success: true,
      data: transformedLogs,
      meta: {
        total: transformedLogs.length,
        limit,
        filters: {
          task_instance_id: taskInstanceId,
          role,
          start_date: startDate,
          end_date: endDate
        }
      }
    })
    
  } catch (error) {
    console.error('Audit API error:', error)
    
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

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const user = await requireAuth(request)
    
    const body = await request.json()
    const { 
      task_instance_id, 
      action, 
      old_values, 
      new_values, 
      metadata = {} 
    } = body
    
    // Validate required fields
    if (!task_instance_id || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: task_instance_id, action' 
      }, { status: 400 })
    }
    
    // Insert audit log entry
    const { data: auditLog, error } = await supabase
      .from('audit_log')
      .insert([{
        task_instance_id,
        user_id: user.id,
        action,
        old_values: old_values || {},
        new_values: new_values || {},
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          user_agent: request.headers.get('user-agent') || 'Unknown'
        }
      }])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating audit log:', error)
      return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: auditLog
    })
    
  } catch (error) {
    console.error('Audit creation error:', error)
    
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