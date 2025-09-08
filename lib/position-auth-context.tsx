'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { PositionAuthService, PositionAuthUser } from './position-auth'
import { getSystemSettings } from './system-settings'
import { useRouter } from 'next/navigation'

interface PositionAuthContextType {
  user: PositionAuthUser | null
  isLoading: boolean
  signIn: (positionId: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => void
  isAdmin: boolean
  isSuperAdmin: boolean
}

const PositionAuthContext = createContext<PositionAuthContextType | undefined>(undefined)

export function PositionAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PositionAuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inactivityLimitMs, setInactivityLimitMs] = useState(5 * 60 * 1000) // Default 5 minutes
  const router = useRouter()

  const inactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = React.useRef<number>(Date.now())
  const userRef = React.useRef<PositionAuthUser | null>(null)
  const routerRef = React.useRef(router)

  // Keep refs in sync
  React.useEffect(() => {
    userRef.current = user
  }, [user])

  React.useEffect(() => {
    routerRef.current = router
  }, [router])

  // Load system settings for auto-logout configuration
  const loadAutoLogoutSettings = React.useCallback(async () => {
    try {
      const settings = await getSystemSettings()
      if (settings.auto_logout_enabled) {
        const newLimitMs = settings.auto_logout_delay_minutes * 60 * 1000
        setInactivityLimitMs(newLimitMs)
        console.log(`🔧 PositionAuth: Auto-logout enabled with ${settings.auto_logout_delay_minutes} minute delay`)
      } else {
        // Disable auto-logout by setting a very high limit
        setInactivityLimitMs(24 * 60 * 60 * 1000) // 24 hours
        console.log('🔧 PositionAuth: Auto-logout disabled')
      }
    } catch (error) {
      console.error('❌ PositionAuth: Failed to load auto-logout settings:', error)
      // Keep default 5-minute timeout on error
    }
  }, [])

  const performLogout = React.useCallback(() => {
    console.log('🚪 PositionAuth: Performing inactivity logout')
    
    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    
    try {
      // Sign out from position auth
      PositionAuthService.signOut()
      setUser(null)
      console.log('✅ PositionAuth: Position auth signout complete')
      
      // Redirect to home page
      router.push('/')
      console.log('✅ PositionAuth: Redirected to home page')
    } catch (error) {
      console.error('❌ PositionAuth: Error during logout:', error)
    }
  }, [router])



  useEffect(() => {
    // Check for existing authentication on mount
    const loadCurrentUser = async () => {
      try {
        const currentUser = await PositionAuthService.getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Error loading current user:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCurrentUser()
  }, [])

  // Load auto-logout settings when component mounts
  useEffect(() => {
    loadAutoLogoutSettings()
  }, [])

  // Inactivity monitoring setup
  React.useEffect(() => {
    if (!user) {
      console.log('👤 PositionAuth: No user - cleaning up inactivity monitoring')
      
      // Clear timer if user logged out
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    console.log('🔧 PositionAuth: Setting up inactivity monitoring for:', user.displayName)
    console.log(`⏱️ PositionAuth: Timeout set to ${inactivityLimitMs}ms (${inactivityLimitMs/1000} seconds)`)
    userRef.current = user // Update ref when user changes

    // Local timer functions to avoid callback dependency issues
    const startTimer = () => {
      // Clear existing timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      
      // Set new timer
      inactivityTimerRef.current = setTimeout(() => {
        console.log('🚨 PositionAuth: INACTIVITY TIMEOUT - Logging out user')
        
        // Perform logout directly to avoid callback dependencies
        try {
          PositionAuthService.signOut()
          setUser(null)
          console.log('✅ PositionAuth: Position auth signout complete')
          
          // Redirect to home page
          routerRef.current.push('/')
          console.log('✅ PositionAuth: Redirected to home page')
        } catch (error) {
          console.error('❌ PositionAuth: Error during logout:', error)
        }
      }, inactivityLimitMs)
      
      console.log(`✅ PositionAuth: Timer set for ${inactivityLimitMs}ms`)
    }

    const handleActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now
      
      console.log('🎯 PositionAuth: User activity detected at', new Date(now).toLocaleTimeString())
      
      if (userRef.current) {
        startTimer() // Reset the timer
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'focus'] as const
    
    // Add all event listeners
    events.forEach((eventType) => {
      document.addEventListener(eventType, handleActivity, { passive: true })
      console.log(`📡 PositionAuth: Added ${eventType} listener`)
    })

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ PositionAuth: Tab became visible - resetting activity timer')
        handleActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Start the initial timer
    console.log('🚀 PositionAuth: Starting initial inactivity timer')
    startTimer()

    // Cleanup function
    return () => {
      console.log('🧹 PositionAuth: Cleaning up inactivity monitoring')
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      
      events.forEach((eventType) => {
        document.removeEventListener(eventType, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, inactivityLimitMs]) // Depend on user and inactivity limit

  const signIn = async (positionId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await PositionAuthService.authenticate(positionId, password)
      
      if (result.success && result.user) {
        setUser(result.user)
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return { success: false, error: 'Authentication failed' }
    }
  }

  const signOut = () => {
    console.log('🚪 PositionAuth: Manual signout requested')
    performLogout()
  }



  const value: PositionAuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    isAdmin: user?.role === 'admin',
    isSuperAdmin: user?.isSuperAdmin || false
  }

  // Debug logging
  React.useEffect(() => {
    console.log('PositionAuth Context Update:', {
      user: user ? {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        isAuthenticated: user.isAuthenticated,
        isSuperAdmin: user.isSuperAdmin
      } : null,
      isLoading,
      isAdmin: user?.role === 'admin',
      isSuperAdmin: user?.isSuperAdmin || false,
      userRole: user?.role
    })
  }, [user, isLoading])

  return (
    <PositionAuthContext.Provider value={value}>
      {children}
    </PositionAuthContext.Provider>
  )
}

export function usePositionAuth() {
  const context = useContext(PositionAuthContext)
  if (context === undefined) {
    throw new Error('usePositionAuth must be used within a PositionAuthProvider')
  }
  return context
}