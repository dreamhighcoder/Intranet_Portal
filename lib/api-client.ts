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
  
  console.log('API Client - Authentication check for:', url)
  console.log('API Client - Supabase session:', !!session?.access_token)
  console.log('API Client - Position user:', positionUser ? {
    id: positionUser.id,
    role: positionUser.role,
    displayName: positionUser.displayName,
    isAuthenticated: positionUser.isAuthenticated
  } : 'None')
  
  // Check if we have any authentication method available
  const hasAuth = (positionUser && positionUser.isAuthenticated) || !!session?.access_token
  if (!hasAuth) {
    console.warn('API Client - No authentication available for:', url)
  }
  
  // Always include position-based auth if available
  if (positionUser && positionUser.isAuthenticated) {
    headers['X-Position-Auth'] = 'true'
    headers['X-Position-User-Id'] = positionUser.id
    headers['X-Position-User-Role'] = positionUser.role
    headers['X-Position-Display-Name'] = positionUser.displayName
    // Include super admin flag so server can authorize correctly
    headers['X-Position-Is-Super-Admin'] = positionUser.isSuperAdmin ? 'true' : 'false'
    console.log('API Client - Using position-based auth for:', positionUser.displayName)
  }
  
  // Include Supabase auth if present as well
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
    console.log('API Client - Including Supabase auth token')
  }
  
  console.log('API Client - Final headers for', url, ':', Object.fromEntries(Object.entries(headers)))

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * Utility function to make authenticated GET requests and return JSON
 * Includes retry logic for authentication race conditions
 */
