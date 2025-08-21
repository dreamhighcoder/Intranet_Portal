import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cache for position mappings to avoid repeated database calls
let positionMappingCache: { [key: string]: string } | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get the mapping from position IDs to responsibility values
 * This function dynamically fetches the mapping from the database
 * and caches it for performance
 */
export async function getPositionToResponsibilityMapping(): Promise<{ [key: string]: string }> {
  const now = Date.now()
  
  // Return cached mapping if it's still valid
  if (positionMappingCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return positionMappingCache
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Fetch all positions except Administrator
    const { data: positions, error } = await supabase
      .from('positions')
      .select('id, name')
      .neq('name', 'Administrator')

    if (error) {
      console.error('Error fetching positions:', error)
      // Return fallback mapping if database query fails
      return getFallbackMapping()
    }

    if (!positions || positions.length === 0) {
      console.warn('No positions found in database, using fallback mapping')
      return getFallbackMapping()
    }

    // Create mapping from position names to responsibility values
    const mapping: { [key: string]: string } = {}
    
    positions.forEach(position => {
      const responsibilityValue = nameToResponsibilityValue(position.name)
      if (responsibilityValue) {
        mapping[position.id] = responsibilityValue
      }
    })

    // Cache the mapping
    positionMappingCache = mapping
    cacheTimestamp = now

    return mapping

  } catch (error) {
    console.error('Error in getPositionToResponsibilityMapping:', error)
    return getFallbackMapping()
  }
}

/**
 * Convert position name to responsibility value
 * This maps the human-readable position names to the responsibility values used in master_tasks
 */
function nameToResponsibilityValue(positionName: string): string | null {
  const nameMapping: { [key: string]: string } = {
    'Pharmacist (Primary)': 'pharmacist-primary',
    'Pharmacist (Supporting)': 'pharmacist-supporting',
    'Pharmacy Assistants': 'pharmacy-assistants',
    'Dispensary Technicians': 'dispensary-technicians',
    'DAA Packers': 'daa-packers',
    'Operational/Managerial': 'operational-managerial'
  }

  return nameMapping[positionName] || null
}

/**
 * Fallback mapping in case database query fails
 * This ensures the system continues to work even if there are database issues
 * Returns empty mapping to force retry on next request
 */
function getFallbackMapping(): { [key: string]: string } {
  console.warn('Database query failed, returning empty mapping. System will retry on next request.')
  return {}
}

/**
 * Get responsibility value for a specific position ID
 */
export async function getResponsibilityForPosition(positionId: string): Promise<string | null> {
  const mapping = await getPositionToResponsibilityMapping()
  return mapping[positionId] || null
}

/**
 * Clear the position mapping cache
 * Useful for testing or when positions are updated
 */
export function clearPositionMappingCache(): void {
  positionMappingCache = null
  cacheTimestamp = 0
}

/**
 * Get position ID for a specific responsibility value
 * This is the reverse of getResponsibilityForPosition
 */
export async function getPositionIdForResponsibility(responsibility: string): Promise<string | null> {
  const mapping = await getPositionToResponsibilityMapping()
  
  // Find the position ID that maps to this responsibility
  for (const [positionId, responsibilityValue] of Object.entries(mapping)) {
    if (responsibilityValue === responsibility) {
      return positionId
    }
  }
  
  return null
}

/**
 * Get all available responsibility values
 */
export function getAllResponsibilityValues(): string[] {
  return [
    'pharmacist-primary',
    'pharmacist-supporting', 
    'pharmacy-assistants',
    'dispensary-technicians',
    'daa-packers',
    'operational-managerial'
  ]
}

/**
 * Dynamic responsibility options from Positions + shared options.
 * Values are kebab-case slugs; labels are the position names or shared labels.
 */
export async function getResponsibilityOptions(): Promise<{ value: string; label: string }[]> {
  try {
    // Fetch positions via server API to avoid exposing service role key in the browser
    const response = await fetch('/api/positions', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      console.error('Error fetching positions for responsibility options:', response.status, response.statusText)
    }

    const positions: Array<{ name: string }> = response.ok ? await response.json() : []

    const mapNameToValue: { [key: string]: string } = {
      'Pharmacist (Primary)': 'pharmacist-primary',
      'Pharmacist (Supporting)': 'pharmacist-supporting',
      'Pharmacy Assistants': 'pharmacy-assistants',
      'Dispensary Technicians': 'dispensary-technicians',
      'DAA Packers': 'daa-packers',
      'Operational/Managerial': 'operational-managerial'
    }

    const opts: { value: string; label: string }[] = []
    const seen = new Set<string>()

    if (positions && Array.isArray(positions)) {
      for (const p of positions) {
        if (!p?.name || p.name === 'Administrator') continue
        const v = mapNameToValue[p.name] || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        if (!seen.has(v)) {
          opts.push({ value: v, label: p.name })
          seen.add(v)
        }
      }
    }

    // Append shared options
    const shared = [
      { value: 'shared-inc-pharmacist', label: 'Shared (inc. Pharmacist)' },
      { value: 'shared-exc-pharmacist', label: 'Shared (exc. Pharmacist)' }
    ]
    for (const s of shared) {
      if (!seen.has(s.value)) {
        opts.push(s)
        seen.add(s.value)
      }
    }

    return opts
  } catch (e) {
    console.error('Error in getResponsibilityOptions:', e)
    // Fallback: shared only if positions fail
    return [
      { value: 'shared-inc-pharmacist', label: 'Shared (inc. Pharmacist)' },
      { value: 'shared-exc-pharmacist', label: 'Shared (exc. Pharmacist)' }
    ]
  }
}