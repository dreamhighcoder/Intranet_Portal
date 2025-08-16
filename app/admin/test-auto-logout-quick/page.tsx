'use client'

import { useState, useEffect } from 'react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function TestAutoLogoutQuickPage() {
  const { user, isLoading } = usePositionAuth()
  const [countdown, setCountdown] = useState<number>(30) // 30 seconds for quick testing
  const [lastActivity, setLastActivity] = useState<Date>(new Date())
  const [activityCount, setActivityCount] = useState(0)
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    if (!user || !testMode) return

    // Reset countdown every second
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)

    // Track user activity
    const handleActivity = () => {
      setCountdown(30) // Reset to 30 seconds
      setLastActivity(new Date())
      setActivityCount(prev => prev + 1)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'focus']
    events.forEach(eventType => {
      document.addEventListener(eventType, handleActivity, { passive: true })
    })

    return () => {
      clearInterval(interval)
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleActivity)
      })
    }
  }, [user, testMode])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    return `${seconds}s`
  }

  const getStatusColor = (seconds: number) => {
    if (seconds > 20) return 'text-green-600'
    if (seconds > 10) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Auto-Logout Test (30s)</h1>
          <p className="text-gray-600">
            This page simulates the auto-logout with a 30-second timeout for quick testing.
            <strong> Note: This is just a simulation - the actual system uses 5 minutes.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle>🎮 Test Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={() => {
                    setTestMode(!testMode)
                    setCountdown(30)
                    setActivityCount(0)
                    setLastActivity(new Date())
                  }}
                  className={`w-full ${testMode ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {testMode ? 'Stop Test' : 'Start 30s Test'}
                </Button>
                
                {testMode && (
                  <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                    <strong>Test Active:</strong> Stop moving your mouse to test inactivity detection.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timer Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⏰ Simulated Timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-6xl font-bold mb-4 ${getStatusColor(countdown)}`}>
                  {formatTime(countdown)}
                </div>
                <p className="text-gray-600 mb-4">
                  {testMode ? 'Simulated time remaining' : 'Test not active'}
                </p>
                {testMode && countdown <= 10 && countdown > 0 && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Warning:</strong> Simulated logout in {countdown} seconds!
                  </div>
                )}
                {testMode && countdown === 0 && (
                  <div className="bg-red-500 text-white px-4 py-3 rounded mb-4">
                    <strong>SIMULATED LOGOUT!</strong> In the real system, you would be logged out now.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎯 Activity Tracker
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Activity
                  </label>
                  <p className="text-lg font-mono">
                    {lastActivity.toLocaleTimeString()}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Activity Count
                  </label>
                  <p className="text-lg font-mono">
                    {activityCount} events detected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔒 Real System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  <strong>Real Auto-Logout:</strong> Active with 5-minute timeout
                </div>
                <p className="text-sm text-gray-600">
                  The actual auto-logout system is running in the background with a 5-minute inactivity timeout. 
                  Check the browser console for real system logs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>📋 Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-gray-700">
              <p><strong>Quick Test (30s):</strong> Click "Start 30s Test" and stop all activity to see the simulation.</p>
              <p><strong>Real Test (5min):</strong> The actual system runs in the background. Stop all activity for 5 minutes to test it.</p>
              <p><strong>Check Console:</strong> Open browser dev tools to see detailed logging from the real auth system.</p>
              <p><strong>Expected Behavior:</strong> After 5 minutes of real inactivity, you should be automatically redirected to the home page.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}