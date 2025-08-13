'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, type UserProfile, type Position } from './supabase'

interface AuthUser extends User {
  profile?: UserProfile
  position?: Position
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshProfile = async () => {
    if (!user) return

    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        // If profile doesn't exist, create a default one for development
        if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows found')) {
          console.log('Creating default profile for user:', user.email)
          
          try {
            // Determine role based on email for demo purposes
            const isAdmin = user.email?.includes('admin') || false
            const defaultRole = isAdmin ? 'admin' : 'viewer'
            
            // Create default profile
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: user.id,
                display_name: user.email?.split('@')[0] || 'User',
                role: defaultRole,
                position_id: '550e8400-e29b-41d4-a716-446655440001' // Default to Pharmacist Primary
              })
              .select()
              .single()

            if (createError) {
              console.error('Error creating user profile:', createError)
              // Continue without profile for now - user can still access basic features
              setUser(prevUser => ({
                ...prevUser!,
                profile: null,
                position: null
              }))
              return
            }

            // Use the newly created profile
            const profile = newProfile
            
            // Get position
            let position = null
            if (profile.position_id) {
              const { data: positionData, error: positionError } = await supabase
                .from('positions')
                .select('*')
                .eq('id', profile.position_id)
                .single()

              if (positionError) {
                console.error('Error fetching position for new profile:', positionError)
                // Try to fetch all positions as fallback
                const { data: allPositions, error: allPositionsError } = await supabase
                  .from('positions')
                  .select('*')
                
                if (!allPositionsError && allPositions) {
                  position = allPositions.find(p => p.id === profile.position_id) || null
                  if (position) {
                    console.log('Position found via fallback for new profile:', position.name)
                  } else {
                    console.warn('Position not found for new profile. Position ID:', profile.position_id)
                    // Use the first available position as fallback
                    position = allPositions.length > 0 ? allPositions[0] : null
                    if (position) {
                      console.log('Using first available position as fallback:', position.name)
                    }
                  }
                } else {
                  console.error('Failed to fetch positions for new profile:', allPositionsError)
                  position = null
                }
              } else {
                position = positionData
              }
            }

            setUser(prevUser => ({
              ...prevUser!,
              profile,
              position
            }))
            return
          } catch (createProfileError) {
            console.error('Failed to create profile:', createProfileError)
            // Set user without profile
            setUser(prevUser => ({
              ...prevUser!,
              profile: null,
              position: null
            }))
            return
          }
        }
        
        console.error('Error fetching user profile:', profileError)
        // Set user without profile for database issues
        setUser(prevUser => ({
          ...prevUser!,
          profile: null,
          position: null
        }))
        return
      }

      // Get position if user has one
      let position = null
      if (profile.position_id) {
        const { data: positionData, error: positionError } = await supabase
          .from('positions')
          .select('*')
          .eq('id', profile.position_id)
          .single()

        if (positionError) {
          console.error('Error fetching position:', positionError)
          // If position fetch fails due to RLS or other issues, try alternative approaches
          
          // First, try to fetch all positions and find the one we need
          const { data: allPositions, error: allPositionsError } = await supabase
            .from('positions')
            .select('*')
          
          if (!allPositionsError && allPositions) {
            position = allPositions.find(p => p.id === profile.position_id) || null
            if (position) {
              console.log('Position found via fallback approach:', position.name)
            } else {
              console.warn('Position not found in positions list. Position ID:', profile.position_id)
              console.log('Available positions:', allPositions.map(p => ({ id: p.id, name: p.name })))
            }
          } else {
            console.error('Failed to fetch positions as fallback:', allPositionsError)
            
            // Last resort: set position to null and continue
            console.warn('Unable to fetch position data. User will continue without position info.')
            position = null
          }
        } else {
          position = positionData
        }
      }

      setUser(prevUser => ({
        ...prevUser!,
        profile,
        position
      }))
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as AuthUser)
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user as AuthUser)
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !user.profile) {
      refreshProfile()
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper functions for role checking
export function isAdmin(user: AuthUser | null): boolean {
  return user?.profile?.role === 'admin'
}

export function isViewer(user: AuthUser | null): boolean {
  return user?.profile?.role === 'viewer'
}

export function hasPosition(user: AuthUser | null): boolean {
  return !!user?.profile?.position_id
}