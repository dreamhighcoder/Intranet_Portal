import { MasterTask, TaskInstance, Position, PublicHoliday } from './types'

const API_BASE_URL = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Get the session from Supabase
  if (typeof window !== 'undefined') {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`
      }
    }
  }
  
  return {}
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(response.status, errorData.error || 'API request failed')
  }

  return response.json()
}

// Positions API
export const positionsApi = {
  getAll: (): Promise<Position[]> => apiRequest('/positions'),
  
  create: (data: Omit<Position, 'id' | 'created_at' | 'updated_at'>): Promise<Position> =>
    apiRequest('/positions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Master Tasks API
export const masterTasksApi = {
  getAll: (params?: { position_id?: string; status?: string }): Promise<MasterTask[]> => {
    const searchParams = new URLSearchParams()
    if (params?.position_id) searchParams.append('position_id', params.position_id)
    if (params?.status) searchParams.append('status', params.status)
    
    const query = searchParams.toString()
    return apiRequest(`/master-tasks${query ? `?${query}` : ''}`)
  },
  
  getById: (id: string): Promise<MasterTask> => apiRequest(`/master-tasks/${id}`),
  
  create: (data: Omit<MasterTask, 'id' | 'created_at' | 'updated_at' | 'positions'>): Promise<MasterTask> =>
    apiRequest('/master-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<MasterTask>): Promise<MasterTask> =>
    apiRequest(`/master-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/master-tasks/${id}`, {
      method: 'DELETE',
    }),
}

// Task Instances API
export const taskInstancesApi = {
  getAll: (params?: { 
    date?: string; 
    dateRange?: string;
    position_id?: string; 
    status?: string;
    category?: string;
  }): Promise<any[]> => {
    const searchParams = new URLSearchParams()
    if (params?.date) searchParams.append('date', params.date)
    if (params?.dateRange) searchParams.append('dateRange', params.dateRange)
    if (params?.position_id) searchParams.append('position_id', params.position_id)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.category) searchParams.append('category', params.category)
    
    const query = searchParams.toString()
    return apiRequest(`/task-instances${query ? `?${query}` : ''}`)
  },
  
  getById: (id: string): Promise<any> => apiRequest(`/task-instances/${id}`),
  
  update: (id: string, data: { 
    status?: string; 
    completed_by?: string; 
    action?: string 
  }): Promise<TaskInstance> =>
    apiRequest(`/task-instances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  create: (data: {
    master_task_id: string;
    instance_date: string;
    due_date: string;
    due_time: string;
  }): Promise<TaskInstance> =>
    apiRequest('/task-instances', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Public Holidays API
export const publicHolidaysApi = {
  getAll: (params?: { year?: string; region?: string }): Promise<PublicHoliday[]> => {
    const searchParams = new URLSearchParams()
    if (params?.year) searchParams.append('year', params.year)
    if (params?.region) searchParams.append('region', params.region)
    
    const query = searchParams.toString()
    return apiRequest(`/public-holidays${query ? `?${query}` : ''}`)
  },
  
  create: (data: Omit<PublicHoliday, 'created_at'>): Promise<PublicHoliday> =>
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