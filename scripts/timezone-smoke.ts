// scripts/timezone-smoke.ts
// Quick smoke test to record Australia/Sydney time on app startup

import fs from 'node:fs'
import path from 'node:path'
import { formatInTimeZone } from 'date-fns-tz'
import {
  AUSTRALIAN_TIMEZONE,
  getAustralianToday,
  australianNowUtcISOString,
} from '../lib/timezone-utils'

function log(message: string) {
  console.log(`[timezone-smoke] ${message}`)
}

try {
  const nowUtc = new Date()
  const auNowDisplay = formatInTimeZone(
    nowUtc,
    AUSTRALIAN_TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  )
  const auToday = getAustralianToday()
  const resolvedTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
  const envTZ = process.env.TZ || '(unset)'

  const lines = [
    '--- Timezone Startup Snapshot ---',
    `UTC Now: ${nowUtc.toISOString()}`,
    `process.env.TZ: ${envTZ}`,
    `Intl Resolved TZ: ${resolvedTZ}`,
    `AU Now (display): ${auNowDisplay}`,
    `AU Today: ${auToday}`,
    `AU Now as UTC ISO (for storage): ${australianNowUtcISOString()}`,
    `Node Version: ${process.version}`,
    `Platform: ${process.platform}`,
    '----------------------------------',
    ''
  ].join('\n')

  // Ensure logs directory exists and append
  const logDir = path.join(process.cwd(), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  const logFile = path.join(logDir, 'timezone-startup.log')
  fs.appendFileSync(logFile, lines, 'utf8')

  log(`Recorded Australian time to ${logFile}`)
  // Also print to console for visibility in CI/terminals
  console.log(lines)
} catch (err) {
  log(`Failed to record timezone info: ${String(err)}`)
}