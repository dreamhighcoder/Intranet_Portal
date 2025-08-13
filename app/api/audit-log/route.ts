import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const taskInstanceId = searchParams.get('task_instance_id')
    const userId = searchParams.get('user_id')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('audit_log')
      .select(`
        *,
        user_profiles (
          display_name,
          positions (
            name
          )
        ),
        task_instances (
          id,
          master_tasks (
            title
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (taskInstanceId) {
      query = query.eq('task_instance_id', taskInstanceId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (action) {
      query = query.eq('action', action)
    }

    const { data: auditLogs, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
    }

    return NextResponse.json(auditLogs || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      task_instance_id,
      user_id,
      action,
      old_values,
      new_values,
      metadata
    } = body

    if (!task_instance_id || !user_id || !action) {
      return NextResponse.json({ 
        error: 'task_instance_id, user_id, and action are required' 
      }, { status: 400 })
    }

    const { data: auditLog, error } = await supabase
      .from('audit_log')
      .insert([{
        task_instance_id,
        user_id,
        action,
        old_values,
        new_values,
        metadata
      }])
      .select(`
        *,
        user_profiles (
          display_name,
          positions (
            name
          )
        ),
        task_instances (
          id,
          master_tasks (
            title
          )
        )
      `)
      .single()

    if (error) {
      console.error('Error creating audit log:', error)
      return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 })
    }

    return NextResponse.json(auditLog, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}