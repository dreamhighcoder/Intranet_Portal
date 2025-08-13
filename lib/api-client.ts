import { supabase } from './supabase'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get current session with retry logic
  let session = null
  let attempts = 0
  const maxAttempts = 3
  
  while (!session && attempts < maxAttempts) {
    attempts++
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error(`Session error (attempt ${attempts}):`, sessionError)
      if (attempts === maxAttempts) {
        throw new ApiError(401, 'Authentication failed')
      }
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 500))
      continue
    }
    
    if (currentSession?.access_token) {
      session = currentSession
      break
    }
    
    console.log(`No session found (attempt ${attempts}/${maxAttempts})`)
    if (attempts < maxAttempts) {
      // Try to refresh the session
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
      if (refreshedSession?.access_token) {
        session = refreshedSession
        break
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  if (!session?.access_token) {
    console.error('No session or access token found after all attempts')
    throw new ApiError(401, 'Authentication required')
  }

  const url = `/api${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options?.headers,
  }

  console.log('Making API request:', {
    endpoint,
    hasToken: true,
    tokenLength: session.access_token.length
  })

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error('API request failed:', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      error: errorData.error || errorData.message
    })
    throw new ApiError(response.status, errorData.error || errorData.message || 'API request failed')
  }

  return response.json()
}

// Master Tasks API
export const masterTasksApi = {
  getAll: (params?: { position_id?: string; status?: string }): Promise<any[]> => {
    const searchParams = new URLSearchParams()
    if (params?.position_id) searchParams.append('position_id', params.position_id)
    if (params?.status) searchParams.append('status', params.status)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return apiRequest(`/master-tasks${query}`)
  },

  getById: (id: string): Promise<any> => 
    apiRequest(`/master-tasks/${id}`),

  create: (data: any): Promise<any> => 
    apiRequest('/master-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any): Promise<any> => 
    apiRequest(`/master-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> => 
    apiRequest(`/master-tasks/${id}`, {
      method: 'DELETE',
    }),
}

// Positions API
export const positionsApi = {
  getAll: (): Promise<any[]> => apiRequest('/positions'),

  getById: (id: string): Promise<any> => 
    apiRequest(`/positions/${id}`),

  create: (data: any): Promise<any> => 
    apiRequest('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any): Promise<any> => 
    apiRequest(`/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> => 
    apiRequest(`/positions/${id}`, {
      method: 'DELETE',
    }),
}

// Task Instances API
export const taskInstancesApi = {
  getAll: (params?: { date?: string; position_id?: string; status?: string }): Promise<any[]> => {
    const searchParams = new URLSearchParams()
    if (params?.date) searchParams.append('date', params.date)
    if (params?.position_id) searchParams.append('position_id', params.position_id)
    if (params?.status) searchParams.append('status', params.status)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return apiRequest(`/task-instances${query}`)
  },

  getById: (id: string): Promise<any> => 
    apiRequest(`/task-instances/${id}`),

  update: (id: string, data: any): Promise<any> => 
    apiRequest(`/task-instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  complete: (id: string): Promise<any> => 
    apiRequest(`/task-instances/${id}/complete`, {
      method: 'POST',
    }),

  uncomplete: (id: string): Promise<any> => 
    apiRequest(`/task-instances/${id}/uncomplete`, {
      method: 'POST',
    }),
}

// Public Holidays API
export const publicHolidaysApi = {
  getAll: (): Promise<any[]> => apiRequest('/public-holidays'),

  create: (data: any): Promise<any> => 
    apiRequest('/public-holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (date: string): Promise<void> => 
    apiRequest('/public-holidays', {
      method: 'DELETE',
      body: JSON.stringify({ date }),
    }),
}

export { ApiError }