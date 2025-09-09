"use client"

import { useEffect, useRef } from 'react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { useAutoLogout } from '@/hooks/use-auto-logout'
import { toastInfo } from '@/hooks/use-toast'

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = usePositionAuth()
  const refreshSettingsRef = useRef<(() => void) | null>(null)

  // Initialize auto-logout with no warning modal; logout occurs automatically
  const { refreshSettings } = useAutoLogout({
    onLogout: () => {
      toastInfo("Session Expired", "You have been logged out due to inactivity.")
    }
  })

  // Store the refresh function in a ref so we can call it from outside
  useEffect(() => {
    refreshSettingsRef.current = refreshSettings
  }, [refreshSettings])

  // Listen for settings changes via custom events
  useEffect(() => {
    const handleSettingsChange = () => {
      console.log('🔄 Auto-logout: Settings changed, refreshing...')
      if (refreshSettingsRef.current) {
        refreshSettingsRef.current()
      }
    }

    // Listen for custom event that indicates settings have changed
    window.addEventListener('system-settings-updated', handleSettingsChange)
    
    return () => {
      window.removeEventListener('system-settings-updated', handleSettingsChange)
    }
  }, [])

  // Only wrap authenticated users; unauthenticated just render children
  if (!user) {
    return <>{children}</>
  }

  return <>{children}</>
}