export async function authenticatedGet<T = any>(url: string, retryCount = 0): Promise<T | null> {
  const maxRetries = 2
  
  try {
    const response = await authenticatedFetch(url)
    
    if (response.ok) {
      try {
        const jsonData = await response.json()
        return jsonData
      } catch (jsonError) {
        console.error(`API Client - Failed to parse JSON for ${url}:`, jsonError)
        // Can't read response.text() after response.json() has been called
        throw new Error(`Failed to parse JSON response: ${jsonError}`)
      }
    } else {
      let errorText = ''
      let errorBody = null
      
      try {
        errorText = await response.text()
        if (errorText) {
          try {
            errorBody = JSON.parse(errorText)
          } catch {
            errorBody = errorText
          }
        }
      } catch (textError) {
        console.warn(`Could not read error response from ${url}:`, textError)
        errorBody = 'Unable to read error response'
      }
      
      // If it's an authentication error, provide more context and potentially retry
      if (response.status === 401) {
        console.warn('Authentication failed for:', url)
        const positionUser = await PositionAuthService.getCurrentUser()
        console.log('Current position user:', positionUser ? 
          `${positionUser.displayName} (${positionUser.role})` : 'None')
        
        // Retry once if we have a user but got 401 (might be a race condition)
        if (positionUser && positionUser.isAuthenticated && retryCount < maxRetries) {
          console.log(`Retrying ${url} due to potential race condition (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms before retry
          return authenticatedGet<T>(url, retryCount + 1)
        }
      } else {
        // Log non-authentication errors as warnings to avoid Next.js error interception
        console.warn(`Failed to fetch ${url}:`, {
          status: response.status,
          statusText: response.statusText,
          errorBody: typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody) || 'Empty response',
          attempt: retryCount + 1,
          url: url
        })
      }
      
      return null
    }
  } catch (error) {
    // Log all errors as warnings to avoid Next.js error interception
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`Error fetching ${url}:`, {
      error: errorMessage,
      url: url,
      retryCount: retryCount
    })
    return null
  }
}

/**
 * Utility function to make authenticated POST requests
 */
export async function authenticatedPost<T = any>(url: string, data: any): Promise<T | null> {
  try {
    console.log('API Client - Making POST request to:', url)
    console.log('API Client - Request data:', JSON.stringify(data, null, 2))
    
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    
    console.log('API Client - Response status:', response.status)
    console.log('API Client - Response ok:', response.ok)
    
    if (response.ok) {
      const result = await response.json()
      console.log('API Client - Success response:', result)
      return result
    } else {
      console.log('API Client - Response not ok, status:', response.status, 'statusText:', response.statusText)
      const errorText = await response.text()
      console.log('API Client - Error response text:', errorText)
      console.log('API Client - Response headers:', Object.fromEntries(response.headers.entries()))
      
      let errorMessage = `Failed to post to ${url} (${response.status}: ${response.statusText})`
      try {
        const errorJson = JSON.parse(errorText)
        console.log('API Client - Parsed error JSON:', errorJson)
        const details = typeof errorJson?.details === 'string' ? errorJson.details : undefined
        const code = errorJson?.code ? ` [${errorJson.code}]` : ''
        if (errorJson.error) {
          errorMessage = `${errorJson.error}${code}${details ? ` - ${details}` : ''}`
        } else if (details) {
          errorMessage = `${errorMessage} - ${details}`
        }
      } catch {
        // If response is not JSON, use the text as error message
        if (errorText) {
          errorMessage = `${errorMessage} - ${errorText}`
        }
      }
      
      console.log('API Client - Final error message:', errorMessage)
      throw new Error(errorMessage)
    }
  } catch (error) {
    // Downgrade to warning to avoid confusing red error logs when callers handle validation errors
    console.warn('API Client - Exception caught:', error)
    throw error
  }
}

/**
 * Utility function to make authenticated PUT requests
 */
export async function authenticatedPut<T = any>(url: string, data: any): Promise<T | null> {
  try {
    console.log('API Client - Making PUT request to:', url)
    console.log('API Client - Request data:', JSON.stringify(data, null, 2))
    
    console.log('API Client - About to call authenticatedFetch...')
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    console.log('API Client - authenticatedFetch completed')
    
    console.log('API Client - Response status:', response.status)
    console.log('API Client - Response ok:', response.ok)
    
    if (response.ok) {
      console.log('API Client - Response is OK, parsing JSON...')
      const result = await response.json()
      console.log('API Client - Success response:', result)
      return result
    } else {
      console.log('API Client - Response is not OK, parsing error...')
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.log('API Client - Error response:', error)
      throw new Error(error.error || `Failed to put to ${url}`)
    }
  } catch (error) {
    console.error(`API Client - Exception in authenticatedPut for ${url}:`, error)
    console.error('API Client - Error type:', typeof error)
    console.error('API Client - Error message:', error instanceof Error ? error.message : String(error))
    console.error('API Client - Error stack:', error instanceof Error ? error.stack : 'No stack trace')
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
    const result = await authenticatedGet<any>(url)
    // API may return either an array or an object with a data field
    if (Array.isArray(result)) return result
    if (result && Array.isArray(result.data)) return result.data
    return []
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

  async reorder(order: Array<{ id: string; custom_order: number | null }>) {
    return await authenticatedPost('/api/master-tasks/reorder', { order })
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

  async reorder(order: Array<{ id: string; display_order: number }>) {
    return await authenticatedPost('/api/positions/reorder', { order })
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

  async update(
    originalDate: string,
    data: { date: string; name: string; region?: string; source?: string },
    originalRegion?: string,
    originalName?: string
  ) {
    return await authenticatedFetch('/api/public-holidays', {
      method: 'PATCH',
      body: JSON.stringify({ ...data, originalDate, originalRegion, originalName }),
    }).then(response => (response.ok ? response.json() : null))
  },

  async delete(date: string, region?: string) {
    try {
      console.log('Public holidays API - Attempting to delete:', { date, region })
      
      const response = await authenticatedFetch('/api/public-holidays', {
        method: 'DELETE',
        body: JSON.stringify({ date, region }),
      })
      
      console.log('Public holidays API - Delete response status:', response.status)
      
      if (response.ok) {
        console.log('Public holidays API - Delete successful')
        return true
      } else {
        // Try to get error details from response
        let errorData = null
        let errorText = ''
        
        try {
          errorText = await response.text()
          console.log('Public holidays API - Error response text:', errorText)
          
          if (errorText) {
            try {
              errorData = JSON.parse(errorText)
              console.log('Public holidays API - Parsed error data:', errorData)
            } catch (parseError) {
              console.log('Public holidays API - Could not parse error as JSON, using text')
              errorData = { error: errorText }
            }
          }
        } catch (textError) {
          console.error('Public holidays API - Could not read error response:', textError)
          errorData = { error: 'Could not read error response' }
        }
        
        // Create a meaningful error message
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        if (errorData) {
          if (errorData.details) {
            errorMessage = errorData.details
          } else if (errorData.error) {
            errorMessage = errorData.error
          }
          
          // Handle specific database constraint errors
          if (errorMessage.includes('audit_log_action_check') || errorMessage.includes('Fix Audit')) {
            errorMessage = errorData.details || 'The audit log system needs to be updated to support holiday deletion. Please visit the Admin > Fix Audit page to resolve this issue.'
          }
        }
        
        console.error('Public holidays API - Final error message:', errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Public holidays API - Delete operation failed:', error)
      
      // Re-throw with more context if it's our custom error
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error(`Delete failed: ${String(error)}`)
      }
    }
  }
}