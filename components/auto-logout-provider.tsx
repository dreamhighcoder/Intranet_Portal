"use client"

import { useState } from 'react'
import { usePositionAuth } from '@/lib/position-auth-context'
import { useAutoLogout } from '@/hooks/use-auto-logout'
import { AutoLogoutWarning } from './auto-logout-warning'
import { toastInfo } from '@/hooks/use-toast'

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = usePositionAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [warningTimeLeft, setWarningTimeLeft] = useState(60)

  const { resetTimeout } = useAutoLogout({
    onWarning: (timeLeft) => {
      setWarningTimeLeft(timeLeft)
      setShowWarning(true)
    },
    onLogout: () => {
      setShowWarning(false)
      toastInfo("Session Expired", "You have been logged out due to inactivity.")
    }
  })

  const handleStayLoggedIn = () => {
    setShowWarning(false)
    resetTimeout()
    toastInfo("Session Extended", "Your session has been extended.")
  }

  const handleLogoutNow = () => {
    setShowWarning(false)
    // The logout will be handled by the auto-logout hook
  }

  // Only show auto-logout for authenticated users
  if (!user) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <AutoLogoutWarning
        isOpen={showWarning}
        timeLeft={warningTimeLeft}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogoutNow}
      />
    </>
  )
}