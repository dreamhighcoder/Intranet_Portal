"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TZHealth {
  ok: boolean
  timezone: string
  now: {
    utc: string
    auDisplay: string
    auToday: string
    auAsUtcISO: string
  }
  process: {
    envTZ: string
    resolvedTZ: string
    node: string
    platform: string
  }
}

export function TimezoneHealthCard() {
  const [data, setData] = useState<TZHealth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/health/timezone', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as TZHealth
        if (!aborted) {
          setData(json)
          setError(null)
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Failed to load')
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => {
      aborted = true
    }
  }, [])

  return (
    <Card className="card-surface">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Timezone Health</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
        )}
        {error && (
          <p className="text-sm text-red-600">Error: {error}</p>
        )}
        {data && (
          <div className="text-sm space-y-2 text-[var(--color-text-secondary)]">
            <div>
              <span className="font-medium text-[var(--color-text)]">Timezone:</span> {data.timezone}
            </div>
            <div>
              <span className="font-medium text-[var(--color-text)]">AU Now:</span> {data.now.auDisplay}
            </div>
            <div>
              <span className="font-medium text-[var(--color-text)]">AU Today:</span> {data.now.auToday}
            </div>
            <div className="break-all">
              <span className="font-medium text-[var(--color-text)]">AU Now (as UTC ISO):</span> {data.now.auAsUtcISO}
            </div>
            <div className="pt-2">
              <span className="font-medium text-[var(--color-text)]">Process:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-1">
                <div>env TZ: {data.process.envTZ}</div>
                <div>Intl TZ: {data.process.resolvedTZ}</div>
                <div>Node: {data.process.node}</div>
                <div>Platform: {data.process.platform}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}