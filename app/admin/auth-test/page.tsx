"use client"

import { useEffect, useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { PositionAuthService } from "@/lib/position-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { authenticatedGet } from "@/lib/api-client"

export default function AuthTestPage() {
  const { user, isLoading, isAdmin, signIn } = usePositionAuth()
  const [testResults, setTestResults] = useState<any[]>([])

  const runAuthTest = async () => {
    const results = []
    
    // Test 1: Local Storage Check
    const storedAuth = typeof window !== 'undefined' ? localStorage.getItem('position_auth_user') : null
    results.push({
      test: "LocalStorage Check",
      result: storedAuth ? JSON.parse(storedAuth) : null,
      status: storedAuth ? "✅ PASS" : "❌ FAIL"
    })

    // Test 2: Position Auth Service
    const currentUser = PositionAuthService.getCurrentUser()
    results.push({
      test: "PositionAuthService.getCurrentUser()",
      result: currentUser,
      status: currentUser ? "✅ PASS" : "❌ FAIL"
    })

    // Test 3: Context Values
    results.push({
      test: "usePositionAuth() values",
      result: { user, isLoading, isAdmin },
      status: user && !isLoading ? "✅ PASS" : "❌ FAIL"
    })

    // Test 4: API Test
    try {
      const apiResult = await authenticatedGet('/api/test-auth')
      results.push({
        test: "API Authentication Test",
        result: apiResult,
        status: apiResult?.success ? "✅ PASS" : "❌ FAIL"
      })
    } catch (error) {
      results.push({
        test: "API Authentication Test",
        result: error,
        status: "❌ FAIL"
      })
    }

    setTestResults(results)
  }

  const forceAdminLogin = async () => {
    await signIn('administrator', 'admin123')
    window.location.reload()
  }

  useEffect(() => {
    if (!isLoading) {
      runAuthTest()
    }
  }, [user, isLoading, isAdmin])

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Test Results</CardTitle>
            <div className="flex space-x-4">
              <Button onClick={runAuthTest}>Refresh Tests</Button>
              <Button onClick={forceAdminLogin} variant="outline">Force Admin Login</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {testResults.map((result, index) => (
              <div key={index} className="border p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{result.test}</h3>
                  <span className="text-sm font-mono">{result.status}</span>
                </div>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button asChild>
                <a href="/admin">Admin Dashboard</a>
              </Button>
              <Button asChild>
                <a href="/admin/master-tasks">Master Tasks</a>
              </Button>
              <Button asChild>
                <a href="/admin/reports">Reports</a>
              </Button>
              <Button asChild>
                <a href="/debug">Debug Page</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}