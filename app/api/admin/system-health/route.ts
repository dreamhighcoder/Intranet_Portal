import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAustralianNow, getAustralianToday, AUSTRALIAN_TIMEZONE } from '@/lib/timezone-utils'
import { formatInTimeZone } from 'date-fns-tz'

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  activeUsers: number
  tasksGenerated: number
  lastTaskGeneration: string
  databaseConnected: boolean
  timezoneStatus: 'correct' | 'warning' | 'error'
  uptime: string
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const australianNow = getAustralianNow()
    const australianToday = getAustralianToday()

    // Check database connectivity
    let databaseConnected = true
    try {
      await supabase.from('user_profiles').select('id').limit(1)
    } catch (error) {
      databaseConnected = false
    }

    // Get active users (users who have logged in within the last 24 hours)
    const twentyFourHoursAgo = new Date(australianNow.getTime() - 24 * 60 * 60 * 1000)
    const { data: activeUsersData, error: activeUsersError } = await supabase
      .from('user_profiles')
      .select('id')
      .gte('last_login', formatInTimeZone(twentyFourHoursAgo, AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"))

    const activeUsers = activeUsersError ? 0 : (activeUsersData?.length || 0)

    // Get tasks generated today
    const { data: tasksData, error: tasksError } = await supabase
      .from('checklist_instances')
      .select('id')
      .gte('created_at', `${australianToday}T00:00:00`)
      .lt('created_at', `${australianToday}T23:59:59`)

    const tasksGenerated = tasksError ? 0 : (tasksData?.length || 0)

    // Get last task generation time
    const { data: lastTaskData } = await supabase
      .from('checklist_instances')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastTaskGeneration = lastTaskData 
      ? formatInTimeZone(new Date(lastTaskData.created_at), AUSTRALIAN_TIMEZONE, 'PPp')
      : 'Never'

    // Check timezone status
    let timezoneStatus: 'correct' | 'warning' | 'error' = 'correct'
    try {
      const systemTime = formatInTimeZone(australianNow, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
      const localTime = australianNow.toLocaleString('en-AU', { timeZone: AUSTRALIAN_TIMEZONE })
      
      // Simple check - if they're very different, there might be an issue
      if (Math.abs(new Date(systemTime).getTime() - new Date(localTime).getTime()) > 60000) {
        timezoneStatus = 'warning'
      }
    } catch (error) {
      timezoneStatus = 'error'
    }

    // Calculate uptime (simplified - using process start time)
    const uptimeMs = process.uptime() * 1000
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60))
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60))
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`

    // Determine overall system status
    let status: 'healthy' | 'warning' | 'error' = 'healthy'
    
    if (!databaseConnected || timezoneStatus === 'error') {
      status = 'error'
    } else if (timezoneStatus === 'warning' || activeUsers === 0) {
      status = 'warning'
    }

    const systemHealth: SystemHealth = {
      status,
      activeUsers,
      tasksGenerated,
      lastTaskGeneration,
      databaseConnected,
      timezoneStatus,
      uptime
    }

    return NextResponse.json(systemHealth)

  } catch (error) {
    console.error('System health GET error:', error)
    return NextResponse.json({ 
      status: 'error',
      activeUsers: 0,
      tasksGenerated: 0,
      lastTaskGeneration: 'Error',
      databaseConnected: false,
      timezoneStatus: 'error',
      uptime: 'Unknown'
    } as SystemHealth)
  }
}