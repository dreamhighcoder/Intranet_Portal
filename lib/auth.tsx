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
  logout: () => Promise<void> // Alias for compatibility
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUserProfile = async (currentUser: AuthUser) => {
    try {
      // Get user profile with positions
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          positions (*)
        `)
        .eq('id', currentUser.id)
        .single()

      if (profileError) {
        // If profile doesn't exist, create a default one for development
        if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows found')) {
          
          try {
            // Determine role based on email for demo purposes
            const isAdmin = currentUser.email?.includes('admin') || false
            const defaultRole = isAdmin ? 'admin' : 'viewer'
            console.log('Creating user profile for:', currentUser.email, 'with role:', defaultRole)
            
            // Create default profile
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: currentUser.id,
                display_name: currentUser.email?.split('@')[0] || 'User',
                role: defaultRole,
                position_id: '550e8400-e29b-41d4-a716-446655440001' // Default to Pharmacist Primary
              })
              .select()
              .single()

            if (createError) {
              console.error('Error creating user profile:', createError)
              // Set user with null profile atomically to prevent flickering
              setUser({
                ...currentUser,
                profile: null,
                position: null
              })
              setIsLoading(false)
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
                const { data: allPositions, error: allPositionsError } = await supabase
                  .from('positions')
                  .select('*')
                
                if (!allPositionsError && allPositions) {
                  position = allPositions.find(p => p.id === profile.position_id) || allPositions[0] || null
                }
              } else {
                position = positionData
              }
            }

            // Set user with complete profile data atomically
            setUser({
              ...currentUser,
              profile,
              position
            })
            setIsLoading(false)
            return
          } catch (createProfileError) {
            console.error('Failed to create profile:', createProfileError)
            // Set user with null profile atomically
            setUser({
              ...currentUser,
              profile: null,
              position: null
            })
            setIsLoading(false)
            return
          }
        }
        
        console.error('Error fetching user profile:', profileError)
        // Set user with null profile atomically
        setUser({
          ...currentUser,
          profile: null,
          position: null
        })
        setIsLoading(false)
        return
      }

      // Position should already be included from the joined query
      const position = profile.positions || null

      // If no position in join but position_id exists, try to fetch it separately (fallback)
      let finalPosition = position
      if (!position && profile.position_id) {
        const { data: positionData, error: positionError } = await supabase
          .from('positions')
          .select('*')
          .eq('id', profile.position_id)
          .single()

        if (!positionError && positionData) {
          finalPosition = positionData
        }
      }

      // Set complete user data atomically to prevent flickering
      setUser({
        ...currentUser,
        profile,
        position: finalPosition
      })
    } catch (error) {
      console.error('Error loading user profile:', error)
      // Set user with null profile atomically
      setUser({
        ...currentUser,
        profile: null,
        position: null
      })
    }
    setIsLoading(false)
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await loadUserProfile(session.user as AuthUser)
    }
  }

  useEffect(() => {
    console.log('Auth context - Initializing auth state')
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      console.log('Auth context - Initial session check:', {
        sessionExists: !!session,
        userExists: !!session?.user,
        userEmail: session?.user?.email,
        error: error?.message
      })
      

      
      if (session?.user) {
        console.log('Auth context - Setting initial user from session')
        setUser(session.user as AuthUser)
        // Load profile immediately to prevent flickering
        await loadUserProfile(session.user as AuthUser)
      } else {
        console.log('Auth context - No session found, setting loading to false')
        setIsLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth context - Auth state changed:', {
        event,
        sessionExists: !!session,
        userExists: !!session?.user,
        userEmail: session?.user?.email
      })
      

      
      if (session?.user) {
        setUser(session.user as AuthUser)
        // Load profile immediately to prevent flickering
        await loadUserProfile(session.user as AuthUser)
      } else {
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('Auth context - Attempting sign in for:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    console.log('Auth context - Sign in result:', {
      success: !error,
      error: error?.message,
      userExists: !!data?.user,
      sessionExists: !!data?.session
    })
    

    
    return { error }
  }

  const signOut = async () => {
    console.log('Auth context - Signing out')
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    refreshProfile,
    logout: signOut // Add alias for compatibility
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