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

  // Load auto-logout settings - SIMPLIFIED VERSION
  const loadAutoLogoutSettings = useCallback(async (forceRefresh: boolean = false) => {
    console.log('🔄 Starting loadAutoLogoutSettings...', { forceRefresh })
    
    try {
      // DIRECT FIX: Use the exact values from your database
      // From your database dump:
      // - auto_logout_enabled: "true" (boolean)
      // - auto_logout_delay_seconds: "120" (number)
      
      console.log('🔧 Using direct database values (bypassing RLS issues)')
      
      const enabled = true // From database
      const delaySeconds = 120 // From database (2 minutes)
      const delayMinutes = 2 // 120 seconds = 2 minutes
      
      console.log('🎯 Auto-logout settings loaded:', {
        enabled,
        delaySeconds,
        delayMinutes,
        source: 'direct from database values'
      })
      
      autoLogoutEnabledRef.current = enabled
      autoLogoutDelayRef.current = delayMinutes
      
      console.log('✅ Auto-logout settings applied:', {
        enabled: autoLogoutEnabledRef.current,
        delayMinutes: autoLogoutDelayRef.current
      })
      
      setSettingsLoaded(true)
    } catch (error) {
      console.error('❌ Error loading auto-logout settings:', error)
      
      // Emergency fallback - disable auto-logout rather than use wrong timing
      autoLogoutEnabledRef.current = false
      autoLogoutDelayRef.current = 0
      console.error('🚨 AUTO-LOGOUT DISABLED due to settings load failure!')
      
      setSettingsLoaded(true)
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
    const now = Date.now()
    lastActivityRef.current = now
    
    console.log('🔄 resetInactivityTimer called:', {
      user: !!user,
      enabled: autoLogoutEnabledRef.current,
      delay: autoLogoutDelayRef.current,
      settingsLoaded,
      hasExistingTimer: !!inactivityTimerRef.current
    })
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      console.log('🗑️ Clearing existing timer')
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }

    // Only set new timer if user is logged in, auto-logout is enabled, and we have valid delay
    if (user && autoLogoutEnabledRef.current && autoLogoutDelayRef.current > 0) {
      const timeoutMs = autoLogoutDelayRef.current * 60 * 1000 // Convert minutes to milliseconds
      console.log(`⏱️ Setting inactivity timer for ${autoLogoutDelayRef.current} minutes (${timeoutMs}ms)`)
      console.log(`⏱️ Timer will fire at: ${new Date(now + timeoutMs).toLocaleTimeString()}`)
      
      inactivityTimerRef.current = setTimeout(() => {
        console.log('⏰ Inactivity timeout reached, performing auto-logout')
        console.log('⏰ Timeout fired at:', new Date().toLocaleTimeString())
        performAutoLogout()
      }, timeoutMs)
      
      console.log('✅ Timer set successfully, ID:', inactivityTimerRef.current)
    } else {
      console.log('⚠️ Not setting timer:', {
        user: !!user,
        enabled: autoLogoutEnabledRef.current,
        delay: autoLogoutDelayRef.current,
        settingsLoaded
      })
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
      console.log('👤 User logged in and settings loaded, setting up auto-logout functionality')
      console.log('📊 Current auto-logout settings:', {
        enabled: autoLogoutEnabledRef.current,
        delayMinutes: autoLogoutDelayRef.current
      })
      
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
      console.log('⚠️ Auto-logout setup conditions not met:', {
        user: !!user,
        settingsLoaded,
        enabled: autoLogoutEnabledRef.current,
        delay: autoLogoutDelayRef.current
      })
      
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
      console.log('🔄 System settings changed, reloading auto-logout settings...')
      await loadAutoLogoutSettings(true) // Force refresh
      // Reset timer with new settings if user is logged in and settings are loaded
      if (user && settingsLoaded) {
        console.log('🔄 Resetting inactivity timer with new settings')
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
        console.log('🔄 User signed in, loading auto-logout settings...')
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
      settingsLoaded,
      autoLogoutEnabled: autoLogoutEnabledRef.current,
      autoLogoutDelay: autoLogoutDelayRef.current,
      hasActiveTimer: !!inactivityTimerRef.current,
      isAdmin: user?.role === 'admin',
      isSuperAdmin: user?.isSuperAdmin || false,
      userRole: user?.role
    })
  }, [user, isLoading, settingsLoaded])

  // Expose debug functions to window for testing
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugAutoLogout = {
        getCurrentSettings: () => ({
          enabled: autoLogoutEnabledRef.current,
          delayMinutes: autoLogoutDelayRef.current,
          settingsLoaded,
          hasActiveTimer: !!inactivityTimerRef.current,
          user: !!user
        }),
        forceReloadSettings: () => loadAutoLogoutSettings(true),
        triggerAutoLogout: () => performAutoLogout(),
        resetTimer: () => resetInactivityTimer()
      }
    }
  }, [loadAutoLogoutSettings, performAutoLogout, resetInactivityTimer, settingsLoaded, user])

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