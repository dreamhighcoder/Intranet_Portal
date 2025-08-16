import { Position } from './types'

// No hardcoded fallback positions - all authentication must use database

// Cache for positions data
let positionsCache: any[] | null = null
let cacheExpiry: number = 0
const CACHE_TTL = 30000 // 30 seconds

export interface PositionAuth {
  id: string
  name: string
  displayName: string
  password: string
  role: 'admin' | 'viewer'
  is_super_admin?: boolean
}

async function fetchPositionsFromDatabase(): Promise<PositionAuth[]> {
  try {
    const response = await fetch('/api/positions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('🔓 Failed to fetch positions:', response.status, response.statusText)
      // Return empty array instead of throwing error to prevent authentication failure
      return []
    }

    const positions: any[] = await response.json()
    
    console.log('🔓 Raw positions from database:', positions.map(p => ({
      id: p.id,
      name: p.name,
      hasPasswordHash: !!p.password_hash,
      passwordHash: p.password_hash ? p.password_hash.substring(0, 10) + '...' : 'NONE'
    })))
    
    // Convert Position[] to PositionAuth[]
    const positionAuths: PositionAuth[] = positions
      .filter(pos => pos.password_hash) // Only include positions with passwords
      .map(pos => {
        // Use btoa/atob for browser compatibility instead of Buffer
        const decodedPassword = atob(pos.password_hash!)
        
        console.log(`🔓 Processing position "${pos.name}":`, {
          hasPasswordHash: !!pos.password_hash,
          passwordHash: pos.password_hash ? pos.password_hash.substring(0, 10) + '...' : 'NONE',
          decodedPassword: decodedPassword,
          isSuperAdmin: pos.is_super_admin || false
        })
        
        // Determine role based on position name
        let role: 'admin' | 'viewer' = 'viewer'
        const nameCheck = pos.name.toLowerCase()
        
        if (nameCheck.includes('administrator') || nameCheck.includes('admin')) {
          role = 'admin'
        }

        return {
          id: pos.id,
          name: pos.name.toLowerCase().replace(/\s+/g, '-'),
          displayName: pos.name,
          password: decodedPassword,
          role,
          is_super_admin: pos.is_super_admin || false
        }
      })
    
    console.log('🔓 Processed positions with valid passwords:', positionAuths.length)
    return positionAuths
  } catch (error: any) {
    console.error('🔓 Error fetching positions from database:', error)
    // Return empty array instead of throwing error to prevent authentication failure
    return []
  }
}



export interface PositionAuthUser {
  id: string
  position: PositionAuth
  role: 'admin' | 'viewer'
  displayName: string
  isAuthenticated: boolean
  loginTime: Date
  isSuperAdmin: boolean
}

export class PositionAuthService {
  private static readonly STORAGE_KEY = 'position_auth_user'

