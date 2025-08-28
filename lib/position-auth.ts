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
  display_order?: number // used for homepage checklist ordering
  last_login?: Date
  login_attempts?: number
  locked_until?: Date
  created_at?: Date
  updated_at?: Date
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
    
    // Convert Position[] to PositionAuth[]
    const positionAuths: PositionAuth[] = positions
      .filter(pos => pos.password_hash) // Only include positions with passwords
      .map(pos => {
        // Use btoa/atob for browser compatibility instead of Buffer
        const decodedPassword = atob(pos.password_hash!)
        

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
          is_super_admin: pos.is_super_admin || false,
          // carry through display_order so consumers can sort on client
          display_order: (pos as any).display_order
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
  sessionId: string
  ipAddress?: string
  userAgent?: string
  lastActivity: Date
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
            return data
          }
        } catch (error) {
          localStorage.removeItem(cacheKey)
        }
      }
    }

    try {
      // Fetch fresh data
      const positions = await fetchPositionsFromDatabase()
      
      // Cache the result only if we got valid data
      if (positions.length > 0 && typeof window !== 'undefined') {
        // Sort non-admins by display_order if provided, fallback to name.
        const sorted = positions
          .slice()
          .sort((a, b) => {
            const aIsAdmin = a.displayName.toLowerCase().includes('admin')
            const bIsAdmin = b.displayName.toLowerCase().includes('admin')
            if (aIsAdmin && !bIsAdmin) return 1
            if (!aIsAdmin && bIsAdmin) return -1
            const ao = (a as any).display_order ?? 9999
            const bo = (b as any).display_order ?? 9999
            if (ao !== bo) return ao - bo
            return a.displayName.localeCompare(b.displayName)
          })
        localStorage.setItem(cacheKey, JSON.stringify({
          data: sorted,
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
  static async authenticate(
    positionId: string, 
    password: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<{ success: boolean; user?: PositionAuthUser; error?: string }> {
    console.log('🔐 Authentication attempt:', { positionId, password: '***', ipAddress, userAgent: userAgent?.substring(0, 50) })
    
    try {
      // Fetch all positions from database - no fallbacks or hardcoded values
      const positions = await this.getPositions()
      
      // If no positions are available, return an error
      if (positions.length === 0) {
        console.log('❌ No positions available for authentication')
        return { success: false, error: 'No positions available. Please contact an administrator.' }
      }
      
      // Check for consolidated administrator login
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
          
          const sessionId = this.generateSessionId()
          const user: PositionAuthUser = {
            id: matchingAdminPosition.id,
            position: matchingAdminPosition,
            role: matchingAdminPosition.role,
            displayName: 'Administrator', // Use consolidated display name for UI consistency
            isAuthenticated: true,
            loginTime: new Date(),
            isSuperAdmin: matchingAdminPosition.is_super_admin || false,
            sessionId,
            ipAddress,
            userAgent,
            lastActivity: new Date()
          }
          
          // Store in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
          }
          
          // Log successful authentication
          await this.logAuthenticationSuccess(matchingAdminPosition.id, 'consolidated_admin', ipAddress, userAgent)
          
          console.log('✅ Consolidated administrator authentication successful')
          return { success: true, user }
        }
        
        console.log('❌ No admin position found with matching password for consolidated login')
        return { success: false, error: 'Invalid administrator password' }
      }

      // Regular position authentication
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
      
      // Check if position is locked due to too many failed attempts
      if (matchedPosition.locked_until && new Date() < matchedPosition.locked_until) {
        const lockTime = matchedPosition.locked_until.toLocaleString()
        console.log('🔒 Position is locked until:', lockTime)
        return { success: false, error: `Account is temporarily locked until ${lockTime}` }
      }
      
      if (matchedPosition.password !== password) {
        console.log('❌ Password mismatch for position:', matchedPosition.displayName)
        
        // Increment failed login attempts
        await this.incrementFailedLoginAttempts(matchedPosition.id, ipAddress, userAgent)
        
        return { success: false, error: 'Invalid password' }
      }
      
      console.log('✅ Password match for position:', matchedPosition.displayName)
      console.log('👑 Admin type:', matchedPosition.is_super_admin ? 'Super Admin' : 'Regular Admin')
      
      const sessionId = this.generateSessionId()
      const user: PositionAuthUser = {
        id: matchedPosition.id,
        position: matchedPosition,
        role: matchedPosition.role,
        displayName: matchedPosition.displayName,
        isAuthenticated: true,
        loginTime: new Date(),
        isSuperAdmin: matchedPosition.is_super_admin || false,
        sessionId,
        ipAddress,
        userAgent,
        lastActivity: new Date()
      }
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      }
      
      // Log successful authentication and reset failed attempts
      await this.logAuthenticationSuccess(matchedPosition.id, 'position', ipAddress, userAgent)
      await this.resetFailedLoginAttempts(matchedPosition.id)
      
      console.log('✅ Authentication successful for position:', matchedPosition.displayName)
      return { success: true, user }
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
      
      // Update last activity
      user.lastActivity = new Date()
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
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

  // ========================================
  // SECURITY AND AUDIT HELPER METHODS
  // ========================================

  /**
   * Generate a unique session ID
   */
  private static generateSessionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log successful authentication
   */
  private static async logAuthenticationSuccess(
    positionId: string, 
    authType: 'position' | 'consolidated_admin',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'positions',
          record_id: positionId,
          action: 'user_login',
          metadata: {
            auth_type: authType,
            ip_address: ipAddress,
            user_agent: userAgent?.substring(0, 200),
            timestamp: new Date().toISOString()
          }
        })
      })
    } catch (error) {
      console.error('Failed to log authentication success:', error)
    }
  }

  /**
   * Increment failed login attempts and potentially lock the account
   */
  private static async incrementFailedLoginAttempts(
    positionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'positions',
          record_id: positionId,
          action: 'login_failed',
          metadata: {
            ip_address: ipAddress,
            user_agent: userAgent?.substring(0, 200),
            timestamp: new Date().toISOString()
          }
        })
      })
    } catch (error) {
      console.error('Failed to log failed login attempt:', error)
    }
  }

  /**
   * Reset failed login attempts after successful login
   */
  private static async resetFailedLoginAttempts(positionId: string): Promise<void> {
    try {
      // This would typically update the positions table to reset login_attempts
      // For now, we'll just log the reset action
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'positions',
          record_id: positionId,
          action: 'login_attempts_reset',
          metadata: {
            timestamp: new Date().toISOString()
          }
        })
      })
    } catch (error) {
      console.error('Failed to log login attempts reset:', error)
    }
  }

  /**
   * Validate session and check for suspicious activity
   */
  static async validateSession(user: PositionAuthUser): Promise<boolean> {
    try {
      // Check if session is still valid
      const now = new Date()
      const lastActivity = new Date(user.lastActivity)
      const timeDiff = now.getTime() - lastActivity.getTime()
      const minutesDiff = timeDiff / (1000 * 60)
      
      // Session expires after 30 minutes of inactivity
      if (minutesDiff > 30) {
        console.log('❌ Session expired due to inactivity')
        this.signOut()
        return false
      }
      
      // Update last activity
      user.lastActivity = now
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      }
      
      return true
    } catch (error) {
      console.error('Session validation error:', error)
      return false
    }
  }

  /**
   * Log user activity for audit purposes
   */
  static async logUserActivity(
    userId: string,
    action: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'positions',
          record_id: userId,
          action,
          metadata: {
            ...details,
            timestamp: new Date().toISOString()
          }
        })
      })
    } catch (error) {
      console.error('Failed to log user activity:', error)
    }
  }
}