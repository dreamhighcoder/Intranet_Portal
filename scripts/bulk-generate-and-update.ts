/*
 * Bulk Generate Instances + Update Statuses Script
 * Usage:
 *   pnpm tsx scripts/bulk-generate-and-update.ts --start=YYYY-MM-DD --end=YYYY-MM-DD [--force] [--dryRun] [--testMode]
 */

import { runNewDailyGeneration, runNewStatusUpdate } from '@/lib/new-task-generator'
import { parseArgs } from 'node:util'

function range(start: Date, end: Date): string[] {
  const dates: string[] = []
  const d = new Date(start)
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10)
    dates.push(iso)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

async function main() {
  const { values } = parseArgs({
    options: {
      start: { type: 'string', short: 's' },
      end: { type: 'string', short: 'e' },
      force: { type: 'boolean' },
      dryRun: { type: 'boolean' },
      testMode: { type: 'boolean' },
      logLevel: { type: 'string' },
    }
  })

  const startStr = values.start as string
  const endStr = values.end as string
  const forceRegenerate = Boolean(values.force)
  const dryRun = Boolean(values.dryRun)
  const testMode = Boolean(values.testMode)
  const logLevel = (values.logLevel as 'silent' | 'info' | 'debug') || 'info'

  if (!startStr || !endStr) {
    console.error('Missing --start and/or --end (YYYY-MM-DD)')
    process.exit(1)
  }

  const start = new Date(startStr)
  const end = new Date(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    console.error('Invalid date range')
    process.exit(1)
  }

  const dates = range(start, end)
  console.log(`Generating and updating for ${dates.length} day(s): ${startStr}..${endStr}`)

  for (const date of dates) {
    try {
      const gen = await runNewDailyGeneration(date, { forceRegenerate, dryRun, testMode, logLevel })
      console.log(`[GEN ${date}] new=${gen.newInstances} carry=${gen.carryInstances} total=${gen.totalInstances} errors=${gen.errors}`)
    } catch (err) {
      console.error(`[GEN ${date}] FAILED:`, err instanceof Error ? err.message : err)
    }

    try {
      const upd = await runNewStatusUpdate({ date, dryRun, testMode, logLevel })
      console.log(`[UPD ${date}] updated=${upd.instancesUpdated} skipped=${upd.instancesSkipped} errors=${upd.errors}`)
    } catch (err) {
      console.error(`[UPD ${date}] FAILED:`, err instanceof Error ? err.message : err)
    }
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})