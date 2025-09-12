"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Activity, Database, Clock, AlertCircle, CheckCircle, Zap, TrendingUp, Settings, RefreshCw, TestTube } from "lucide-react"
import { authenticatedGet } from "@/lib/api-client"
import { getAustralianNow, toAustralianTime, formatAustralianDate, AUSTRALIAN_TIMEZONE } from "@/lib/timezone-utils"
import { formatInTimeZone } from 'date-fns-tz'

interface DiagnosticResult {
  success: boolean
  message: string
  stats?: any
  timestamp?: string
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error'
  tasksGenerated: number
  apiResponseTime: number
  lastUpdate: string
  activeUsers: number
  metrics?: {
    activeMasterTasks: number
    completionsToday: number
    databaseConnected: boolean
  }
}

export default function SystemHealthPage() {
  const { user, isAdmin } = usePositionAuth()
  const [isRunning, setIsRunning] = useState<string | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(false)
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({})
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    tasksGenerated: 0,
    apiResponseTime: 0,
    lastUpdate: new Date().toISOString(),
    activeUsers: 0
  })

  // Load system health data
  useEffect(() => {
    if (user && isAdmin) {
      loadSystemHealth()
      const interval = setInterval(loadSystemHealth, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user, isAdmin])

  const loadSystemHealth = async () => {
    setIsLoadingHealth(true)
    try {
      const data = await authenticatedGet('/api/system/health')
      if (data) {
        setSystemHealth(data)
      } else {
        // Set error state if API isn't available
        setSystemHealth({
          status: 'error',
          tasksGenerated: 0,
          apiResponseTime: 0,
          lastUpdate: new Date().toISOString(),
          activeUsers: 0,
          metrics: {
            activeMasterTasks: 0,
            completionsToday: 0,
            databaseConnected: false
          }
        })
      }
    } catch (error) {
      console.error('Failed to load system health:', error)
      // Set error state on error
      setSystemHealth({
        status: 'error',
        tasksGenerated: 0,
        apiResponseTime: 0,
        lastUpdate: getAustralianNow().toISOString(),
        activeUsers: 0,
        metrics: {
          activeMasterTasks: 0,
          completionsToday: 0,
          databaseConnected: false
        }
      })
    } finally {
      setIsLoadingHealth(false)
    }
  }

  const runDiagnosticTest = async (testType: 'recurrence' | 'performance' | 'data-integrity') => {
    setIsRunning(testType)
    try {
      const result = await authenticatedGet(`/api/system/diagnostics?test=${testType}`)
      if (result) {
        setResults(prev => ({ ...prev, [testType]: result }))
      } else {
        // Set error result if API call fails
        setResults(prev => ({
          ...prev,
          [testType]: {
            success: false,
            message: `Test failed: API call returned no data`
          }
        }))
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [testType]: {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }))
    } finally {
      setIsRunning(null)
    }
  }

  const runEmergencyFix = async () => {
    setIsRunning('emergency')
    try {
      const result = await authenticatedGet('/api/jobs/generate-instances?mode=emergency&forceRegenerate=true')
      if (result) {
        setResults(prev => ({ ...prev, emergency: result }))
      } else {
        setResults(prev => ({
          ...prev,
          emergency: {
            success: false,
            message: `Emergency fix failed: API call returned no data`
          }
        }))
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        emergency: {
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

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-18 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">System Health & Diagnostics</h1>
                <p className="text-white/90">Monitor system performance and run diagnostic tests</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-white">System Status</div>
                  <Badge className={`${systemHealth.status === 'healthy' ? 'bg-green-500 text-white' :
                    systemHealth.status === 'warning' ? 'bg-yellow-500 text-white' :
                      'bg-red-500 text-white'
                    }`}>
                    {systemHealth.status === 'healthy' ? '✓ Healthy' :
                      systemHealth.status === 'warning' ? '⚠ Warning' :
                        '✗ Error'}
                  </Badge>
                </div>
                <Activity className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="card-surface py-5 h-22">
            <CardContent className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Tasks Generated Today</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">{systemHealth.tasksGenerated}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-surface py-5 h-22">
            <CardContent className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">API Response Time</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">{systemHealth.apiResponseTime}ms</p>
                </div>
                <Zap className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-surface py-5 h-22">
            <CardContent className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Active Users</p>
                  <p className="text-2xl font-bold text-[var(--color-text)]">{systemHealth.activeUsers}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-surface py-5 h-22">
            <CardContent className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">Last Updated (AEST/AEDT)</p>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {formatInTimeZone(new Date(systemHealth.lastUpdate), AUSTRALIAN_TIMEZONE, 'HH:mm:ss')}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional System Metrics */}
        {systemHealth.metrics && (
          <Card className="card-surface mb-8 gap-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2 text-blue-600" />
                System Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800">Active Master Tasks</h3>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {systemHealth.metrics.activeMasterTasks}
                  </p>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800">Completions Today</h3>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {systemHealth.metrics.completionsToday}
                  </p>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800">Database Status</h3>
                  <p className="text-lg font-bold mt-1">
                    <Badge className={systemHealth.metrics.databaseConnected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                      {systemHealth.metrics.databaseConnected ? '✓ Connected' : '✗ Disconnected'}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnostic Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* System Diagnostics */}
          <Card className="card-surface gap-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TestTube className="w-5 h-5 mr-2 text-blue-600" />
                System Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">
                Run diagnostic tests to verify system components are working correctly
              </p>

              <div className="space-y-2">
                <Button
                  onClick={() => runDiagnosticTest('recurrence')}
                  disabled={isRunning === 'recurrence'}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isRunning === 'recurrence' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Test Recurrence Engine
                </Button>

                <Button
                  onClick={() => runDiagnosticTest('performance')}
                  disabled={isRunning === 'performance'}
                  variant="outline"
                  className="w-full"
                >
                  {isRunning === 'performance' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Performance Test
                </Button>

                <Button
                  onClick={() => runDiagnosticTest('data-integrity')}
                  disabled={isRunning === 'data-integrity'}
                  variant="outline"
                  className="w-full"
                >
                  {isRunning === 'data-integrity' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  Data Integrity Check
                </Button>
              </div>

              {(results.recurrence || results.performance || results['data-integrity']) && (
                <div className="space-y-2">
                  {Object.entries(results).map(([key, result]) => (
                    <Alert key={key} className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      {result.success ? (
                        <div>
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                        </div>
                      ) : (
                        <div>
                          <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                        </div>
                      )}
                      <div className="flex-1 ml-6">
                        <AlertDescription className={result.success ? "text-green-800" : "text-red-800"}>
                          <strong>{key.replace('-', ' ').toUpperCase()}:</strong> {result.message}
                          {result.stats && (
                            <div className="text-sm">
                              {key === 'recurrence' && result.stats.tasksProcessed !== undefined && (
                                <>Tasks Processed: {result.stats.tasksProcessed} | Duration: {result.stats.duration}ms</>
                              )}
                              {key === 'performance' && result.stats.apiResponseTime !== undefined && (
                                <>API Response: {result.stats.apiResponseTime}ms | DB Query: {result.stats.databaseQueryTime}ms | Status: {result.stats.status}</>
                              )}
                              {key === 'data-integrity' && result.stats.issuesFound !== undefined && (
                                <>Issues Found: {result.stats.issuesFound} | Status: {result.stats.status}</>
                              )}
                              {!['recurrence', 'performance', 'data-integrity'].includes(key) && (
                                <pre className="whitespace-pre-wrap">{JSON.stringify(result.stats, null, 2)}</pre>
                              )}
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Tools */}
          <Card className="card-surface gap-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2 text-orange-600" />
                Emergency Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-yellow-200 bg-yellow-50">
                <div>
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                </div>
                <AlertDescription className="text-yellow-800 ml-6">
                  <strong>Note:</strong> The system operates automatically. These tools are only for emergency situations or troubleshooting.
                </AlertDescription>
              </Alert>

              <p className="text-[var(--color-text-secondary)]">
                Emergency data repair and manual intervention tools
              </p>

              <Button
                onClick={runEmergencyFix}
                disabled={isRunning === 'emergency'}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isRunning === 'emergency' ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                Emergency Data Repair
              </Button>

              {results.emergency && (
                <Alert className={results.emergency.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {results.emergency.success ? (
                    <div>
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                    </div>
                  ) : (
                    <div>
                      <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                    </div>
                  )}
                  <div className="flex-1 ml-6">
                    <AlertDescription className={results.emergency.success ? "text-green-800" : "text-red-800"}>
                      {results.emergency.message}
                      {results.emergency.stats && (
                        <div className="text-sm">
                          Total Tasks: {results.emergency.stats.totalTasks || 0} |
                          New Instances: {results.emergency.stats.newInstances || 0} |
                          Total Instances: {results.emergency.stats.totalInstances || 0} |
                          Errors: {results.emergency.stats.errors || 0}
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card className="card-surface gap-4">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800">System Status</h3>
                <p className="text-sm text-green-600 mt-1">
                  Fully Automatic Operation<br />
                  Real-time Status Updates<br />
                  Dynamic Task Generation
                </p>
              </div>

              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800">Environment</h3>
                <p className="text-sm text-blue-600 mt-1">
                  {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}<br />
                  Database: {systemHealth.metrics?.databaseConnected ? 'Connected' : 'Disconnected'}<br />
                  API: {systemHealth.status === 'error' ? 'Error' : 'Operational'}
                </p>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <h3 className="font-semibold text-purple-800">Actions</h3>
                <Button
                  onClick={clearResults}
                  variant="outline"
                  size="sm"
                  className="mt-5 mr-2 text-purple-600 border-purple-300 hover:bg-purple-100"
                >
                  Clear Results
                </Button>
                <Button
                  onClick={loadSystemHealth}
                  variant="outline"
                  size="sm"
                  className="mt-5 ml-2 text-blue-600 border-blue-300 hover:bg-blue-100"
                >
                  Refresh Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="card-surface mt-6">
          <CardHeader>
            <CardTitle>How the System Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="flex font-semibold text-green-800 mb-2"><CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />Fully Automatic Operation</h4>
                <p className="text-green-700">
                  The system operates completely automatically without requiring manual intervention.
                  Tasks appear immediately when activated and statuses update in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4">
                <div>
                  <h4 className="font-semibold text-[var(--color-text)] mb-2">🔄 Dynamic Task Generation</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Tasks are generated virtually from master task rules</li>
                    <li>Appear immediately when master tasks are activated</li>
                    <li>No pre-generation or batch processing required</li>
                    <li>Recurrence rules calculated in real-time</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-[var(--color-text)] mb-2">⚡ Real-time Status Updates</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Status calculated dynamically based on current time</li>
                    <li>Automatic transitions: Not Due Yet → Due Today → Overdue → Missed</li>
                    <li>No background jobs needed for status updates</li>
                    <li>Always accurate and up-to-date</li>
                  </ul>
                </div>
              </div>

              <div className="ml-4">
                <h4 className="font-semibold text-[var(--color-text)] mb-2">🛠️ When to Use These Tools</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Diagnostic Tests:</strong> Verify system components are working correctly</li>
                  <li><strong>Performance Monitoring:</strong> Check API response times and system health</li>
                  <li><strong>Emergency Repair:</strong> Only if data inconsistencies are detected</li>
                  <li><strong>Troubleshooting:</strong> When investigating reported issues</li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-blue-800">
                  <strong>💡 Pro Tip:</strong> The system is designed to be maintenance-free.
                  These diagnostic tools are provided for monitoring and troubleshooting purposes only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}