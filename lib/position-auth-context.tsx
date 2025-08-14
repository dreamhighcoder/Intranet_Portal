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
    const currentUser = PositionAuthService.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)
  }, [])

  const signIn = async (positionId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = PositionAuthService.authenticate(positionId, password)
    
    if (result.success && result.user) {
      setUser(result.user)
      return { success: true }
    } else {
      return { success: false, error: result.error }
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