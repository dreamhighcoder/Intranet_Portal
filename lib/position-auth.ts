import { PositionAuth, PositionType, Position } from './types'

// No hardcoded fallback positions - all authentication must use database

// Cache for positions data
let positionsCache: PositionAuth[] | null = null
let cacheExpiry: number = 0
const CACHE_TTL = 30000 // 30 seconds

async function fetchPositionsFromDatabase(): Promise<PositionAuth[]> {
  try {
    const response = await fetch('/api/positions', {
      headers: {
        'X-Position-Auth': 'true'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.status}`)
    }
    
    const positions: Position[] = await response.json()
    console.log('🗄️ Fetched positions from database:', positions.length)
    console.log('🗄️ Raw positions data:', positions.map(p => ({
      id: p.id,
      name: p.name,
      hasPasswordHash: !!p.password_hash,
      passwordHashLength: p.password_hash?.length || 0,
      passwordHash: p.password_hash ? p.password_hash.substring(0, 10) + '...' : 'NONE'
    })))
    
    // Convert Position[] to PositionAuth[]
    const positionAuths: PositionAuth[] = positions
      .filter(pos => pos.password_hash) // Only include positions with passwords
      .map(pos => {
        const decodedPassword = Buffer.from(pos.password_hash!, 'base64').toString()
        
        console.log(`🔓 Processing position "${pos.name}":`, {
          hasPasswordHash: !!pos.password_hash,
          passwordHash: pos.password_hash ? pos.password_hash.substring(0, 10) + '...' : 'NONE',
          decodedPassword: decodedPassword
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
          role
        }
      })
    
    console.log('🔓 Processed positions with valid passwords:', positionAuths.length)
    return positionAuths
  } catch (error) {
    console.error('Error fetching positions from database:', error)
    throw new Error(`Database connection required for authentication: ${error.message}`)
  }
}



export interface PositionAuthUser {
  id: string
  position: PositionAuth
  role: "admin" | "viewer"
  displayName: string
  isAuthenticated: boolean
  loginTime: Date
}

export class PositionAuthService {
  private static readonly STORAGE_KEY = 'position_auth_user'

  // Get positions with caching
  static async getPositions(): Promise<PositionAuth[]> {
    const now = Date.now()
    
    // Return cached data if still valid
    if (positionsCache && now < cacheExpiry) {
      return positionsCache
    }
    
    // Fetch fresh data
    positionsCache = await fetchPositionsFromDatabase()
    cacheExpiry = now + CACHE_TTL
    
    return positionsCache
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
      console.log('📋 Available positions from database:', positions.map(p => ({ 
        id: p.id, 
        name: p.name, 
        displayName: p.displayName, 
        hasPassword: !!p.password,
        passwordLength: p.password?.length || 0
      })))
      
      // Handle consolidated administrator ID
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
          hasPassword: !!p.password
        })))
        
        // Try to authenticate against any admin position with matching password
        const matchingAdminPosition = adminPositions.find(p => p.password === password)
        
        if (matchingAdminPosition) {
          console.log('✅ Found matching admin position for consolidated login:', matchingAdminPosition.displayName)
          
          const user: PositionAuthUser = {
            id: matchingAdminPosition.id,
            position: matchingAdminPosition,
            role: matchingAdminPosition.role,
            displayName: 'Administrator', // Use consolidated display name for UI consistency
            isAuthenticated: true,
            loginTime: new Date()
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
      console.log('🎯 Found position by ID:', matchedPosition ? { 
        id: matchedPosition.id, 
        name: matchedPosition.name, 
        displayName: matchedPosition.displayName,
        hasPassword: !!matchedPosition.password,
        passwordLength: matchedPosition.password?.length || 0
      } : 'NOT FOUND')
      
      if (!matchedPosition) {
        console.log('❌ Position not found for ID:', positionId)
        return { success: false, error: 'Position not found' }
      }
      
      // Check if password matches the selected position
      if (matchedPosition.password === password) {
        console.log('✅ Direct position/password match')
        const user: PositionAuthUser = {
          id: matchedPosition.id,
          position: matchedPosition,
          role: matchedPosition.role,
          displayName: matchedPosition.displayName,
          isAuthenticated: true,
          loginTime: new Date()
        }
        
        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
        }
        
        console.log('✅ Direct authentication successful for:', matchedPosition.displayName)
        return { success: true, user }
      }
      
      // If direct match failed, check if this is an administrator position
      // and try to find ANY administrator position with matching password
      const isAdminPosition = matchedPosition.role === 'admin' || 
        matchedPosition.name.toLowerCase().includes('admin') || 
        matchedPosition.displayName.toLowerCase().includes('admin')
        
      if (isAdminPosition) {
        console.log('🔍 Administrator position detected, checking for any matching admin password...')
        
        // Find all admin positions and check if any has the matching password
        const adminPositions = positions.filter(p => 
          p.role === 'admin' || 
          p.name.toLowerCase().includes('admin') || 
          p.displayName.toLowerCase().includes('admin')
        )
        
        console.log('👑 Found admin positions:', adminPositions.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          hasPassword: !!p.password
        })))
        
        // Try to authenticate against any admin position with matching password
        const matchingAdminPosition = adminPositions.find(p => p.password === password)
        
        if (matchingAdminPosition) {
          console.log('✅ Found matching admin position:', matchingAdminPosition.displayName)
          
          const user: PositionAuthUser = {
            id: matchingAdminPosition.id,
            position: matchingAdminPosition,
            role: matchingAdminPosition.role,
            displayName: matchingAdminPosition.displayName,
            isAuthenticated: true,
            loginTime: new Date()
          }
          
          // Store in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
          }
          
          console.log('✅ Multi-admin authentication successful for:', matchingAdminPosition.displayName)
          return { success: true, user }
        }
        
        console.log('❌ No admin position found with matching password')
        return { success: false, error: 'Invalid administrator password' }
      }
      
      console.log('❌ Password mismatch for non-admin position')
      return { success: false, error: 'Invalid password' }
      
    } catch (error) {
      console.error('❌ Authentication failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Authentication failed - database connection required' }
    }
  }
  
  // Get current authenticated user
  static async getCurrentUser(): Promise<PositionAuthUser | null> {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null
      
      const user: PositionAuthUser = JSON.parse(stored)
      
      // Basic validation - just check if the user object has required fields
      if (!user.id || !user.position || !user.role || !user.displayName) {
        console.log('Invalid stored user data, clearing localStorage')
        localStorage.removeItem(this.STORAGE_KEY)
        return null
      }
      
      // Check if login is too old (24 hours)
      const loginTime = new Date(user.loginTime)
      const now = new Date()
      const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLogin > 24) {
        console.log('Login expired, clearing localStorage')
        localStorage.removeItem(this.STORAGE_KEY)
        return null
      }
      
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }
  
  // Sign out current user
  static signOut(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }
  
  // Get all available positions
  static async getAllPositions(): Promise<PositionAuth[]> {
    return await this.getPositions()
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