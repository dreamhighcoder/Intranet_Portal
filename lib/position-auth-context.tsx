'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { PositionAuthService, PositionAuthUser } from './position-auth'

interface PositionAuthContextType {
  user: PositionAuthUser | null
  isLoading: boolean
  signIn: (positionId: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => void
  isAdmin: boolean
}

const PositionAuthContext = createContext<PositionAuthContextType | undefined>(undefined)

export function PositionAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PositionAuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    PositionAuthService.signOut()
    setUser(null)
  }

  const value: PositionAuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    isAdmin: user?.role === 'admin'
  }

  // Debug logging
  React.useEffect(() => {
    console.log('PositionAuth Context Update:', {
      user: user ? {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        isAuthenticated: user.isAuthenticated
      } : null,
      isLoading,
      isAdmin: user?.role === 'admin',
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