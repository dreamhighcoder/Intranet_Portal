"use client"

import { useState } from "react"
import { usePositionAuth } from "@/lib/position-auth-context"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Wrench, Database } from "lucide-react"
import { toastError, toastSuccess } from "@/hooks/use-toast"

export default function FixAuditPage() {
  const { user, isLoading: authLoading, isAdmin } = usePositionAuth()
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{ 
    success: boolean; 
    message: string; 
    details?: string;
    sqlScript?: string;
    instructions?: string[];
  } | null>(null)

  const handleFixConstraint = async () => {
    setIsFixing(true)
    setFixResult(null)
    
    try {
      const response = await fetch('/api/admin/apply-audit-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (result.success) {
        setFixResult({
          success: true,
          message: result.message,
          details: result.details
        })
        toastSuccess('Fix Applied', 'Audit constraint fixed successfully')
      } else if (result.requiresManualExecution) {
        setFixResult({
          success: false,
          message: result.message,
          details: result.details,
          sqlScript: result.sqlScript,
          instructions: result.instructions
        })
        toastError('Manual Fix Required', 'Please apply the SQL script manually')
      } else {
        setFixResult({
          success: false,
          message: result.error || 'Failed to fix constraint',
          details: result.details
        })
        toastError('Fix Failed', result.error || 'Failed to fix constraint')
      }
    } catch (error) {
      console.error('Error applying fix:', error)
      setFixResult({
        success: false,
        message: 'Network error occurred',
        details: error instanceof Error ? error.message : String(error)
      })
      toastError('Fix Failed', 'Network error occurred')
    } finally {
      setIsFixing(false)
    }
  }

  // Show loading spinner while authentication is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
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
                <h1 className="text-3xl font-bold mb-2 flex items-center">
                  <Wrench className="w-8 h-8 mr-3" />
                  Fix Audit Constraint
                </h1>
                <p className="text-white/90">Fix the database constraint that prevents public holiday deletion</p>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Description */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              Problem Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                The audit log system has a constraint that only allows specific actions. When deleting public holidays, 
                the system tries to log a <code className="bg-gray-100 px-2 py-1 rounded">holiday_deleted</code> action, 
                but this action is not in the allowed list, causing the deletion to fail.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">Error Messages:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• "new row for relation 'audit_log' violates check constraint 'audit_log_action_check'"</li>
                  <li>• "HTTP 500: Internal Server Error"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Solution */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-600">
              <Database className="w-5 h-5 mr-2" />
              Solution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                This fix will update the audit log constraint to include holiday-related actions 
                (<code className="bg-gray-100 px-2 py-1 rounded">holiday_created</code>, 
                <code className="bg-gray-100 px-2 py-1 rounded">holiday_updated</code>, 
                <code className="bg-gray-100 px-2 py-1 rounded">holiday_deleted</code>) 
                along with other system actions.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">What this fix does:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Drops the existing restrictive constraint</li>
                  <li>• Adds a new constraint that includes holiday actions</li>
                  <li>• Tests the constraint to ensure it works</li>
                  <li>• Enables successful public holiday deletion</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleFixConstraint}
                disabled={isFixing}
                className="w-full sm:w-auto"
              >
                {isFixing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Applying Fix...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    Apply Fix
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {fixResult && (
          <Card>
            <CardHeader>
              <CardTitle className={`flex items-center ${fixResult.success ? 'text-green-600' : 'text-orange-600'}`}>
                {fixResult.success ? (
                  <CheckCircle className="w-5 h-5 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2" />
                )}
                {fixResult.success ? 'Fix Applied Successfully' : 'Manual Fix Required'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className={fixResult.success ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                <AlertDescription className={fixResult.success ? 'text-green-800' : 'text-orange-800'}>
                  <div className="space-y-4">
                    <p className="font-medium">{fixResult.message}</p>
                    {fixResult.details && (
                      <p className="text-sm">{fixResult.details}</p>
                    )}
                    {fixResult.success && (
                      <p className="text-sm font-medium">
                        ✅ You can now delete public holidays without errors!
                      </p>
                    )}
                    
                    {/* Show instructions for manual fix */}
                    {fixResult.instructions && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Instructions:</h4>
                        <ol className="text-sm space-y-1 list-decimal list-inside">
                          {fixResult.instructions.map((instruction, index) => (
                            <li key={index}>{instruction}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    {/* Show SQL script */}
                    {fixResult.sqlScript && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">SQL Script to Execute:</h4>
                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                          <pre>{fixResult.sqlScript}</pre>
                        </div>
                        <div className="mt-2 flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(fixResult.sqlScript!)
                              toastSuccess('Copied', 'SQL script copied to clipboard')
                            }}
                          >
                            Copy SQL Script
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                          >
                            Open Supabase Dashboard
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Manual Alternative */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-gray-600">Manual Alternative</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">
                If the automatic fix doesn't work, you can manually apply the fix by running the SQL script 
                in your Supabase dashboard:
              </p>
              
              <div className="bg-gray-50 border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>File location:</strong> <code>supabase/fix-audit-constraint-manual.sql</code>
                </p>
                <p className="text-sm text-gray-600">
                  Copy the contents of this file and run it in the Supabase SQL Editor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}