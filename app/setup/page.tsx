"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SetupStatus {
  positions: boolean
  masterTasks: boolean
  userProfiles: boolean
  publicHolidays: boolean
  taskInstances: boolean
  auditLog: boolean
}

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const checkSetup = async () => {
    setLoading(true)
    setError('')
    
    try {
      const checks = await Promise.allSettled([
        supabase.from('positions').select('count(*)').single(),
        supabase.from('master_tasks').select('count(*)').single(),
        supabase.from('user_profiles').select('count(*)').single(),
        supabase.from('public_holidays').select('count(*)').single(),
        supabase.from('task_instances').select('count(*)').single(),
        supabase.from('audit_log').select('count(*)').single(),
      ])

      const newStatus: SetupStatus = {
        positions: checks[0].status === 'fulfilled' && !checks[0].value.error,
        masterTasks: checks[1].status === 'fulfilled' && !checks[1].value.error,
        userProfiles: checks[2].status === 'fulfilled' && !checks[2].value.error,
        publicHolidays: checks[3].status === 'fulfilled' && !checks[3].value.error,
        taskInstances: checks[4].status === 'fulfilled' && !checks[4].value.error,
        auditLog: checks[5].status === 'fulfilled' && !checks[5].value.error,
      }

      setStatus(newStatus)

      // Check for specific errors
      const failedChecks = checks.filter(check => check.status === 'rejected')
      if (failedChecks.length > 0) {
        const errorMessages = failedChecks.map(check => 
          check.status === 'rejected' ? check.reason?.message : 'Unknown error'
        )
        setError(`Some tables are missing or inaccessible: ${errorMessages.join(', ')}`)
      }

    } catch (err) {
      setError(`Setup check failed: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkSetup()
  }, [])

  const createDemoUser = async (email: string, password: string, role: 'admin' | 'viewer') => {
    try {
      // This will only work if you have the service role key
      // For now, just show instructions
      alert(`To create user ${email}:\n1. Go to Supabase Dashboard\n2. Authentication → Users\n3. Create user with email: ${email} and password: ${password}`)
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  const allTablesExist = status && Object.values(status).every(Boolean)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">🔧 Database Setup Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Connection Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Database Tables</h3>
              
              {loading && <p>🔄 Checking database setup...</p>}
              
              {error && (
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-red-700">❌ {error}</p>
                  <p className="text-sm text-red-600 mt-2">
                    You need to run the SQL scripts from the supabase/ folder in your Supabase SQL Editor.
                  </p>
                </div>
              )}

              {status && (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(status).map(([table, exists]) => (
                    <div key={table} className={`p-3 rounded-lg border ${exists ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span className={exists ? 'text-green-700' : 'text-red-700'}>
                        {exists ? '✅' : '❌'} {table.replace(/([A-Z])/g, '_$1').toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Setup Instructions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Setup Instructions</h3>
              
              {!allTablesExist && (
                <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <h4 className="font-semibold text-yellow-800">📋 Database Setup Required</h4>
                  <ol className="list-decimal list-inside space-y-2 mt-2 text-yellow-700">
                    <li>Go to your Supabase Dashboard → SQL Editor</li>
                    <li>Run the contents of <code>supabase/rls-policies.sql</code></li>
                    <li>Run the contents of <code>supabase/seed-data.sql</code></li>
                    <li>Refresh this page to verify setup</li>
                  </ol>
                </div>
              )}

              <div className="p-4 bg-blue-100 border border-blue-300 rounded-lg">
                <h4 className="font-semibold text-blue-800">👥 Create Demo Users</h4>
                <p className="text-blue-700 mb-3">Create these users in Supabase Dashboard → Authentication → Users:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">admin@pharmacy.com / password123</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => createDemoUser('admin@pharmacy.com', 'password123', 'admin')}
                    >
                      Instructions
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">pharmacist@pharmacy.com / password123</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => createDemoUser('pharmacist@pharmacy.com', 'password123', 'viewer')}
                    >
                      Instructions
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button onClick={checkSetup} disabled={loading}>
                🔄 Recheck Setup
              </Button>
              
              {allTablesExist && (
                <Button asChild>
                  <a href="/login">✅ Go to Login</a>
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}