import { supabase } from './supabase'
import { PositionAuthService } from './position-auth'

/**
 * Utility function to make authenticated API calls
 * Automatically includes the Bearer token from the current session
 * Works with both Supabase auth and position-based auth
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  // Get both Supabase session and position-based auth
  const { data: { session } } = await supabase.auth.getSession()
  const positionUser = await PositionAuthService.getCurrentUser()
  
  console.log('API Client - Supabase session:', !!session?.access_token)
  console.log('API Client - Position user:', positionUser ? {
    id: positionUser.id,
    role: positionUser.role,
    displayName: positionUser.displayName,
    isAuthenticated: positionUser.isAuthenticated
  } : 'None')
  
  // Always include position-based auth if available
  if (positionUser && positionUser.isAuthenticated) {
    headers['X-Position-Auth'] = 'true'
    headers['X-Position-User-Id'] = positionUser.id
    headers['X-Position-User-Role'] = positionUser.role
    headers['X-Position-Display-Name'] = positionUser.displayName
    console.log('API Client - Using position-based auth for:', positionUser.displayName)
  }
  
  // Include Supabase auth if present as well
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
    console.log('API Client - Including Supabase auth token')
  }
  
  console.log('API Client - Final headers:', Object.fromEntries(Object.entries(headers)))

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * Utility function to make authenticated GET requests and return JSON
 */
export async function authenticatedGet<T = any>(url: string): Promise<T | null> {
  try {
    const response = await authenticatedFetch(url)
    if (response.ok) {
      return await response.json()
    } else {
      const errorText = await response.text()
      console.error(`Failed to fetch ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      })
      
      // If it's an authentication error, provide more context
      if (response.status === 401) {
        console.warn('Authentication failed for:', url)
        const positionUser = await PositionAuthService.getCurrentUser()
        console.log('Current position user:', positionUser ? 
          `${positionUser.displayName} (${positionUser.role})` : 'None')
      }
      
      return null
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return null
  }
}

/**
 * Utility function to make authenticated POST requests
 */
export async function authenticatedPost<T = any>(url: string, data: any): Promise<T | null> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (response.ok) {
      return await response.json()
    } else {
      const errorText = await response.text()
      
      let errorMessage = `Failed to post to ${url}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        // If response is not JSON, use the text as error message
        if (errorText) {
          errorMessage = errorText
        }
      }
      
      throw new Error(errorMessage)
    }
  } catch (error) {
    // Only re-throw the error, don't log it here
    throw error
  }
}

/**
 * Utility function to make authenticated PUT requests
 */
export async function authenticatedPut<T = any>(url: string, data: any): Promise<T | null> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    if (response.ok) {
      return await response.json()
    } else {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Failed to put to ${url}`)
    }
  } catch (error) {
    console.error(`Error putting to ${url}:`, error)
    throw error
  }
}

/**
 * Utility function to make authenticated DELETE requests
 */
export async function authenticatedDelete(url: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'DELETE',
    })
    return response.ok
  } catch (error) {
    console.error(`Error deleting ${url}:`, error)
    return false
  }
}

// API client objects for specific endpoints
export const taskInstancesApi = {
  async getAll(filters: Record<string, any> = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
    const url = `/api/task-instances${params.toString() ? `?${params.toString()}` : ''}`
    return await authenticatedGet(url) || []
  },

  async getById(id: string) {
    return await authenticatedGet(`/api/task-instances/${id}`)
  },

  async create(data: any) {
    return await authenticatedPost('/api/task-instances', data)
  },

  async update(id: string, data: any) {
    return await authenticatedPut(`/api/task-instances/${id}`, data)
  },

  async delete(id: string) {
    return await authenticatedDelete(`/api/task-instances/${id}`)
  }
}

export const masterTasksApi = {
  async getAll(filters: Record<string, any> = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })
    const url = `/api/master-tasks${params.toString() ? `?${params.toString()}` : ''}`
    return await authenticatedGet(url) || []
  },

  async getById(id: string) {
    return await authenticatedGet(`/api/master-tasks/${id}`)
  },

  async create(data: any) {
    return await authenticatedPost('/api/master-tasks', data)
  },

  async update(id: string, data: any) {
    return await authenticatedPut(`/api/master-tasks/${id}`, data)
  },

  async delete(id: string) {
    return await authenticatedDelete(`/api/master-tasks/${id}`)
  }
}

export const positionsApi = {
  async getAll() {
    return await authenticatedGet('/api/positions') || []
  },

  async getById(id: string) {
    return await authenticatedGet(`/api/positions/${id}`)
  },

  async create(data: any) {
    return await authenticatedPost('/api/positions', data)
  },

  async update(id: string, data: any) {
    return await authenticatedPut(`/api/positions/${id}`, data)
  },

  async delete(id: string) {
    return await authenticatedDelete(`/api/positions/${id}`)
  }
}

export const publicHolidaysApi = {
  async getAll(filters: { year?: string; region?: string } = {}) {
    const params = new URLSearchParams()
    if (filters.year) params.append('year', filters.year)
    if (filters.region) params.append('region', filters.region)
    
    const url = `/api/public-holidays${params.toString() ? `?${params.toString()}` : ''}`
    return await authenticatedGet(url) || []
  },

  async create(data: { date: string; name: string; region?: string; source?: string }) {
    return await authenticatedPost('/api/public-holidays', data)
  },

  async update(date: string, data: { date: string; name: string; region?: string; source?: string }) {
    return await authenticatedPut(`/api/public-holidays/${date}`, data)
  },

  async delete(date: string) {
    return await authenticatedFetch('/api/public-holidays', {
      method: 'DELETE',
      body: JSON.stringify({ date }),
    }).then(response => response.ok)
  }
}