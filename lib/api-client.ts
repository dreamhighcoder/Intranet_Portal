import { supabase } from './supabase'

/**
 * Utility function to make authenticated API calls
 * Automatically includes the Bearer token from the current session
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Get the current session to include auth token
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

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
      console.error(`Failed to fetch ${url}:`, response.status, response.statusText)
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
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Failed to post to ${url}`)
    }
  } catch (error) {
    console.error(`Error posting to ${url}:`, error)
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