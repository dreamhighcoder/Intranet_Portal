import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAustralianNow, AUSTRALIAN_TIMEZONE } from '@/lib/timezone-utils'
import { formatInTimeZone } from 'date-fns-tz'
import os from 'os'

interface SystemInfo {
  version: string
  platform: string
  nodeVersion: string
  databaseStatus: string
  lastBackup: string
  systemTime: string
  memoryUsage: {
    used: string
    total: string
    percentage: number
  }
  diskSpace: {
    used: string
    available: string
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    
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

    // Check database status
    let databaseStatus = 'Connected'
    try {
      const { error } = await supabase.from('user_profiles').select('id').limit(1)
      if (error) {
        databaseStatus = 'Error'
      }
    } catch (error) {
      databaseStatus = 'Disconnected'
    }

    // Get memory usage
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryPercentage = Math.round((usedMemory / totalMemory) * 100)

    const formatBytes = (bytes: number): string => {
      const gb = bytes / (1024 * 1024 * 1024)
      return `${gb.toFixed(1)} GB`
    }

    // Get system info
    const systemInfo: SystemInfo = {
      version: '1.2.0', // Update this as needed
      platform: `${os.type()} ${os.release()}`,
      nodeVersion: process.version,
      databaseStatus,
      lastBackup: formatInTimeZone(australianNow, AUSTRALIAN_TIMEZONE, 'PPp'), // Simulated - in real app, get from backup system
      systemTime: formatInTimeZone(australianNow, AUSTRALIAN_TIMEZONE, 'PPp'),
      memoryUsage: {
        used: formatBytes(usedMemory),
        total: formatBytes(totalMemory),
        percentage: memoryPercentage
      },
      diskSpace: {
        used: 'N/A', // Would need additional package to get disk usage
        available: 'N/A'
      }
    }

    return NextResponse.json(systemInfo)

  } catch (error) {
    console.error('System info GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}