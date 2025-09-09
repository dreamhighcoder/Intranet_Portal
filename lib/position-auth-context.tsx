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
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const router = useRouter()
  
  // Auto-logout functionality
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const autoLogoutEnabledRef = useRef<boolean>(false) // Start disabled until settings load
  const autoLogoutDelayRef = useRef<number>(0) // Will be set from database

  // Load auto-logout settings from API endpoint
  const loadAutoLogoutSettings = useCallback(async (forceRefresh: boolean = false) => {
    try {
      // Add cache-busting parameter if force refresh
      const url = forceRefresh 
        ? `/api/system-settings/auto-logout?t=${Date.now()}`
        : '/api/system-settings/auto-logout'
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Disable caching for fresh data
        cache: forceRefresh ? 'no-cache' : 'default'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`API request failed: ${response.status} - ${errorData.error || 'Unknown error'}`)
      }
      
      const settings = await response.json()
      
      // Validate the settings
      if (typeof settings.delayMinutes !== 'number' || settings.delayMinutes <= 0) {
        throw new Error(`Invalid delayMinutes from API: ${settings.delayMinutes} (type: ${typeof settings.delayMinutes})`)
      }
      
      autoLogoutEnabledRef.current = settings.enabled
      autoLogoutDelayRef.current = settings.delayMinutes
      
      setSettingsLoaded(true)
    } catch (error) {
      console.error('Error loading auto-logout settings:', error)
      
      // Emergency fallback - disable auto-logout rather than use wrong timing
      autoLogoutEnabledRef.current = false
      autoLogoutDelayRef.current = 0
      
      setSettingsLoaded(true)
    }
  }, [])

  // Auto-logout due to inactivity
  const performAutoLogout = useCallback(() => {
    try {
      PositionAuthService.signOut()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('Error during auto-logout:', error)
    }
  }, [router])

  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // Only set new timer if user is logged in, auto-logout is enabled, and we have valid delay
    if (user && autoLogoutEnabledRef.current && autoLogoutDelayRef.current > 0) {
      const timeoutMs = autoLogoutDelayRef.current * 60 * 1000 // Convert minutes to milliseconds
      
      inactivityTimerRef.current = setTimeout(() => {
        performAutoLogout()
      }, timeoutMs)
    }
  }, [user, performAutoLogout, settingsLoaded])

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
        
        // Load auto-logout settings (force refresh to get latest values)
        await loadAutoLogoutSettings(true)
      } catch (error) {
        console.error('Error loading current user:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadCurrentUser()
  }, [loadAutoLogoutSettings])

  // Set up activity listeners and inactivity timer when user changes AND settings are loaded
  useEffect(() => {
    if (user && settingsLoaded && autoLogoutEnabledRef.current && autoLogoutDelayRef.current > 0) {
      // Start the inactivity timer
      resetInactivityTimer()

      // Add activity event listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
      
      events.forEach(event => {
        document.addEventListener(event, handleUserActivity, true)
      })

      // Cleanup function
      return () => {
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
      // Clear timer if conditions not met
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [user, settingsLoaded, resetInactivityTimer, handleUserActivity])

  // Reload settings when they might have changed
  useEffect(() => {
    const handleSettingsChange = async () => {
      await loadAutoLogoutSettings(true) // Force refresh
      // Reset timer with new settings if user is logged in and settings are loaded
      if (user && settingsLoaded) {
        resetInactivityTimer()
      }
    }

    // Listen for settings changes (you can trigger this from the settings page)
    window.addEventListener('systemSettingsChanged', handleSettingsChange)
    
    return () => {
      window.removeEventListener('systemSettingsChanged', handleSettingsChange)
    }
  }, [user, settingsLoaded, loadAutoLogoutSettings, resetInactivityTimer])

  const signIn = async (positionId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await PositionAuthService.authenticate(positionId, password)
      
      if (result.success && result.user) {
        setUser(result.user)
        
        // Load auto-logout settings immediately after successful login
        await loadAutoLogoutSettings(true) // Force refresh
        
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
    try {
      PositionAuthService.signOut()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('Error during manual logout:', error)
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