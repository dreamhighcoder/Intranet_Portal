// app/api/health/timezone/route.ts
import { NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import {
  AUSTRALIAN_TIMEZONE,
  getAustralianToday,
  australianNowUtcISOString,
} from '@/lib/timezone-utils'

export async function GET() {
  const nowUtc = new Date()
  const auDisplay = formatInTimeZone(nowUtc, AUSTRALIAN_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
  const auToday = getAustralianToday()
  const envTZ = process.env.TZ || '(unset)'
  const resolvedTZ = Intl.DateTimeFormat().resolvedOptions().timeZone

  return NextResponse.json({
    ok: true,
    timezone: AUSTRALIAN_TIMEZONE,
    now: {
      utc: nowUtc.toISOString(),
      auDisplay,
      auToday,
      auAsUtcISO: australianNowUtcISOString(),
    },
    process: {
      envTZ,
      resolvedTZ,
      node: process.version,
      platform: process.platform,
    },
  })
}