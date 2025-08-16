'use client'

import { useState, useEffect } from 'react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function TestAutoLogoutPage() {
  const { user, isLoading } = usePositionAuth()
  const [countdown, setCountdown] = useState<number>(300) // 5 minutes in seconds
  const [lastActivity, setLastActivity] = useState<Date>(new Date())
  const [activityCount, setActivityCount] = useState(0)

  useEffect(() => {
    if (!user) return

    // Reset countdown every second
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)

    // Track user activity
    const handleActivity = () => {
      setCountdown(300) // Reset to 5 minutes
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
  }, [user])

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
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (seconds: number) => {
    if (seconds > 120) return 'text-green-600' // > 2 minutes
    if (seconds > 60) return 'text-yellow-600'  // > 1 minute
    return 'text-red-600' // <= 1 minute
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auto-Logout Test</h1>
          <p className="text-gray-600">
            This page helps test the auto-logout functionality. The system will automatically log you out after 5 minutes of inactivity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Timer Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⏰ Auto-Logout Timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-6xl font-bold mb-4 ${getStatusColor(countdown)}`}>
                  {formatTime(countdown)}
                </div>
                <p className="text-gray-600 mb-4">
                  Time remaining until auto-logout
                </p>
                {countdown <= 60 && countdown > 0 && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <strong>Warning:</strong> You will be logged out in less than 1 minute!
                  </div>
                )}
                {countdown === 0 && (
                  <div className="bg-red-500 text-white px-4 py-3 rounded mb-4">
                    <strong>LOGGED OUT!</strong> Auto-logout should have triggered.
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

                <Button 
                  onClick={() => {
                    setLastActivity(new Date())
                    setActivityCount(prev => prev + 1)
                  }}
                  className="w-full"
                >
                  Simulate Activity
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>📋 Testing Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-gray-700">
                <p><strong>1. Normal Activity:</strong> Move your mouse, click, or type to reset the timer.</p>
                <p><strong>2. Test Inactivity:</strong> Stop all activity and watch the countdown. The timer should reach zero and trigger auto-logout.</p>
                <p><strong>3. Check Console:</strong> Open browser dev tools to see detailed logging from the auth system.</p>
                <p><strong>4. Expected Behavior:</strong> After 5 minutes of inactivity, you should be automatically redirected to the home page.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>🔧 Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>User:</strong> {user.displayName}
              </div>
              <div>
                <strong>Role:</strong> {user.role}
              </div>
              <div>
                <strong>Position:</strong> {user.position?.displayName || 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}