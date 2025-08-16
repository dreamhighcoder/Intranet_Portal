'use client'

import React, { useState, useEffect } from 'react'
import { usePositionAuth } from '@/lib/position-auth-context'

export function AutoLogoutDebug() {
  const { user } = usePositionAuth()
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!user) return

    // Show debug panel when user is logged in
    setIsVisible(true)

    // Start countdown from 30 seconds
    let timeLeft = 30
    setCountdown(timeLeft)

    const interval = setInterval(() => {
      timeLeft -= 1
      setCountdown(timeLeft)
      
      if (timeLeft <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    // Reset countdown on user activity
    const resetCountdown = () => {
      timeLeft = 30
      setCountdown(timeLeft)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'focus']
    events.forEach(eventType => {
      document.addEventListener(eventType, resetCountdown, { passive: true })
    })

    return () => {
      clearInterval(interval)
      events.forEach(eventType => {
        document.removeEventListener(eventType, resetCountdown)
      })
    }
  }, [user])

  if (!isVisible || !user) return null

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: countdown && countdown <= 10 ? '#ff4444' : '#007bff',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 9999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      minWidth: '200px',
      textAlign: 'center'
    }}>
      <div>Auto-Logout Debug</div>
      <div style={{ fontSize: '18px', margin: '5px 0' }}>
        {countdown !== null ? `${countdown}s` : 'Loading...'}
      </div>
      <div style={{ fontSize: '10px', opacity: 0.8 }}>
        Move mouse to reset
      </div>
    </div>
  )
}