  // Get positions with caching
  static async getPositions(): Promise<PositionAuth[]> {
    const now = Date.now()
    const cacheKey = 'positions_cache'
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes

    // Check cache first
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached)
          if (now - timestamp < cacheExpiry) {
            console.log('🔓 Using cached positions')
            return data
          }
        } catch (error) {
          console.warn('🔓 Failed to parse cached positions, clearing cache')
          localStorage.removeItem(cacheKey)
        }
      }
    }

    try {
      // Fetch fresh data
      const positions = await fetchPositionsFromDatabase()
      
      // Cache the result only if we got valid data
      if (positions.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: positions,
          timestamp: now
        }))
      }
      
      return positions
    } catch (error) {
      console.error('🔓 Failed to fetch positions:', error)
      // Return empty array if fetch fails
      return []
    }
  }

  // Clear positions cache (call after creating/updating/deleting positions)
  static clearCache(): void {
    positionsCache = null
    cacheExpiry = 0
    // Notify listeners across the app so UIs can refresh immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('positions-updated'))
    }
  }

  // Authenticate with position and password - ALL authentication must use database
  static async authenticate(positionId: string, password: string): Promise<{ success: boolean; user?: PositionAuthUser; error?: string }> {
    console.log('🔐 Authentication attempt:', { positionId, password: '***' })
    
    try {
      // Fetch all positions from database - no fallbacks or hardcoded values
      const positions = await this.getPositions()
      
      // If no positions are available, return an error
      if (positions.length === 0) {
        console.log('❌ No positions available for authentication')
        return { success: false, error: 'No positions available. Please contact an administrator.' }
      }
      
      if (positionId === 'administrator-consolidated') {
        console.log('🔍 Consolidated administrator login detected')
        
        // Find all admin positions and check if any has the matching password
        const adminPositions = positions.filter(p => 
          p.role === 'admin' || 
          p.name.toLowerCase().includes('admin') || 
          p.displayName.toLowerCase().includes('admin')
        )
        
        console.log('👑 Found admin positions for consolidated login:', adminPositions.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          hasPassword: !!p.password,
          isSuperAdmin: p.is_super_admin || false
        })))
        
        // Try to authenticate against any admin position with matching password
        const matchingAdminPosition = adminPositions.find(p => p.password === password)
        
        if (matchingAdminPosition) {
          console.log('✅ Found matching admin position for consolidated login:', matchingAdminPosition.displayName)
          console.log('👑 Admin type:', matchingAdminPosition.is_super_admin ? 'Super Admin' : 'Regular Admin')
          
          const user: PositionAuthUser = {
            id: matchingAdminPosition.id,
            position: matchingAdminPosition,
            role: matchingAdminPosition.role,
            displayName: 'Administrator', // Use consolidated display name for UI consistency
            isAuthenticated: true,
            loginTime: new Date(),
            isSuperAdmin: matchingAdminPosition.is_super_admin || false
          }
          
          // Store in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
          }
          
          console.log('✅ Consolidated administrator authentication successful')
          return { success: true, user }
        }
        
        console.log('❌ No admin position found with matching password for consolidated login')
        return { success: false, error: 'Invalid administrator password' }
      }

      let matchedPosition = positions.find(p => p.id === positionId)
      console.log('🎯 Found position by ID:', matchedPosition?.displayName || 'NOT_FOUND')
      
      if (!matchedPosition) {
        console.log('❌ Position not found by ID, trying by name')
        matchedPosition = positions.find(p => p.name === positionId)
        console.log('🎯 Found position by name:', matchedPosition?.displayName || 'NOT_FOUND')
      }
      
      if (!matchedPosition) {
        console.log('❌ No position found for authentication')
        return { success: false, error: 'Position not found' }
      }
      
      if (matchedPosition.password !== password) {
        console.log('❌ Password mismatch for position:', matchedPosition.displayName)
        return { success: false, error: 'Invalid password' }
      }
      
      console.log('✅ Password match for position:', matchedPosition.displayName)
      console.log('👑 Admin type:', matchedPosition.is_super_admin ? 'Super Admin' : 'Regular Admin')
      
      const user: PositionAuthUser = {
        id: matchedPosition.id,
        position: matchedPosition,
        role: matchedPosition.role,
        displayName: matchedPosition.displayName,
        isAuthenticated: true,
        loginTime: new Date(),
        isSuperAdmin: matchedPosition.is_super_admin || false
      }
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      }
      
      console.log('✅ Authentication successful for position:', matchedPosition.displayName)
      return { success: true, user }
      
    } catch (error: any) {
      console.error('Authentication error:', error)
      return { success: false, error: error.message || 'Authentication failed' }
    }
  }
  
  // Get current authenticated user
  static async getCurrentUser(): Promise<PositionAuthUser | null> {
    if (typeof window === 'undefined') {
      return null
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        return null
      }
      
      const user = JSON.parse(stored) as PositionAuthUser
      
      // Validate that the user data is complete
      if (!user.id || !user.position || !user.role || !user.isAuthenticated) {
        console.log('❌ Invalid user data in storage, clearing')
        this.signOut()
        return null
      }
      
      // Check if login is still valid (24 hours)
      const loginTime = new Date(user.loginTime)
      const now = new Date()
      const timeDiff = now.getTime() - loginTime.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)
      
      if (hoursDiff > 24) {
        console.log('❌ Login expired, clearing')
        this.signOut()
        return null
      }
      
      console.log('✅ Current user retrieved:', {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        isSuperAdmin: user.isSuperAdmin
      })
      
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      this.signOut()
      return null
    }
  }
  
  // Sign out current user
  static signOut(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
      localStorage.removeItem('positions_cache')
    }
  }
  
  // Get all available positions
  static async getAllPositions(): Promise<PositionAuth[]> {
    return this.getPositions()
  }
  
  // Get checklist positions (all except administrator)
  static async getChecklistPositions(): Promise<PositionAuth[]> {
    const positions = await this.getPositions()
    return positions.filter(p => p.name !== 'administrator' && !p.displayName.toLowerCase().includes('administrator'))
  }

  // Synchronous fallback methods for backward compatibility - return cache only
  static getAllPositionsFallback(): PositionAuth[] {
    return positionsCache || []
  }
  
  static getChecklistPositionsFallback(): PositionAuth[] {
    const positions = positionsCache || []
    return positions.filter(p => p.name !== 'administrator' && !p.displayName.toLowerCase().includes('administrator'))
  }
}