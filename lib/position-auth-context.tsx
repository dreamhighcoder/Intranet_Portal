'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { PositionAuthService, PositionAuthUser } from './position-auth'
import { useRouter } from 'next/navigation'
import { getSystemSettings } from './system-settings'

interface PositionAuthContextType {
  user: PositionAuthUser | null
  isLoading: boolean
  signIn: (positionId: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => void
  isAdmin: boolean
  isSuperAdmin: boolean
  resetInactivityTimer: () => void
}

const PositionAuthContext = createContext<PositionAuthContextType | undefined>(undefined)

export function PositionAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PositionAuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  
  // Auto-logout functionality
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const autoLogoutEnabledRef = useRef<boolean>(true)
  const autoLogoutDelayRef = useRef<number>(5) // minutes

  // Load auto-logout settings from system settings
  const loadAutoLogoutSettings = useCallback(async () => {
    try {
      const settings = await getSystemSettings()
      autoLogoutEnabledRef.current = settings.auto_logout_enabled
      autoLogoutDelayRef.current = settings.auto_logout_delay_minutes
      console.log('🔧 Auto-logout settings loaded:', {
        enabled: autoLogoutEnabledRef.current,
        delayMinutes: autoLogoutDelayRef.current
      })
    } catch (error) {
      console.error('❌ Error loading auto-logout settings:', error)
      // Use defaults if loading fails
      autoLogoutEnabledRef.current = true
      autoLogoutDelayRef.current = 5
    }
  }, [])

  // Auto-logout due to inactivity
  const performAutoLogout = useCallback(() => {
    console.log('⏰ Auto-logout triggered due to inactivity')
    try {
      PositionAuthService.signOut()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('❌ Error during auto-logout:', error)
    }
  }, [router])

  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    // Only set new timer if user is logged in and auto-logout is enabled
    if (user && autoLogoutEnabledRef.current) {
      const timeoutMs = autoLogoutDelayRef.current * 60 * 1000 // Convert minutes to milliseconds
      console.log(`⏱️ Setting inactivity timer for ${autoLogoutDelayRef.current} minutes`)
      
      inactivityTimerRef.current = setTimeout(() => {
        console.log('⏰ Inactivity timeout reached, performing auto-logout')
        performAutoLogout()
      }, timeoutMs)
    }
  }, [user, performAutoLogout])

  // Activity event handlers
  const handleUserActivity = useCallback(() => {
    if (user && autoLogoutEnabledRef.current) {
      resetInactivityTimer()
    }
  }, [user, resetInactivityTimer])

  useEffect(() => {
    // Check for existing authentication on mount
    const loadCurrentUser = async () => {
      try {
        const currentUser = await PositionAuthService.getCurrentUser()
        setUser(currentUser)
        
        // Load auto-logout settings
        await loadAutoLogoutSettings()
      } catch (error) {
        console.error('Error loading current user:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCurrentUser()
  }, [loadAutoLogoutSettings])

  // Set up activity listeners and inactivity timer when user changes
  useEffect(() => {
    if (user && autoLogoutEnabledRef.current) {
      console.log('👤 User logged in, setting up auto-logout functionality')
      
      // Start the inactivity timer
      resetInactivityTimer()

      // Add activity event listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
      
      events.forEach(event => {
        document.addEventListener(event, handleUserActivity, true)
      })

      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up auto-logout functionality')
        
        // Remove event listeners
        events.forEach(event => {
          document.removeEventListener(event, handleUserActivity, true)
        })
        
        // Clear timer
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current)
          inactivityTimerRef.current = null
        }
      }
    } else {
      // Clear timer if user is not logged in or auto-logout is disabled
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [user, resetInactivityTimer, handleUserActivity])

  // Reload settings when they might have changed
  useEffect(() => {
    const handleSettingsChange = async () => {
      await loadAutoLogoutSettings()
      // Reset timer with new settings if user is logged in
      if (user) {
        resetInactivityTimer()
      }
    }

    // Listen for settings changes (you can trigger this from the settings page)
    window.addEventListener('systemSettingsChanged', handleSettingsChange)
    
    return () => {
      window.removeEventListener('systemSettingsChanged', handleSettingsChange)
    }
  }, [user, loadAutoLogoutSettings, resetInactivityTimer])

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
    try {
      PositionAuthService.signOut()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('❌ PositionAuth: Error during manual logout:', error)
    }
  }



  const value: PositionAuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    isAdmin: user?.role === 'admin',
    isSuperAdmin: user?.isSuperAdmin || false,
    resetInactivityTimer
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