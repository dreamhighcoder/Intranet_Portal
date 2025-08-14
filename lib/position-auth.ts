import { PositionAuth, PositionType } from './types'

// Position authentication configuration
export const POSITION_AUTH_CONFIG: PositionAuth[] = [
  {
    id: 'administrator',
    name: 'administrator',
    displayName: 'Administrator',
    password: 'admin123', // In production, this should be configurable
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

  // Authenticate with position and password
  static authenticate(positionId: string, password: string): { success: boolean; user?: PositionAuthUser; error?: string } {
    const position = POSITION_AUTH_CONFIG.find(p => p.id === positionId)
    
    if (!position) {
      return { success: false, error: 'Position not found' }
    }
    
    if (position.password !== password) {
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
  static getCurrentUser(): PositionAuthUser | null {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null
      
      const user: PositionAuthUser = JSON.parse(stored)
      
      // Verify the stored user is still valid
      const position = POSITION_AUTH_CONFIG.find(p => p.id === user.id)
      if (!position) return null
      
      return user
    } catch {
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
  static getAllPositions(): PositionAuth[] {
    return POSITION_AUTH_CONFIG
  }
  
  // Get checklist positions (all except administrator)
  static getChecklistPositions(): PositionAuth[] {
    return POSITION_AUTH_CONFIG.filter(p => p.id !== 'administrator')
  }
}