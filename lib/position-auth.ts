import { PositionAuth, PositionType, Position } from './types'

// Default fallback positions for when database is not available
const FALLBACK_POSITION_AUTH_CONFIG: PositionAuth[] = [
  {
    id: 'administrator',
    name: 'administrator',
    displayName: 'Administrator',
    password: 'admin123',
    role: 'admin'
  },
  // Also try to match the database Administrator by UUID if it was created
  {
    id: 'd103cf6c-8e5b-454c-aeab-d4f6b6403bea',
    name: 'administrator',
    displayName: 'Administrator', 
    password: 'admin123',
    role: 'admin'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'pharmacist-primary',
    displayName: 'Pharmacist (Primary)',
    password: 'pharmprim123',
    role: 'viewer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'pharmacist-supporting',
    displayName: 'Pharmacist (Supporting)',
    password: 'pharmsup123',
    role: 'viewer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'pharmacy-assistants',
    displayName: 'Pharmacy Assistants',
    password: 'assistant123',
    role: 'viewer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'dispensary-technicians',
    displayName: 'Dispensary Technicians',
    password: 'tech123',
    role: 'viewer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'daa-packers',
    displayName: 'DAA Packers',
    password: 'packer123',
    role: 'viewer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    name: 'operational-managerial',
    displayName: 'Operational/Managerial',
    password: 'ops123',
    role: 'viewer'
  }
]

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
    const positionAuths: PositionAuth[] = positions.map(pos => {
      const decodedPassword = pos.password_hash ? 
        Buffer.from(pos.password_hash, 'base64').toString() : 
        getDefaultPassword(pos.name)
      
      console.log(`🔓 Processing position "${pos.name}":`, {
        hasPasswordHash: !!pos.password_hash,
        passwordHash: pos.password_hash ? pos.password_hash.substring(0, 10) + '...' : 'NONE',
        decodedPassword: decodedPassword
      })
      
      // Determine role based on position name or ID
      let role: 'admin' | 'viewer' = 'viewer'
      const nameCheck = pos.name.toLowerCase()
      const idCheck = pos.id.toLowerCase()
      
      if (nameCheck.includes('administrator') || 
          nameCheck.includes('admin') || 
          idCheck === 'administrator' ||
          idCheck === 'd103cf6c-8e5b-454c-aeab-d4f6b6403bea') {
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
    
    return positionAuths
  } catch (error) {
    console.error('Error fetching positions from database:', error)
    return FALLBACK_POSITION_AUTH_CONFIG
  }
}

function getDefaultPassword(positionName: string): string {
  // Generate default passwords based on position name for fallback
  const fallback = FALLBACK_POSITION_AUTH_CONFIG.find(
    p => p.displayName === positionName
  )
  return fallback ? fallback.password : 'default123'
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

  // Authenticate with position and password
  static async authenticate(positionId: string, password: string): Promise<{ success: boolean; user?: PositionAuthUser; error?: string }> {
    console.log('🔐 Authentication attempt:', { positionId, password: '***' })
    
    // Check for hardcoded Administrator first
    if (positionId === 'administrator' || positionId === 'd103cf6c-8e5b-454c-aeab-d4f6b6403bea') {
      const hardcodedAdmin: PositionAuth = {
        id: positionId, // Use the provided ID
        name: 'administrator',
        displayName: 'Administrator',
        password: 'admin123',
        role: 'admin'
      }
      
      console.log('🎯 Using hardcoded Administrator position with ID:', positionId)
      console.log('🔑 Password comparison:', { 
        provided: password, 
        expected: hardcodedAdmin.password, 
        match: hardcodedAdmin.password === password 
      })
      
      if (hardcodedAdmin.password !== password) {
        console.log('❌ Password mismatch for hardcoded Administrator')
        return { success: false, error: 'Invalid password' }
      }
      
      const user: PositionAuthUser = {
        id: hardcodedAdmin.id,
        position: hardcodedAdmin,
        role: hardcodedAdmin.role,
        displayName: hardcodedAdmin.displayName,
        isAuthenticated: true,
        loginTime: new Date()
      }
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      }
      
      console.log('✅ Hardcoded Administrator authentication successful')
      return { success: true, user }
    }
    
    // For other positions, fetch from database
    const positions = await this.getPositions()
    console.log('📋 Available positions:', positions.map(p => ({ 
      id: p.id, 
      name: p.name, 
      displayName: p.displayName, 
      hasPassword: !!p.password,
      passwordLength: p.password?.length || 0
    })))
    
    const position = positions.find(p => p.id === positionId)
    console.log('🎯 Found position:', position ? { 
      id: position.id, 
      name: position.name, 
      displayName: position.displayName,
      hasPassword: !!position.password,
      passwordLength: position.password?.length || 0,
      expectedPassword: position.password
    } : 'NOT FOUND')
    
    if (!position) {
      console.log('❌ Position not found for ID:', positionId)
      return { success: false, error: 'Position not found' }
    }
    
    console.log('🔑 Password comparison:', { 
      provided: password, 
      expected: position.password, 
      match: position.password === password 
    })
    
    if (position.password !== password) {
      console.log('❌ Password mismatch')
      return { success: false, error: 'Invalid password' }
    }
    
    const user: PositionAuthUser = {
      id: position.id,
      position,
      role: position.role,
      displayName: position.displayName,
      isAuthenticated: true,
      loginTime: new Date()
    }
    
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
    }
    
    return { success: true, user }
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

  // Synchronous fallback methods for backward compatibility
  static getAllPositionsFallback(): PositionAuth[] {
    return positionsCache || FALLBACK_POSITION_AUTH_CONFIG
  }
  
  static getChecklistPositionsFallback(): PositionAuth[] {
    const positions = positionsCache || FALLBACK_POSITION_AUTH_CONFIG
    return positions.filter(p => p.name !== 'administrator' && !p.displayName.toLowerCase().includes('administrator'))
  }
}