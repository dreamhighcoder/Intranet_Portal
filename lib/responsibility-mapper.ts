/**
 * Responsibility Mapper Utility
 *
 * Normalizes and maps responsibility values between stored/display strings and
 * a kebab-case form for internal checks. Avoids hardcoded role lists by
 * slugifying arbitrary position names.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[()/]/g, ' ') // normalize punctuation
    .replace(/[^a-z0-9]+/g, '-') // non-alphanum to dash
    .replace(/^-+|-+$/g, '') // trim dashes
}

/**
 * Convert a responsibility value to kebab-case format
 * Accepts display strings (e.g., "Pharmacist (Primary)")
 * or already-kebab strings and returns a kebab-case value.
 */
export function toKebabCase(responsibility: string): string {
  if (!responsibility) return responsibility

  // Generic slug for arbitrary position names
  return slugify(responsibility)
}

/**
 * Convert a responsibility value to display format
 * - Kebab for arbitrary names -> Title-cased best-effort
 * - Otherwise return as-is (assume already a display string)
 */
export function toDisplayFormat(param: string): string {
  if (!param) return param

  // Heuristic: if looks like kebab, title-case it for display fallback
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(param)) {
    return param
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  if (/^[a-z0-9]+([-_][a-z0-9]+)*$/.test(param)) {
    return param
      .split(/[-_]/) // split by - or _
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return param
}

/**
 * Get all variants of a responsibility value (both kebab-case and display format)
 */
export function getAllVariants(responsibility: string): string[] {
  const variants = new Set<string>()
  if (!responsibility) return []

  variants.add(responsibility)

  const kebab = toKebabCase(responsibility)
  if (kebab && kebab !== responsibility) variants.add(kebab)

  return Array.from(variants)
}

/**
 * Get all responsibility search options for a given role
 */
export function getSearchOptions(role: string): string[] {
  const variants = new Set<string>(getAllVariants(role))
  const kebab = toKebabCase(role)
  if (kebab) {
    // Add plural/singular swap for trailing -s marker used in DB like 'pharmacy-assistant-s'
    if (kebab.endsWith('-s')) variants.add(kebab.slice(0, -2))
    else variants.add(`${kebab}-s`)
  }
  return Array.from(variants)
}

/**
 * Check if a role is a pharmacist role (by slug)
 * Now uses dynamic detection instead of hardcoded values
 */
export function isPharmacistRole(role: string): boolean {
  const normalized = toKebabCase(role)
  // Check if the role contains "pharmacist" in any form
  return normalized.includes('pharmacist') || role.toLowerCase().includes('pharmacist')
}

/**
 * Filter tasks based on responsibility rules
 */
export function filterTasksByResponsibility<T extends { responsibility: string[] }>(
  tasks: T[],
  role: string
): T[] {
  return tasks.filter(task => {
    // Direct assignment: any variant match
    const roleVariants = getAllVariants(role)
    for (const rv of roleVariants) {
      if (task.responsibility.includes(rv)) return true
    }

    return false
  })
}