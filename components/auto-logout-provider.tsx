"use client"

import { usePositionAuth } from '@/lib/position-auth-context'
import { useAutoLogout } from '@/hooks/use-auto-logout'
import { toastInfo } from '@/hooks/use-toast'

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = usePositionAuth()

  // Initialize auto-logout with no warning modal; logout occurs automatically
  useAutoLogout({
    onLogout: () => {
      toastInfo("Session Expired", "You have been logged out due to inactivity.")
    }
  })

  // Only wrap authenticated users; unauthenticated just render children
  if (!user) {
    return <>{children}</>
  }

  return <>{children}</>
}