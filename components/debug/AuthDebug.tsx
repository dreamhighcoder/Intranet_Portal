'use client'

import { useState, useEffect } from 'react'
import { PositionAuthService } from '@/lib/position-auth'
import { supabase } from '@/lib/supabase'

export default function AuthDebug() {
  const [positionUser, setPositionUser] = useState<any>(null)
  const [supabaseUser, setSupabaseUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check position auth
        const posUser = await PositionAuthService.getCurrentUser()
        setPositionUser(posUser)

        // Check supabase auth
        const { data: { session } } = await supabase.auth.getSession()
        setSupabaseUser(session?.user || null)

        console.log('Auth Debug - Position User:', posUser)
        console.log('Auth Debug - Supabase User:', session?.user)
      } catch (error) {
        console.error('Auth Debug Error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return <div>Checking authentication...</div>
  }

  return (
    <div className="p-4 border rounded bg-gray-50">
      <h3 className="font-bold mb-2">Authentication Debug</h3>
      
      <div className="mb-4">
        <h4 className="font-semibold">Position Auth:</h4>
        {positionUser ? (
          <pre className="text-xs bg-white p-2 rounded">
            {JSON.stringify({
              id: positionUser.id,
              role: positionUser.role,
              displayName: positionUser.displayName,
              isAuthenticated: positionUser.isAuthenticated,
              isSuperAdmin: positionUser.isSuperAdmin
            }, null, 2)}
          </pre>
        ) : (
          <p className="text-red-600">No position user found</p>
        )}
      </div>

      <div className="mb-4">
        <h4 className="font-semibold">Supabase Auth:</h4>
        {supabaseUser ? (
          <pre className="text-xs bg-white p-2 rounded">
            {JSON.stringify({
              id: supabaseUser.id,
              email: supabaseUser.email,
              role: supabaseUser.role
            }, null, 2)}
          </pre>
        ) : (
          <p className="text-red-600">No Supabase user found</p>
        )}
      </div>

      <div>
        <h4 className="font-semibold">Authentication Status:</h4>
        <p className={positionUser || supabaseUser ? 'text-green-600' : 'text-red-600'}>
          {positionUser || supabaseUser ? 'Authenticated' : 'Not Authenticated'}
        </p>
      </div>
    </div>
  )
}