"use client"

import { useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, RefreshCw, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react"

interface JobResult {
  success: boolean
  message: string
  stats?: any
  timestamp?: string
}

export default function AdminJobsPage() {
  const { user, isAdmin } = usePositionAuth()
  const [isRunning, setIsRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, JobResult>>({})

  const runGenerateInstances = async (mode: 'daily' | 'custom') => {
    setIsRunning('generate')
    try {
      const response = await fetch(`/api/jobs/generate-instances?mode=${mode}`)
      const result = await response.json()
      setResults(prev => ({ ...prev, generate: result }))
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        generate: { 
          success: false, 
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } 
      }))
    } finally {
      setIsRunning(null)
    }
  }

  const runUpdateStatuses = async () => {
    setIsRunning('status')
    try {
      const response = await fetch('/api/jobs/update-statuses')
      const result = await response.json()
      setResults(prev => ({ ...prev, status: result }))
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        status: { 
          success: false, 
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        } 
      }))
    } finally {
      setIsRunning(null)
    }
  }

  const clearResults = () => {
    setResults({})
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Background Jobs Management</h1>
            <p className="text-white/90">Manage task generation and status updates manually</p>
          </div>
        </div>

        {/* Jobs Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Task Instance Generation */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Task Instance Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">
                Generate task instances from master tasks based on recurrence rules
              </p>
              
              <div className="space-y-2">
                <Button
                  onClick={() => runGenerateInstances('daily')}
                  disabled={isRunning === 'generate'}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isRunning === 'generate' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Daily Generation
                </Button>
                
                <Button
                  onClick={() => runGenerateInstances('custom')}
                  disabled={isRunning === 'generate'}
                  variant="outline"
                  className="w-full"
                >
                  {isRunning === 'generate' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4 mr-2" />
                  )}
                  Custom Generation
                </Button>
              </div>

              {results.generate && (
                <Alert className={results.generate.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-start">
                    {results.generate.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertDescription className={results.generate.success ? "text-green-800" : "text-red-800"}>
                        {results.generate.message}
                        {results.generate.stats && (
                          <div className="mt-2 text-sm">
                            Generated: {results.generate.stats.generated} | 
                            Skipped: {results.generate.stats.skipped} | 
                            Errors: {results.generate.stats.errors}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Status Updates */}
          <Card className="card-surface">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-orange-600" />
                Task Status Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">
                Update task statuses based on current time and business rules
              </p>
              
              <Button
                onClick={runUpdateStatuses}
                disabled={isRunning === 'status'}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isRunning === 'status' ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Update All Statuses
              </Button>

              {results.status && (
                <Alert className={results.status.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <div className="flex items-start">
                    {results.status.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <AlertDescription className={results.status.success ? "text-green-800" : "text-red-800"}>
                        {results.status.message}
                        {results.status.stats && (
                          <div className="mt-2 text-sm">
                            <div>Updated: {results.status.stats.updated} tasks</div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <span>→ Due Today: {results.status.stats.details?.toDueToday || 0}</span>
                              <span>→ Overdue: {results.status.stats.details?.toOverdue || 0}</span>
                              <span>→ Missed: {results.status.stats.details?.toMissed || 0}</span>
                              <span>→ Locked: {results.status.stats.details?.locked || 0}</span>
                            </div>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card className="card-surface">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800">Recommended Schedule</h3>
                <p className="text-sm text-blue-600 mt-1">
                  Daily Generation: 12:00 AM<br />
                  Status Updates: Every 30 minutes
                </p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800">Environment</h3>
                <p className="text-sm text-green-600 mt-1">
                  {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}<br />
                  Supabase Connected
                </p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800">Actions</h3>
                <Button
                  onClick={clearResults}
                  variant="outline"
                  size="sm"
                  className="mt-1 text-purple-600 border-purple-300 hover:bg-purple-100"
                >
                  Clear Results
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card className="card-surface mt-6">
          <CardHeader>
            <CardTitle>Usage Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
              <div>
                <h4 className="font-semibold text-[var(--color-text)] mb-1">Task Instance Generation</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Daily Generation:</strong> Generates instances for -7 to +365 days using all active master tasks</li>
                  <li><strong>Custom Generation:</strong> Generates instances with default date range for testing</li>
                  <li>Only creates instances that don't already exist (unless force regenerate is used)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-[var(--color-text)] mb-1">Status Updates</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Updates tasks from not_due → due_today when due time arrives</li>
                  <li>Updates tasks from due_today → overdue based on frequency cutoffs</li>
                  <li>Updates tasks from overdue → missed and applies locking rules</li>
                  <li>Respects allow_edit_when_locked and sticky_once_off flags</li>
                </ul>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800">
                  <strong>Note:</strong> In production, these jobs should be automated using cron jobs or scheduled functions. 
                  This interface is for manual testing and emergency situations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}