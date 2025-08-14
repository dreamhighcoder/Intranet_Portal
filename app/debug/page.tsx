"use client"

import { usePositionAuth } from "@/lib/position-auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
  const { user, isLoading, isAdmin } = usePositionAuth()

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Authentication Debug Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Loading State:</h3>
            <p>{isLoading ? 'Loading...' : 'Loaded'}</p>
          </div>
          
          <div>
            <h3 className="font-semibold">Is Admin:</h3>
            <p>{JSON.stringify(isAdmin)}</p>
          </div>
          
          <div>
            <h3 className="font-semibold">User Object:</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
          
          <div>
            <h3 className="font-semibold">User Role Check:</h3>
            <p>user?.role: {JSON.stringify(user?.role)}</p>
            <p>user?.role === 'admin': {JSON.stringify(user?.role === 'admin')}</p>
          </div>
          
          <div>
            <h3 className="font-semibold">Local Storage Check:</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
              {typeof window !== 'undefined' ? 
                localStorage.getItem('position_auth_user') || 'No stored user' : 
                'Server-side render'
              }
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}