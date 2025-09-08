"use client"

import { useState, useEffect } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Settings, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { toastSuccess, toastError } from "@/hooks/use-toast"
import { authenticatedGet, authenticatedPost } from "@/lib/api-client"

interface TestResult {
  name: string
  status: 'success' | 'error' | 'pending'
  message: string
  details?: any
}

export default function TestSettingsPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const router = useRouter()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, authLoading, router])

  const runTests = async () => {
    setIsRunning(true)
    const results: TestResult[] = []

    // Test 1: Load System Settings
    try {
      const response = await authenticatedGet('/api/admin/settings')
      if (response.success) {
        results.push({
          name: 'Load System Settings',
          status: 'success',
          message: 'Successfully loaded system settings from database',
          details: response.data
        })
      } else {
        results.push({
          name: 'Load System Settings',
          status: 'error',
          message: response.error || 'Failed to load settings'
        })
      }
    } catch (error) {
      results.push({
        name: 'Load System Settings',
        status: 'error',
        message: 'Exception occurred while loading settings'
      })
    }

    // Test 2: Update System Settings
    try {
      const testSettings = {
        timezone: 'Australia/Sydney',
        new_since_hour: '08:30',
        missed_cutoff_time: '22:30',
        auto_logout_enabled: true,
        auto_logout_delay_minutes: 15,
        task_generation_days_ahead: 90,
        task_generation_days_behind: 3,
        working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        public_holiday_push_forward: true
      }

      const updateResponse = await authenticatedPost('/api/admin/settings', testSettings, 'PUT')
      if (updateResponse.success) {
        results.push({
          name: 'Update System Settings',
          status: 'success',
          message: 'Successfully updated system settings',
          details: testSettings
        })

        // Verify the update by loading again
        const verifyResponse = await authenticatedGet('/api/admin/settings')
        if (verifyResponse.success) {
          const updated = verifyResponse.data
          const matches = (
            updated.new_since_hour === testSettings.new_since_hour &&
            updated.missed_cutoff_time === testSettings.missed_cutoff_time &&
            updated.auto_logout_delay_minutes === testSettings.auto_logout_delay_minutes &&
            updated.task_generation_days_ahead === testSettings.task_generation_days_ahead &&
            updated.task_generation_days_behind === testSettings.task_generation_days_behind
          )

          results.push({
            name: 'Verify Settings Update',
            status: matches ? 'success' : 'error',
            message: matches ? 'Settings update verified successfully' : 'Settings update verification failed',
            details: { expected: testSettings, actual: updated }
          })
        }
      } else {
        results.push({
          name: 'Update System Settings',
          status: 'error',
          message: updateResponse.error || 'Failed to update settings'
        })
      }
    } catch (error) {
      results.push({
        name: 'Update System Settings',
        status: 'error',
        message: 'Exception occurred while updating settings'
      })
    }

    // Test 3: Test Bulk Generation API
    try {
      const bulkResponse = await authenticatedPost('/api/admin/bulk-generate', {
        dryRun: true,
        testMode: true,
        logLevel: 'info'
      })

      if (bulkResponse.success) {
        results.push({
          name: 'Bulk Generation API',
          status: 'success',
          message: 'Bulk generation API working correctly',
          details: bulkResponse.summary
        })
      } else {
        results.push({
          name: 'Bulk Generation API',
          status: 'error',
          message: bulkResponse.error || 'Bulk generation failed'
        })
      }
    } catch (error) {
      results.push({
        name: 'Bulk Generation API',
        status: 'error',
        message: 'Exception occurred during bulk generation test'
      })
    }

    setTestResults(results)
    setIsRunning(false)

    const successCount = results.filter(r => r.status === 'success').length
    const totalCount = results.length

    if (successCount === totalCount) {
      toastSuccess("All Tests Passed", `${successCount}/${totalCount} tests completed successfully`)
    } else {
      toastError("Some Tests Failed", `${successCount}/${totalCount} tests passed`)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mx-auto"></div>
          <p className="mt-2 text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navigation />

      <main className="max-w-content-lg mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="pharmacy-gradient rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">System Settings Test</h1>
                <p className="text-white/90">Test and verify system settings functionality</p>
              </div>
              <div className="flex items-center space-x-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Test Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={runTests} 
                disabled={isRunning}
                className="flex items-center space-x-2"
              >
                {isRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>{isRunning ? 'Running Tests...' : 'Run All Tests'}</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {testResults.map((result, index) => (
            <Card key={index} className="card-surface">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    {result.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : result.status === 'error' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
                    )}
                    <span>{result.name}</span>
                  </CardTitle>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.status === 'success' ? 'bg-green-100 text-green-800' :
                    result.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--color-text-secondary)] mb-2">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--color-primary)]">
                      View Details
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {testResults.length === 0 && (
          <Card className="card-surface">
            <CardContent className="text-center py-8">
              <p className="text-[var(--color-text-secondary)]">
                Click "Run All Tests" to verify system settings functionality
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}