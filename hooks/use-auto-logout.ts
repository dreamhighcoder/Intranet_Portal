import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSystemSettings } from '@/lib/system-settings'

interface UseAutoLogoutOptions {
  onWarning?: (timeLeft: number) => void
  onLogout?: () => void
  warningTime?: number // seconds before logout to show warning
}

export function useAutoLogout(options: UseAutoLogoutOptions = {}) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const settingsRef = useRef<{ enabled: boolean; delayMinutes: number } | null>(null)

  const { onWarning, onLogout, warningTime = 60 } = options

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }, [])

  // Perform logout
  const performLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      onLogout?.()
      router.push('/login')
    } catch (error) {
      console.error('Auto-logout error:', error)
      // Force redirect even if logout fails
      router.push('/login')
    }
  }, [router, onLogout])

  // Load settings and check if auto-logout is enabled
  const loadSettings = useCallback(async () => {
    try {
      const settings = await getSystemSettings()
      settingsRef.current = {
        enabled: settings.auto_logout_enabled,
        delayMinutes: settings.auto_logout_delay_minutes
      }
      return settingsRef.current
    } catch (error) {
      console.error('Failed to load auto-logout settings:', error)
      // Default to disabled if settings can't be loaded
      settingsRef.current = { enabled: false, delayMinutes: 5 }
      return settingsRef.current
    }
  }, [])

  // Reset the timeout
  const resetTimeout = useCallback(async () => {
    clearTimeouts()
    
    // Load settings if not already loaded
    const settings = settingsRef.current || await loadSettings()
    
    if (!settings.enabled) {
      return
    }

    const timeoutMs = settings.delayMinutes * 60 * 1000
    const warningMs = Math.max(0, timeoutMs - (warningTime * 1000))

    lastActivityRef.current = Date.now()

    // Set warning timeout
    if (warningMs > 0 && onWarning) {
      warningTimeoutRef.current = setTimeout(() => {
        onWarning(warningTime)
      }, warningMs)
    }

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      performLogout()
    }, timeoutMs)
  }, [clearTimeouts, loadSettings, warningTime, onWarning, performLogout])

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetTimeout()
  }, [resetTimeout])

  // Initialize and set up event listeners
  useEffect(() => {
    // Load settings and start timeout
    resetTimeout()

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ]

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Cleanup
    return () => {
      clearTimeouts()
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
    }
  }, [handleActivity, resetTimeout, clearTimeouts])

  // Return methods for manual control
  return {
    resetTimeout,
    clearTimeouts,
    getTimeLeft: () => {
      if (!settingsRef.current?.enabled || !timeoutRef.current) return null
      const elapsed = Date.now() - lastActivityRef.current
      const totalTimeout = settingsRef.current.delayMinutes * 60 * 1000
      return Math.max(0, totalTimeout - elapsed)
    },
    isEnabled: () => settingsRef.current?.enabled ?? false
  }
}