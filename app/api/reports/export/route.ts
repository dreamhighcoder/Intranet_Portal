import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getResponsibilityForPosition } from '@/lib/position-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const exportType = searchParams.get('type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const positionId = searchParams.get('position_id')
    const category = searchParams.get('category')

    let data: any[] = []
    let filename = 'export.csv'

    switch (exportType) {
      case 'tasks':
        const result = await exportTasks(startDate, endDate, positionId, category)
        data = result.data
        filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`
        break
      
      case 'audit-log':
        const auditResult = await exportAuditLog(startDate, endDate, positionId)
        data = auditResult.data
        filename = `audit_log_export_${new Date().toISOString().split('T')[0]}.csv`
        break
      
      case 'completion-summary':
        const summaryResult = await exportCompletionSummary(startDate, endDate, positionId, category)
        data = summaryResult.data
        filename = `completion_summary_${new Date().toISOString().split('T')[0]}.csv`
        break
      
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    const csv = convertToCSV(data)
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function exportTasks(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      completed_at,
      created_at,
      master_tasks (
        title,
        description,
        categories,
        frequencies,
        responsibility
      )
    `)
    .order('due_date', { ascending: false })

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category) query = query.contains('master_tasks.categories', [category])

  const { data: tasks, error } = await query

  if (error) {
    throw new Error('Failed to fetch tasks for export')
  }

  const exportData = (tasks || []).map(task => ({
    'Task ID': task.id,
    'Title': task.master_tasks?.title || '',
    'Description': task.master_tasks?.description || '',
    'Categories': task.master_tasks?.categories?.join(', ') || '',
    'Frequencies': task.master_tasks?.frequencies?.join(', ') || '',
    'Responsibility': task.master_tasks?.responsibility?.join(', ') || '',
    'Status': task.status,
    'Due Date': task.due_date,
    'Completed At': task.completed_at || '',
    'Created At': task.created_at
  }))

  return { data: exportData }
}

async function exportAuditLog(startDate?: string | null, endDate?: string | null, positionId?: string | null) {
  let query = supabase
    .from('audit_log')
    .select(`
      id,
      action,
      created_at,
      old_values,
      new_values,
      metadata,
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

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data: auditLogs, error } = await query

  if (error) {
    throw new Error('Failed to fetch audit logs for export')
  }

  const exportData = (auditLogs || []).map(log => ({
    'Log ID': log.id,
    'Action': log.action,
    'User': log.user_profiles?.display_name || '',
    'Position': log.user_profiles?.positions?.name || '',
    'Task': log.task_instances?.master_tasks?.title || '',
    'Task Instance ID': log.task_instances?.id || '',
    'Old Values': JSON.stringify(log.old_values || {}),
    'New Values': JSON.stringify(log.new_values || {}),
    'Metadata': JSON.stringify(log.metadata || {}),
    'Timestamp': log.created_at
  }))

  return { data: exportData }
}

async function exportCompletionSummary(startDate?: string | null, endDate?: string | null, positionId?: string | null, category?: string | null) {
  let query = supabase
    .from('task_instances')
    .select(`
      id,
      status,
      due_date,
      completed_at,
      master_tasks (
        title,
        category,
        positions (
          name
        )
      )
    `)

  if (startDate) query = query.gte('due_date', startDate)
  if (endDate) query = query.lte('due_date', endDate)
  if (positionId) {
    const responsibilityValue = await getResponsibilityForPosition(positionId)
    if (responsibilityValue) {
      query = query.contains('master_tasks.responsibility', [responsibilityValue])
    }
  }
  if (category) query = query.contains('master_tasks.categories', [category])

  const { data: tasks, error } = await query

  if (error) {
    throw new Error('Failed to fetch tasks for completion summary export')
  }

  // Group by position and calculate completion rates
  const positionSummary = (tasks || []).reduce((acc: any, task: any) => {
    const positionName = task.master_tasks?.positions?.name || 'Unknown'
    if (!acc[positionName]) {
      acc[positionName] = {
        total: 0,
        completed: 0,
        overdue: 0,
        missed: 0,
        onTime: 0
      }
    }
    
    acc[positionName].total++
    
    if (task.status === 'completed') {
      acc[positionName].completed++
      if (task.completed_at && new Date(task.completed_at) <= new Date(task.due_date)) {
        acc[positionName].onTime++
      }
    } else if (task.status === 'overdue') {
      acc[positionName].overdue++
    } else if (task.status === 'missed') {
      acc[positionName].missed++
    }
    
    return acc
  }, {})

  const exportData = Object.entries(positionSummary).map(([position, stats]: [string, any]) => ({
    'Position': position,
    'Total Tasks': stats.total,
    'Completed': stats.completed,
    'On Time': stats.onTime,
    'Overdue': stats.overdue,
    'Missed': stats.missed,
    'Completion Rate %': stats.total > 0 ? Math.round((stats.completed / stats.total) * 100 * 100) / 100 : 0,
    'On Time Rate %': stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100 * 100) / 100 : 0
  }))

  return { data: exportData }
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return ''
  }

  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(',')
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}